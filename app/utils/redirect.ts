export interface Redirect {
  args: string[];
  stdoutFile?: string;
}

const STDOUT_OPERATORS = new Set([">", "1>"]);

export function parseRedirect(tokens: string[]): Redirect {
  const args: string[] = [];
  let stdoutFile: string | undefined;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (STDOUT_OPERATORS.has(token) && i + 1 < tokens.length) {
      stdoutFile = tokens[++i];
      continue;
    }
    args.push(token);
  }

  return { args, stdoutFile };
}
