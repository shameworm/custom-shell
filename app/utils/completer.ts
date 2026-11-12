import type { CompleterResult } from "readline";

export interface CompleterIO {
  bell(): void;
}

// Completes the command name (first word) using the candidates returned for
// the typed prefix, appending a trailing space so arguments can follow.
export function createCompleter(
  getCandidates: (prefix: string) => string[],
  io: CompleterIO,
) {
  return (line: string): CompleterResult => {
    if (/\s/.test(line)) return [[], line];
    const matches = [...new Set(getCandidates(line))]
      .filter((cmd) => cmd.startsWith(line))
      .sort();
    if (matches.length === 0) io.bell();
    return [matches.map((cmd) => cmd + " "), line];
  };
}
