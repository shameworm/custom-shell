import { spawn, spawnSync, type SpawnSyncReturns } from "child_process";
import * as fs from "fs";
import * as os from "os";

import { builtins, type Writer } from "./builtins";
import { jobTable } from "./jobs";
import { findInPath } from "./utils/pathUtils";
import type { Redirect, RedirectTarget } from "./utils/redirect";

/** Exit status for a command that couldn't be found, as in bash. */
export const NOT_FOUND = 127;

// Runs a builtin and returns its exit status: 1 if it reported an error,
// otherwise 0, which is what bash's builtins return in these cases.
export function runBuiltin(
  name: string,
  args: string[],
  out: Writer | undefined,
  err: Writer,
): number {
  let failed = false;
  builtins[name]!(args, out, (line) => {
    failed = true;
    err(line);
  });
  return failed ? 1 : 0;
}

// The exit status of a finished process: its exit code, or 128 plus the
// signal number if a signal ended it, as bash reports it.
export function exitStatus(
  code: number | null,
  signal: NodeJS.Signals | null,
): number {
  if (code !== null) return code;
  return 128 + (signal ? (os.constants.signals[signal] ?? 0) : 0);
}

// Runs one command (a builtin or an external program) and returns its exit
// status. In the background, an external program is started as a job and
// the status is 0.
export function runCommand(
  redirect: Redirect,
  background: boolean,
  jobText: string,
): number {
  const { args: words, stdout, stderr } = redirect;
  const [name, ...args] = words;
  if (!name) return 0;

  // Open the target files up front (create, then truncate or append), like a real shell does.
  const open = (target?: RedirectTarget) =>
    target ? fs.openSync(target.file, target.append ? "a" : "w") : undefined;
  const outFd = open(stdout);
  const errFd = open(stderr);
  const toFd = (fd: number | undefined): Writer | undefined =>
    fd !== undefined ? (text) => fs.writeSync(fd, text + "\n") : undefined;
  const err: Writer = toFd(errFd) ?? ((text) => console.error(text));

  try {
    if (builtins[name]) {
      return runBuiltin(name, args, toFd(outFd), err);
    }
    if (!findInPath(name)) {
      err(`${name}: command not found`);
      return NOT_FOUND;
    }
    if (background) {
      startJob(name, args, jobText, [outFd, errFd]);
      return 0;
    }
    const result: SpawnSyncReturns<Buffer> = spawnSync(name, args, {
      stdio: ["inherit", outFd ?? "inherit", errFd ?? "inherit"],
    });
    return exitStatus(result.status, result.signal);
  } finally {
    if (outFd !== undefined) fs.closeSync(outFd);
    if (errFd !== undefined) fs.closeSync(errFd);
  }
}

// Starts a program without waiting for it, records it as a job named
// `command` and reports its job number and pid. The job writes to the
// shell's terminal unless its output is redirected. It gets no stdin, so
// it can't compete with the prompt for keyboard input.
export function startJob(
  file: string,
  args: string[],
  command: string,
  [outFd, errFd]: [number | undefined, number | undefined] = [
    undefined,
    undefined,
  ],
) {
  const child = spawn(file, args, {
    stdio: ["ignore", outFd ?? "inherit", errFd ?? "inherit"],
  });
  // Reported on the shell's stderr: by now the redirect files are closed.
  child.on("error", (error) => console.error(`${file}: ${error.message}`));
  if (child.pid === undefined) return;

  const job = jobTable.add(child.pid, command);
  child.on("exit", () => jobTable.markDone(job.pid));
  console.log(`[${job.id}] ${job.pid}`);
}
