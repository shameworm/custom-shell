import { createInterface, type Interface } from "readline";
import { spawn, spawnSync } from "child_process";
import * as fs from "fs";

import { builtins, type Writer } from "./builtins";
import { runCompleter } from "./complete";
import { jobCommand, jobTable } from "./jobs";
import {
  findExecutablesByPrefix,
  findInPath,
  findPathCompletions,
} from "./utils/pathUtils";
import { createCompleter } from "./utils/completer";
import { parseArgs } from "./utils/parseArgs";
import { parseRedirect, type RedirectTarget } from "./utils/redirect";

const rl: Interface = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
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

rl.prompt();

rl.on("line", (line: string) => {
  const tokens = parseArgs(line);
  // A trailing & runs the command in the background.
  const background = tokens.at(-1) === "&";
  if (background) tokens.pop();

  const { args: words, stdout, stderr } = parseRedirect(tokens);
  const [name, ...args] = words;

  if (!name) {
    rl.prompt();
    return;
  }

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
        stdio: ["inherit", outFd ?? "inherit", errFd ?? "inherit"],
      });
    } else {
      err(`${name}: command not found`);
    }
  } finally {
    if (outFd !== undefined) fs.closeSync(outFd);
    if (errFd !== undefined) fs.closeSync(errFd);
  }

  rl.prompt();
});

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
    stdio: ["ignore", outFd ?? "inherit", errFd ?? "inherit"],
  });
  child.on("error", (error) => err(`${name}: ${error.message}`));
  if (child.pid === undefined) return;

  const job = jobTable.add(child.pid, command);
  console.log(`[${job.id}] ${job.pid}`);
}
