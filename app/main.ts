import { createInterface } from "readline";
import { spawnSync } from "child_process";
import * as fs from "fs";

import { builtins, type Writer } from "./builtins";
import { findExecutablesByPrefix, findInPath } from "./utils/pathUtils";
import { createCompleter } from "./utils/completer";
import { parseArgs } from "./utils/parseArgs";
import { parseRedirect, type RedirectTarget } from "./utils/redirect";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
  completer: createCompleter(
    (prefix) => [...Object.keys(builtins), ...findExecutablesByPrefix(prefix)],
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
  const { args: tokens, stdout, stderr } = parseRedirect(parseArgs(line));
  const [name, ...args] = tokens;

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
