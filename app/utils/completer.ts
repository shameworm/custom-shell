import type { CompleterResult } from "readline";

export interface CompleterIO {
  bell(): void;
}

// Completes the command name (first word) against the given candidates,
// appending a trailing space so arguments can be typed right away.
export function createCompleter(commands: string[], io: CompleterIO) {
  return (line: string): CompleterResult => {
    if (/\s/.test(line)) return [[], line];
    const hits = commands
      .filter((cmd) => cmd.startsWith(line))
      .sort()
      .map((cmd) => cmd + " ");
    if (hits.length === 0) io.bell();
    return [hits, line];
  };
}
