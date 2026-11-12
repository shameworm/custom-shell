import type { CompleterResult } from "readline";

export interface CompleterIO {
  bell(): void;
  list(matches: string[]): void;
}

// Completes the command name (first word) using the candidates returned for
// the typed prefix. A single match is completed with a trailing space so
// arguments can follow. With several matches, the input is extended to their
// longest common prefix; if it can't be extended, the first <TAB> rings the
// bell and a second <TAB> on the same input lists them.
export function createCompleter(
  getCandidates: (prefix: string) => string[],
  io: CompleterIO,
) {
  let lastAmbiguousLine: string | undefined;

  return (line: string): CompleterResult => {
    if (/\s/.test(line)) return [[], line];
    const matches = [...new Set(getCandidates(line))]
      .filter((cmd) => cmd.startsWith(line))
      .sort();

    if (matches.length <= 1) {
      lastAmbiguousLine = undefined;
      if (matches.length === 0) io.bell();
      return [matches.map((cmd) => cmd + " "), line];
    }

    const common = longestCommonPrefix(matches);
    if (common.length > line.length) {
      lastAmbiguousLine = undefined;
      return [[common], line];
    }

    if (lastAmbiguousLine === line) {
      io.list(matches);
    } else {
      io.bell();
      lastAmbiguousLine = line;
    }
    return [[], line];
  };
}

function longestCommonPrefix(words: string[]): string {
  let prefix = words[0] ?? "";
  for (const word of words) {
    while (!word.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}
