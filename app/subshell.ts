// Runs an and-or list in a separate process, the way bash runs a
// background list or pipeline in a subshell: `sleep 2 && echo done &`.
// It receives the list's source text and a copy of the parent's shell
// variables as JSON in argv, expands and runs the list, and exits with its
// status.
import { runCommandList, type SubshellInput } from "./commandList";
import { shellVariables } from "./variables";

const { list, variables } = JSON.parse(process.argv[2]!) as SubshellInput;
for (const [name, value] of variables) shellVariables.set(name, value);
const status = await runCommandList([{ ...list, background: false }], "");
process.exit(status);
