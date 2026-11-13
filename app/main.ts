import { createInterface, type Interface } from "readline";

import { builtins } from "./builtins";
import { parseCommandList, runCommandList } from "./commandList";
import { runCompleter } from "./complete";
import { history } from "./history";
import { jobTable } from "./jobs";
import {
  findExecutablesByPrefix,
  findPathCompletions,
} from "./utils/pathUtils";
import { createCompleter } from "./utils/completer";
import { parseArgs, ShellError } from "./utils/parseArgs";
import { shellVariables } from "./variables";

const rl: Interface = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
  // Readline's own recording is off (it skips repeated lines and keeps only
  // 30); the arrow keys walk rl.history, which is fed from our History.
  historySize: 0,
  completer: createCompleter(
    {
      commands: (prefix) => [
        ...Object.keys(builtins),
        ...findExecutablesByPrefix(prefix),
      ],
      paths: findPathCompletions,
      // rl.line is the whole input, even if the cursor isn't at the end.
      programmable: (context) => runCompleter(context, rl.line),
    },
    {
      bell: () => process.stdout.write("\x07"),
      list: (matches) => {
        process.stdout.write("\n" + matches.join("  ") + "\n");
        rl.prompt(true);
      },
    },
  ),
});

// The list the arrow keys step through, newest first. Readline has it at
// runtime, but @types/node doesn't declare it.
const arrowHistory = (rl as Interface & { history: string[] }).history;
history.onAdd = (line) => arrowHistory.unshift(line);

// HISTFILE names the file history is loaded from at startup and saved to
// when the shell exits (via exit, Ctrl-D or the end of input). On exit only
// this session's new entries are appended, so lines another session saved
// to the file in the meantime are kept.
const historyFile = process.env.HISTFILE;
if (historyFile) {
  history.loadFile(historyFile);
  process.on("exit", () => {
    try {
      history.appendFile(historyFile);
    } catch (error) {
      console.error(`history: ${historyFile}: ${(error as Error).message}`);
    }
  });
}

// Shows the prompt, first reporting any background jobs that have finished.
function prompt() {
  for (const line of jobTable.reap()) console.log(line);
  rl.prompt();
}

prompt();

// Lines run strictly one after another, even when input arrives faster
// than commands finish (e.g. piped in), because commands can be async.
let queue = Promise.resolve();
rl.on("line", (line: string) => {
  queue = queue.then(() => handleLine(line));
});

async function handleLine(line: string): Promise<void> {
  // Recorded before running, so `history` lists itself.
  history.add(line);
  rl.pause();
  try {
    const tokens = parseArgs(line, (name) => shellVariables.get(name));
    await runCommandList(parseCommandList(tokens), line);
  } catch (error) {
    if (!(error instanceof ShellError)) throw error;
    console.error(error.message);
  } finally {
    rl.resume();
    prompt();
  }
}
