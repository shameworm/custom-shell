import { createInterface } from "readline";
import { spawnSync } from "child_process";
import * as fs from "fs";

import { builtins, type Writer } from "./builtins";
import { findInPath } from "./utils/pathUtils";
import { parseArgs } from "./utils/parseArgs";
import { parseRedirect } from "./utils/redirect";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

rl.prompt();

rl.on("line", (line: string) => {
  const {
    args: tokens,
    stdoutFile,
    stderrFile,
  } = parseRedirect(parseArgs(line));
  const [name, ...args] = tokens;

  if (!name) {
    rl.prompt();
    return;
  }

  // Create/truncate the target files up front, like a real shell does.
  const outFd =
    stdoutFile !== undefined ? fs.openSync(stdoutFile, "w") : undefined;
  const errFd =
    stderrFile !== undefined ? fs.openSync(stderrFile, "w") : undefined;
  const toFd = (fd: number | undefined): Writer | undefined =>
    fd !== undefined ? (text) => fs.writeSync(fd, text + "\n") : undefined;
  const err: Writer = toFd(errFd) ?? ((text) => console.error(text));

  try {
    const builtin = builtins[name];
    if (builtin) {
      builtin(args, toFd(outFd), err);
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
