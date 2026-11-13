import { ShellSyntaxError, type Token } from "./parseArgs";

export interface RedirectTarget {
  file: string;
  append: boolean;
}

export interface Redirect {
  args: string[];
  stdout?: RedirectTarget;
  stderr?: RedirectTarget;
}

const REDIRECTS: Record<
  string,
  { stream: "stdout" | "stderr"; append: boolean }
> = {
  ">": { stream: "stdout", append: false },
  "1>": { stream: "stdout", append: false },
  ">>": { stream: "stdout", append: true },
  "1>>": { stream: "stdout", append: true },
  "2>": { stream: "stderr", append: false },
  "2>>": { stream: "stderr", append: true },
};

// Separates a command's words from its redirects. Each redirect operator
// must be followed by a word naming the file; otherwise it's a syntax
// error, reported with the token that came instead (or "newline").
export function parseRedirect(tokens: Token[]): Redirect {
  const result: Redirect = { args: [] };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type === "word") {
      result.args.push(token.text);
      continue;
    }

    const redirect = REDIRECTS[token.text];
    const target = tokens[i + 1];
    if (!redirect) throw new ShellSyntaxError(token.text);
    if (target?.type !== "word") {
      throw new ShellSyntaxError(target?.text ?? "newline");
    }
    result[redirect.stream] = { file: target.text, append: redirect.append };
    i++;
  }

  return result;
}
