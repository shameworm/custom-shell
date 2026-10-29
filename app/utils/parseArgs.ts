function isQuote(char: string): boolean {
  return char === "'" || char === '"';
}

function isSpace(char: string): boolean {
  return /\s/.test(char);
}

function isEscapable(quote: string, next: string): boolean {
  return quote === "" || next === '"' || next === "\\";
}

export function parseArgs(line: string): string[] {
  const args: string[] = [];

  let current = "";
  let inToken = false;
  let quote = "";

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
      if (inToken) {
        args.push(current);
        current = "";
        inToken = false;
      }
      continue;
    }

    current += char;
    inToken = true;
  }

  if (inToken) args.push(current);
  return args;
}
