import { spawnSync } from "child_process";

import type { Writer } from "./builtins";
import type { CompletionContext } from "./utils/completer";

/** Completer script registered for each command name via `complete -C`. */
export const completionSpecs = new Map<string, string>();

// The `complete` builtin: manages programmable completion specs.
//   complete -C <script> <name>...  register a completer script for each name
//   complete -p [name...]           print specs (all of them when no name given)
//   complete                        same as `complete -p`
export function complete(args: string[], out: Writer, err: Writer): void {
  const [flag = "-p", ...rest] = args;

  switch (flag) {
    case "-C": {
      const [script, ...names] = rest;
      if (script === undefined || names.length === 0) {
        err("complete: usage: complete -C <script> <name>...");
        return;
      }
      for (const name of names) completionSpecs.set(name, script);
      return;
    }

    case "-p": {
      const names = rest.length > 0 ? rest : [...completionSpecs.keys()];
      for (const name of names) {
        const script = completionSpecs.get(name);
        if (script === undefined) {
          err(`complete: ${name}: no completion specification`);
        } else {
          out(`complete -C ${shellQuote(script)} ${name}`);
        }
      }
      return;
    }

    default:
      err(`complete: ${flag}: invalid option`);
  }
}

// Wraps a value in single quotes so it reads back as one shell word.
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

// Runs the completer script registered for the command and returns its
// stdout lines as candidates, or undefined when no script is registered.
// Like bash, the script gets the command, the word being completed and the
// previous word as arguments, plus COMP_LINE (the full line) and COMP_POINT
// (the cursor's byte offset in it) in its environment. `fullLine` defaults to
// the text up to the cursor, for when the cursor is at the end.
// A script that cannot be started or runs past the timeout yields no
// candidates.
export function runCompleter(
  { command, word, previous, line }: CompletionContext,
  fullLine: string = line,
): string[] | undefined {
  const script = completionSpecs.get(command);
  if (script === undefined) return undefined;

  const result = spawnSync(script, [command, word, previous], {
    encoding: "utf8",
    timeout: 5000,
    env: {
      ...process.env,
      COMP_LINE: fullLine,
      COMP_POINT: String(Buffer.byteLength(line)),
    },
  });
  if (result.error || typeof result.stdout !== "string") return [];

  return result.stdout.split("\n").filter((line) => line !== "");
}
