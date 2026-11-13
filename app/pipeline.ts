import { spawn } from "child_process";
import * as fs from "fs";

import { builtins, type Writer } from "./builtins";
import { exitStatus, NOT_FOUND, runBuiltin } from "./execute";
import { createPipe } from "./utils/osPipe";
import { findInPath } from "./utils/pathUtils";
import { ShellError, ShellSyntaxError, type Token } from "./utils/parseArgs";
import { parseRedirect, type RedirectTarget } from "./utils/redirect";

/** Splits tokens at each | operator into the tokens of each stage. */
export function splitPipeline(tokens: Token[]): Token[][] {
  const stages: Token[][] = [[]];
  for (const token of tokens) {
    if (token.type === "operator" && token.text === "|") stages.push([]);
    else stages.at(-1)!.push(token);
  }
  return stages;
}

// Runs the stages concurrently, each one's stdout connected to the next
// one's stdin through an OS pipe, and resolves once every process has
// exited. The first stage reads the terminal and the last writes to it,
// unless a stage redirects its own output with > or 2>.
//
// Builtins run inside the shell once every process has been started, so
// their output always has a reader. They don't read stdin, so their input
// pipe is closed right away: whatever feeds them gets SIGPIPE, and its
// output is discarded (`ls | type exit` prints only the type line).
// Resolves to the exit status of the last stage, as in bash; 2 for a
// syntax error.
export async function runPipeline(stages: Token[][]): Promise<number> {
  // Check every stage before starting any process.
  let parsed: ReturnType<typeof parseRedirect>[];
  try {
    if (stages.some((stage) => stage.length === 0)) {
      throw new ShellSyntaxError("|");
    }
    parsed = stages.map(parseRedirect);
  } catch (error) {
    if (!(error instanceof ShellError)) throw error;
    console.error(error.message);
    return 2;
  }

  // Each stage's exit status, filled in as stages run and finish.
  const statuses: (number | Promise<number>)[] = [];
  const builtinRuns: (() => void)[] = [];
  let input: number | undefined;

  parsed.forEach(({ args: words, stdout, stderr }, index) => {
    const [name, ...args] = words;
    const pipe = index < stages.length - 1 ? createPipe() : undefined;
    const outFile = openTarget(stdout);
    const errFd = openTarget(stderr);
    const outFd = outFile ?? pipe?.[1];
    const err = errorWriter(errFd);
    if (name !== undefined && builtins[name]) {
      closeAll([input]);
      builtinRuns.push(() => {
        try {
          const out = outFd !== undefined ? fdWriter(outFd) : undefined;
          statuses[index] = runBuiltin(name, args, out, err);
        } finally {
          closeAll([pipe?.[1], outFile, errFd]);
        }
      });
      input = pipe?.[0];
      return;
    }

    if (name !== undefined && findInPath(name)) {
      const child = spawn(name, args, {
        stdio: [input ?? "inherit", outFd ?? "inherit", errFd ?? "inherit"],
      });
      statuses[index] = new Promise((resolve) => {
        child.on("exit", (code, signal) => resolve(exitStatus(code, signal)));
        // Fires after the stage's fds are closed, so report to the shell's stderr.
        child.on("error", (error) => {
          console.error(`${name}: ${error.message}`);
          resolve(NOT_FOUND);
        });
      });
    } else {
      err(`${name}: command not found`);
      statuses[index] = NOT_FOUND;
    }

    // The child has its own copies; the shell must close these so readers
    // see EOF and writers get SIGPIPE when the other side goes away.
    closeAll([input, pipe?.[1], outFile, errFd]);
    input = pipe?.[0];
  });

  for (const run of builtinRuns) run();
  const results = await Promise.all(statuses);
  return results.at(-1) ?? 0;
}

function closeAll(fds: (number | undefined)[]): void {
  for (const fd of fds) if (fd !== undefined) fs.closeSync(fd);
}

// Writes builtin output lines to a pipe or file. If the reader has already
// exited (EPIPE), the rest of the output is dropped, as SIGPIPE would.
function fdWriter(fd: number): Writer {
  let closed = false;
  return (text) => {
    if (closed) return;
    try {
      fs.writeSync(fd, text + "\n");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EPIPE") throw error;
      closed = true;
    }
  };
}

function openTarget(target?: RedirectTarget): number | undefined {
  return target
    ? fs.openSync(target.file, target.append ? "a" : "w")
    : undefined;
}

function errorWriter(fd: number | undefined): Writer {
  return fd !== undefined
    ? (text) => fs.writeSync(fd, text + "\n")
    : (text) => console.error(text);
}
