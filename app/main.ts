import { createInterface, type Interface } from "readline";
import { spawn, spawnSync } from "child_process";
import * as fs from "fs";

import { builtins, type Writer } from "./builtins";
import { runCompleter } from "./complete";
import { history } from "./history";
import { jobCommand, jobTable } from "./jobs";
import { runPipeline, splitPipeline } from "./pipeline";
import {
  findExecutablesByPrefix,
  findInPath,
  findPathCompletions,
} from "./utils/pathUtils";
import { createCompleter } from "./utils/completer";
import {
  parseArgs,
  ShellError,
  ShellSyntaxError,
  type Token,
} from "./utils/parseArgs";
import {
  parseRedirect,
  type Redirect,
  type RedirectTarget,
} from "./utils/redirect";
import { lookupVariable } from "./variables";

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

rl.on("line", (line: string) => {
  // Recorded before running, so `history` lists itself.
  history.add(line);

  try {
    const tokens = parseArgs(line, lookupVariable);
    // A trailing & runs the command in the background. An & anywhere else
    // would separate commands, which isn't supported yet.
    const background = isOperator(tokens.at(-1), "&");
    if (background) tokens.pop();
    if (tokens.some((t) => isOperator(t, "&"))) {
      throw new ShellSyntaxError("&");
    }

    if (tokens.some((t) => isOperator(t, "|"))) {
      // Pause input while the pipeline runs, then show the next prompt.
      rl.pause();
      runPipeline(splitPipeline(tokens)).finally(() => {
        rl.resume();
        prompt();
      });
      return;
    }

    run(line, parseRedirect(tokens), background);
  } catch (error) {
    if (!(error instanceof ShellError)) throw error;
    console.error(error.message);
  }
  prompt();
});

function isOperator(token: Token | undefined, text: string): boolean {
  return token?.type === "operator" && token.text === text;
}

// Runs one command (a builtin or an external program), in the background
// if requested.
function run(line: string, redirect: Redirect, background: boolean) {
  const { args: words, stdout, stderr } = redirect;
  const [name, ...args] = words;
  if (!name) return;

  // Open the target files up front (create, then truncate or append), like a real shell does.
  const open = (target?: RedirectTarget) =>
    target ? fs.openSync(target.file, target.append ? "a" : "w") : undefined;
  const outFd = open(stdout);
  const errFd = open(stderr);
  const toFd = (fd: number | undefined): Writer | undefined =>
    fd !== undefined ? (text) => fs.writeSync(fd, text + "\n") : undefined;
  const err: Writer = toFd(errFd) ?? ((text) => console.error(text));

  try {
    const builtin = builtins[name];
    if (builtin) {
      builtin(args, toFd(outFd), err);
    } else if (findInPath(name) && background) {
      startJob(name, args, jobCommand(line), [outFd, errFd], err);
    } else if (findInPath(name)) {
      spawnSync(name, args, {
        // Passed explicitly: Bun doesn't hand later process.env changes
        // (e.g. from declare) to children otherwise.
        env: process.env,
        stdio: ["inherit", outFd ?? "inherit", errFd ?? "inherit"],
      });
    } else {
      err(`${name}: command not found`);
    }
  } finally {
    if (outFd !== undefined) fs.closeSync(outFd);
    if (errFd !== undefined) fs.closeSync(errFd);
  }
}

// Starts an external command without waiting for it, records it as a job and
// reports its job number and pid. The job writes to the shell's terminal
// unless its output is redirected. It gets no stdin, so it can't compete
// with the prompt for keyboard input.
function startJob(
  name: string,
  args: string[],
  command: string,
  [outFd, errFd]: [number | undefined, number | undefined],
  err: Writer,
) {
  const child = spawn(name, args, {
    env: process.env,
    stdio: ["ignore", outFd ?? "inherit", errFd ?? "inherit"],
  });
  child.on("error", (error) => err(`${name}: ${error.message}`));
  if (child.pid === undefined) return;

  const job = jobTable.add(child.pid, command);
  child.on("exit", () => jobTable.markDone(job.pid));
  console.log(`[${job.id}] ${job.pid}`);
}
