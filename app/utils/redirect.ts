export interface Redirect {
  args: string[];
  stdoutFile?: string;
  stderrFile?: string;
}

const OPERATORS: Record<string, "stdoutFile" | "stderrFile"> = {
  ">": "stdoutFile",
  "1>": "stdoutFile",
  "2>": "stderrFile",
};

export function parseRedirect(tokens: string[]): Redirect {
  const result: Redirect = { args: [] };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const target = OPERATORS[token];
    if (target && i + 1 < tokens.length) {
      result[target] = tokens[++i];
      continue;
    }
    result.args.push(token);
  }

  return result;
}
