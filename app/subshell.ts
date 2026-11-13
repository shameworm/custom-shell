import * as path from "path";

import { runCommandList, type SubshellInput } from "./commandList";
import { shellVariables } from "./variables";

// How to start this shell again as a subshell, the way bash runs a
// background list or pipeline (`sleep 2 && echo done &`): the program and
// its arguments. A compiled binary is started with --subshell directly;
// under Bun, the entry script is passed too. Bun puts a compiled binary's
// sources under the virtual /$bunfs directory.
export function subshellCommand(json: string): [string, string[]] {
  const compiled = import.meta.dir.startsWith("/$bunfs");
  const entry = path.join(import.meta.dir, "main.ts");
  const args = ["--subshell", json];
  return [process.execPath, compiled ? args : [entry, ...args]];
}

// The subshell side: receives the list's source text and a copy of the
// parent's shell variables as JSON, expands and runs the list, and exits
// with its status.
export async function runSubshell(json: string): Promise<never> {
  const { list, variables } = JSON.parse(json) as SubshellInput;
  for (const [name, value] of variables) shellVariables.set(name, value);
  const status = await runCommandList([{ ...list, background: false }], "");
  process.exit(status);
}
