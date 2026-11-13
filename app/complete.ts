import type { Writer } from "./builtins";

// The `complete` builtin: manages programmable completion specs.
//   complete -p <name>...   print the spec registered for each name
export function complete(args: string[], out: Writer, err: Writer): void {
  const [flag, ...names] = args;

  if (flag === "-p") {
    for (const name of names) {
      err(`complete: ${name}: no completion specification`);
    }
  }
}
