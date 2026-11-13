import { spawn } from "child_process";
import * as fs from "fs";

import type { Writer } from "./builtins";
import { createPipe } from "./utils/osPipe";
import { findInPath } from "./utils/pathUtils";
import { parseRedirect, type RedirectTarget } from "./utils/redirect";

/** Splits tokens at each `|` into the words of each stage. */
export function splitPipeline(tokens: string[]): string[][] {
  const stages: string[][] = [[]];
  for (const token of tokens) {
    if (token === "|") stages.push([]);
    else stages.at(-1)!.push(token);
  }
  return stages;
}

// Runs the stages concurrently, each one's stdout connected to the next
// one's stdin through an OS pipe, and resolves once every process has
// exited. The first stage reads the terminal and the last writes to it,
// unless a stage redirects its own output with > or 2>.
export async function runPipeline(stages: string[][]): Promise<void> {
  if (stages.some((stage) => stage.length === 0)) {
    console.error("syntax error near unexpected token `|'");
    return;
  }

  const exits: Promise<unknown>[] = [];
  let input: number | undefined;

  stages.forEach((stage, index) => {
    const { args: words, stdout, stderr } = parseRedirect(stage);
    const [name, ...args] = words;
    const pipe = index < stages.length - 1 ? createPipe() : undefined;
    const outFile = openTarget(stdout);
    const errFd = openTarget(stderr);
    const outFd = outFile ?? pipe?.[1];
    const err = errorWriter(errFd);

    if (name !== undefined && findInPath(name)) {
      const child = spawn(name, args, {
        stdio: [input ?? "inherit", outFd ?? "inherit", errFd ?? "inherit"],
      });
      exits.push(
        new Promise((resolve) => {
          child.on("exit", resolve);
          // Fires after the stage's fds are closed, so report to the shell's stderr.
          child.on("error", (error) => {
            console.error(`${name}: ${error.message}`);
            resolve(undefined);
          });
        }),
      );
    } else {
      err(`${name}: command not found`);
    }

    // The child has its own copies; the shell must close these so readers
    // see EOF and writers get SIGPIPE when the other side goes away.
    for (const fd of [input, pipe?.[1], outFile, errFd]) {
      if (fd !== undefined) fs.closeSync(fd);
    }
    input = pipe?.[0];
  });

  await Promise.all(exits);
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
