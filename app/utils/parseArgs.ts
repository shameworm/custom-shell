function isQuote(char: string): boolean {
  return char === "'" || char === '"';
}

function isSpace(char: string): boolean {
  return /\s/.test(char);
}

// Outside quotes a backslash escapes anything; inside double quotes only
// the characters that are otherwise special there.
function isEscapable(quote: string, next: string): boolean {
  return quote === "" || '"\\$`'.includes(next);
}

/** Looks up a variable's value; undefined when it isn't set. */
export type VariableLookup = (name: string) => string | undefined;

/** An error in a command line; the message is what bash prints. */
export class ShellError extends Error {}

/** Thrown for a malformed ${...}. */
export class ExpansionError extends ShellError {}

/** Thrown for operators in the wrong place, e.g. a redirect with no file. */
export class ShellSyntaxError extends ShellError {
  constructor(token: string) {
    super(`syntax error near unexpected token \`${token}'`);
  }
}

export type Operator =
  "|" | "&" | "&&" | "||" | ";" | ">" | ">>" | "1>" | "1>>" | "2>" | "2>>";

// A word (after quote removal and expansion), or an operator. Only an
// unquoted, unescaped operator character makes an operator, so a quoted
// '|' or an expanded value containing & is an ordinary word.
export type Token =
  { type: "word"; text: string } | { type: "operator"; text: Operator };

// A $NAME or ${NAME} reference starting at `start` (the $): the variable
// name and the index just past the reference, or undefined if no name
// follows a bare $. Throws ExpansionError for ${...} without a valid name
// or a closing brace.
function readReference(
  line: string,
  start: number,
): { name: string; end: number } | undefined {
  if (line.charAt(start + 1) === "{") {
    const close = line.indexOf("}", start + 2);
    const name = close === -1 ? "" : line.slice(start + 2, close);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      const text =
        close === -1 ? line.slice(start) : line.slice(start, close + 1);
      throw new ExpansionError(`${text}: bad substitution`);
    }
    return { name, end: close + 1 };
  }

  const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(start + 1));
  return match
    ? { name: match[0], end: start + 1 + match[0].length }
    : undefined;
}

// Splits a command line into words and operators, handling quotes,
// backslash escapes and $NAME / ${NAME} expansion. Unset variables expand
// to nothing. An expansion inside double quotes stays part of one word; an
// unquoted one is split on whitespace, and adds no word at all if it's empty.
//
// Unquoted |, ||, &, &&, ;, > and >> are operators even without spaces
// around them (`a|b`, `sleep 1&`, `a&&b`). A 1 or 2 directly before > makes
// 1> / 2> only when it starts the word, as in bash: `echo a2>f` writes "a2"
// to f.
//
// If `positions` is given, it receives each token's span in `line`, so a
// caller can cut out the source text of part of the line.
export function parseArgs(
  line: string,
  lookup: VariableLookup = () => undefined,
  positions?: { start: number; end: number }[],
): Token[] {
  const tokens: Token[] = [];
  // Index of the character being read, for recording token spans.
  let pos = 0;
  const push = (token: Token, start: number, end: number) => {
    tokens.push(token);
    positions?.push({ start, end });
  };

  let current = "";
  let inToken = false;
  let quote = "";
  // Where the current word starts in `line`, to tell a bare 2 from "2".
  let wordStart = 0;

  const startWord = (index: number) => {
    if (!inToken) wordStart = index;
    inToken = true;
  };
  const endWord = () => {
    if (inToken) {
      push({ type: "word", text: current }, wordStart, pos);
      current = "";
      inToken = false;
    }
  };
  for (let i = 0; i < line.length; i++) {
    const char = line.charAt(i);
    pos = i;

    if (quote === "'") {
      if (char === "'") quote = "";
      else current += char;
      continue;
    }

    if (char === "\\" && i + 1 < line.length) {
      const next = line.charAt(i + 1);
      if (isEscapable(quote, next)) {
        current += next;
        startWord(i);
        i++;
        continue;
      }
    }

    if (char === "$") {
      const ref = readReference(line, i);
      if (ref) {
        const value = lookup(ref.name) ?? "";
        if (quote === '"') {
          current += value;
          startWord(i);
        } else {
          for (const c of value) {
            if (isSpace(c)) endWord();
            else {
              current += c;
              startWord(i);
            }
          }
        }
        i = ref.end - 1;
        continue;
      }
    }

    if (char === quote) {
      quote = "";
      continue;
    }

    if (quote === "" && isQuote(char)) {
      quote = char;
      startWord(i);
      continue;
    }

    if (quote === "" && isSpace(char)) {
      endWord();
      continue;
    }

    if (quote === "" && (char === "|" || char === "&" || char === ";")) {
      endWord();
      // || and && are single operators, not two | or two &.
      const doubled = char !== ";" && line.charAt(i + 1) === char;
      const text = (doubled ? char + char : char) as Operator;
      push({ type: "operator", text }, i, i + text.length);
      if (doubled) i++;
      continue;
    }

    if (quote === "" && char === ">") {
      const append = line.charAt(i + 1) === ">";
      // A word that is exactly an unquoted 1 or 2 names the stream.
      const raw = inToken ? line.slice(wordStart, i) : "";
      const fd = raw === "1" || raw === "2" ? raw : "";
      const start = fd ? wordStart : i;
      if (fd) {
        current = "";
        inToken = false;
      } else {
        endWord();
      }
      const text = `${fd}${append ? ">>" : ">"}` as Operator;
      push({ type: "operator", text }, start, i + (append ? 2 : 1));
      if (append) i++;
      continue;
    }

    current += char;
    startWord(i);
  }

  pos = line.length;
  endWord();
  return tokens;
}
