export function parseArgs(line: string): string[] {
  const args: string[] = [];

  let current = "";
  let inToken = false;
  let inSignle = false;
  let inDouble = false;

  for (const char of line) {
    if (inSignle || inDouble) {
      if (char === "'" && !inDouble) {
        inSignle = false;
      } else if (char === '"' && !inSignle) {
        inDouble = false;
      } else {
        current += char;
      }
    } else if (char === "'" && !inDouble) {
      inSignle = true;
      inToken = true;
    } else if (char === '"' && !inSignle) {
      inDouble = true;
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
