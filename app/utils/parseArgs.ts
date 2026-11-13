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

// A $NAME reference starting at `start` (the $): the variable name and the
// index just past the reference, or undefined if no name follows the $.
function readReference(
  line: string,
  start: number,
): { name: string; end: number } | undefined {
  const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(start + 1));
  return match
    ? { name: match[0], end: start + 1 + match[0].length }
    : undefined;
}

// Splits a command line into words, handling quotes, backslash escapes and
// $NAME expansion. Unset variables expand to nothing. An expansion inside
// double quotes stays part of one word; an unquoted one is split on
// whitespace, and adds no word at all if it's empty.
export function parseArgs(
  line: string,
  lookup: VariableLookup = () => undefined,
): string[] {
  const args: string[] = [];

  let current = "";
  let inToken = false;
  let quote = "";

  const endWord = () => {
    if (inToken) {
      args.push(current);
      current = "";
      inToken = false;
    }
  };

  for (let i = 0; i < line.length; i++) {
    const char = line.charAt(i);

    if (quote === "'") {
      if (char === "'") quote = "";
      else current += char;
      continue;
    }

    if (char === "\\" && i + 1 < line.length) {
      const next = line.charAt(i + 1);
      if (isEscapable(quote, next)) {
        current += next;
        inToken = true;
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
          inToken = true;
        } else {
          for (const c of value) {
            if (isSpace(c)) endWord();
            else {
              current += c;
              inToken = true;
            }
          }
        }
        i = ref.end - 1;
        continue;
      }
    }

    if (char === quote) {
      quote = "";
      inToken = true;
      continue;
    }

    if (quote === "" && isQuote(char)) {
      quote = char;
      inToken = true;
      continue;
    }

    if (quote === "" && isSpace(char)) {
      endWord();
      continue;
    }

    current += char;
    inToken = true;
  }

  if (inToken) args.push(current);
  return args;
}
