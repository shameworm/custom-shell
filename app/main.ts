import { createInterface } from "readline";

import { builtins } from "./builtins";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

rl.prompt();

rl.on("line", (line: string) => {
  const [name, ...args] = line.trim().split(/\s+/);

  if (!name) {
    rl.prompt();
    return;
  }

  const builtin = builtins[name];
  if (builtin) {
    builtin(args);
  } else {
    console.error(`${name}: command not found`);
  }

  rl.prompt();
});
