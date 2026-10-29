import { createInterface } from "readline";

import { builtins } from "./builtins";
import { findInPath } from "./utils/pathUtils";
import { spawnSync } from "child_process";
import { parseArgs } from "./utils/parseArgs";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

rl.prompt();

rl.on("line", (line: string) => {
  const [name, ...args] = parseArgs(line);

  if (!name) {
    rl.prompt();
    return;
  }

  const builtin = builtins[name];
  if (builtin) {
    builtin(args);
  } else if (findInPath(name)) {
    spawnSync(name, args, { stdio: "inherit" });
  } else {
    console.error(`${name}: command not found`);
  }

  rl.prompt();
});
