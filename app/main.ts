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
  const { args: tokens, stdoutFile } = parseRedirect(parseArgs(line));
  const [name, ...args] = tokens;

  if (!name) {
    rl.prompt();
    return;
  }

  // Create/truncate the target file up front, like a real shell does.
  const fd = stdoutFile !== undefined ? fs.openSync(stdoutFile, "w") : undefined;

  try {
    const builtin = builtins[name];
    if (builtin) {
      const out: Writer | undefined =
        fd !== undefined ? (text) => fs.writeSync(fd, text + "\n") : undefined;
      builtin(args, out);
    } else if (findInPath(name)) {
      spawnSync(name, args, {
        stdio: ["inherit", fd ?? "inherit", "inherit"],
      });
    } else {
      console.error(`${name}: command not found`);
    }
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }

  rl.prompt();
});
