export function parseArgs(line: string): string[] {
  const args: string[] = [];

  let current = "";
  let inToken = false;
  let inSignle = false;

  for (const char of line) {
    if (inSignle) {
      if (char === "'") inSignle = false;
      else current += char;
    } else if (char === "'") {
      inSignle = true;
      inToken = true;
    } else if (/\s/.test(char)) {
      if (inToken) {
        args.push(current);
        current = "";
        inToken = false;
      }
    } else {
      current += char;
      inToken = true;
    }
  }

  if (inToken) args.push(current);

  return args;
}
