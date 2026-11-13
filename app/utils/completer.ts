import type { CompleterResult } from "readline";

export interface Candidate {
  /** Text that replaces the word being completed. */
  value: string;
  /** Appended when this is the only match, e.g. a space after a file name. */
  suffix: string;
}

export interface CompletionSources {
  /** Command names (builtins and executables) starting with the prefix. */
  commands(prefix: string): string[];
  /** Filesystem entries matching a partially typed path. */
  paths(word: string): Candidate[];
}

export interface CompleterIO {
  bell(): void;
  list(matches: string[]): void;
}

// Completes the word before the cursor: the first word against command
// names, any later word against filesystem entries.
// - one match: complete it and append its suffix
// - several: extend the word to their longest common prefix; if that adds
//   nothing, the first <TAB> rings the bell and a second <TAB> on the same
//   input lists them
// - none: ring the bell and leave the input unchanged
export function createCompleter(sources: CompletionSources, io: CompleterIO) {
  let lastAmbiguousLine: string | undefined;

  function resolve(line: string, word: string, candidates: Candidate[]) {
    const matches = candidates
      .filter((c) => c.value.startsWith(word))
      .sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));

    if (matches.length <= 1) {
      lastAmbiguousLine = undefined;
      if (matches.length === 0) io.bell();
      return matches.map((c) => c.value + c.suffix);
    }

    const common = longestCommonPrefix(matches.map((c) => c.value));
    if (common.length > word.length) {
      lastAmbiguousLine = undefined;
      return [common];
    }

    if (lastAmbiguousLine === line) {
      io.list(matches.map((c) => c.value));
    } else {
      io.bell();
      lastAmbiguousLine = line;
    }
    return [];
  }

  return (line: string): CompleterResult => {
    const start = line.search(/\S*$/);
    const word = line.slice(start);
    const isCommand = line.slice(0, start).trim() === "";

    const candidates = isCommand
      ? [...new Set(sources.commands(word))].map((name) => ({
          value: name,
          suffix: " ",
        }))
      : sources.paths(word);

    return [resolve(line, word, candidates), word];
  };
}

function longestCommonPrefix(words: string[]): string {
  let prefix = words[0] ?? "";
  for (const word of words) {
    while (!word.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}
