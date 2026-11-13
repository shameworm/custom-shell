import type { Writer } from "./builtins";

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
