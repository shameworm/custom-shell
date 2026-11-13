// Runs an and-or list in a separate process, the way bash runs a
// background list or pipeline in a subshell: `sleep 2 && echo done &`.
// The list arrives as JSON in argv, already tokenized and expanded by the
// parent shell, and this process exits with the list's status.
import { runCommandList, type AndOrList } from "./commandList";

const list = JSON.parse(process.argv[2]!) as AndOrList;
const status = await runCommandList([{ ...list, background: false }], "");
process.exit(status);
