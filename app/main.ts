import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

rl.prompt();

rl.on("line", (line: string) => {
  const [name] = line.trim().split(/\s+/);

  if (!name) {
    // nothing goes here
  } else {
    console.error(`${name}: command not found`);
  }

  rl.prompt();
});
