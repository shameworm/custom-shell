export interface RedirectTarget {
  file: string;
  append: boolean;
}

export interface Redirect {
  args: string[];
  stdout?: RedirectTarget;
  stderr?: RedirectTarget;
}

const OPERATORS: Record<
  string,
  { stream: "stdout" | "stderr"; append: boolean }
> = {
  ">": { stream: "stdout", append: false },
  "1>": { stream: "stdout", append: false },
  ">>": { stream: "stdout", append: true },
  "1>>": { stream: "stdout", append: true },
  "2>": { stream: "stderr", append: false },
};

export function parseRedirect(tokens: string[]): Redirect {
  const result: Redirect = { args: [] };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const op = OPERATORS[token];
    if (op && i + 1 < tokens.length) {
      result[op.stream] = { file: tokens[++i]!, append: op.append };
      continue;
    }
    result.args.push(token);
  }

  return result;
}
