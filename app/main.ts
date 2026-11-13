import { createInterface, type Interface } from "readline";
import { format } from "util";

import { builtins } from "./builtins";
import { parseCommandList, runCommandList } from "./commandList";
import { runCompleter } from "./complete";
import { history } from "./history";
import { jobTable } from "./jobs";
import { runSubshell } from "./subshell";
import { colorEnabled, fancyPrompt, paint, palette } from "./theme";
import {
  findExecutablesByPrefix,
  findPathCompletions,
} from "./utils/pathUtils";
import { createCompleter } from "./utils/completer";
import { ShellError } from "./utils/parseArgs";

// Started as a subshell for a background list (see subshell.ts): run it
// and exit, without an interactive prompt.
if (process.argv[2] === "--subshell") await runSubshell(process.argv[3]!);

// On a colour terminal the prompt and errors use the theme; otherwise the
// shell looks exactly like bash ("$ " and plain error text).
const fancy = process.stdin.isTTY === true && colorEnabled(process.stdout);

// Bun prints console.error in its own red. Errors use the theme's red
// instead, and stay plain when stderr isn't a colour terminal.
console.error = (...args: unknown[]) => {
  const text = format(...args);
  const colored = colorEnabled(process.stderr)
    ? paint(text, palette.red)
    : text;
  process.stderr.write(colored + "\n");
};

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
        // Directories (listed as name/) get the theme's gold.
        const shown = matches.map((m) =>
          fancy && m.endsWith("/") ? paint(m, palette.softGold) : m,
        );
        process.stdout.write("\n" + shown.join("  ") + "\n");
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

// Interactive use: the shell itself ignores Ctrl-C (SIGINT). At the prompt
// readline reports it as a keypress instead; while a command runs, the
// terminal delivers it to the command, which stops, and the shell carries on.
const interactive = process.stdin.isTTY === true;
if (interactive) process.on("SIGINT", () => {});

// Ctrl-C at the prompt discards the typed line and starts a fresh one.
rl.on("SIGINT", () => {
  rl.write(null, { ctrl: true, name: "e" }); // move to the end of the line
  process.stdout.write("^C\n");
  // Report finished jobs before clearing the line, which redraws the prompt.
  for (const line of jobTable.reap()) console.log(line);
  rl.write(null, { ctrl: true, name: "u" }); // clear the line
  lastStatus = INTERRUPTED; // as in bash, where $? is then 130
  if (fancy) rl.setPrompt(fancyPrompt(lastStatus));
  rl.prompt();
});

// Shows the prompt, first reporting any background jobs that have finished.
// The last command's exit status, shown by the prompt's arrow colour.
let lastStatus = 0;

function prompt() {
  for (const line of jobTable.reap()) console.log(line);
  if (fancy) rl.setPrompt(fancyPrompt(lastStatus));
  rl.prompt();
}

prompt();

/** Exit status of a command stopped by Ctrl-C: 128 + SIGINT (2). */
const INTERRUPTED = 130;

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
  // Readline keeps the terminal in raw mode, where Ctrl-C is just a byte.
  // Commands run with it in normal mode, so Ctrl-C sends them SIGINT.
  if (interactive) process.stdin.setRawMode(false);
  try {
    const status = await runCommandList(parseCommandList(line), line);
    lastStatus = status;
    // The terminal echoes ^C; like bash, end that line before the prompt.
    if (interactive && status === INTERRUPTED) process.stdout.write("\n");
  } catch (error) {
    if (!(error instanceof ShellError)) throw error;
    console.error(error.message);
    lastStatus = 2;
  } finally {
    if (interactive) process.stdin.setRawMode(true);
    rl.resume();
    prompt();
  }
}
