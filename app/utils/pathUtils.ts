import * as path from "path";
import * as fs from "fs";
import * as os from "os";

import type { Candidate } from "./completer";

export function findInPath(command: string) {
  const directories = (process.env.PATH || "").split(path.delimiter);

  for (const dir of directories) {
    const fullPath = path.join(dir, command);

    try {
      fs.accessSync(fullPath, fs.constants.X_OK);

      if (fs.statSync(fullPath).isFile()) {
        return fullPath;
      }
    } catch {
      continue;
    }
  }
  return;
}

export function changeDirectory(
  args: string[],
  err: (line: string) => void = (line) => console.error(line),
): void {
  const target = args[0];

  if (!target) return;
  const expandedPath =
    target === "~"
      ? os.homedir()
      : target.startsWith("~/")
        ? path.join(os.homedir(), target.slice(2))
        : target;
  const resolvedPath = path.resolve(process.cwd(), expandedPath);

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
    process.chdir(resolvedPath);
  } else {
    err(`cd: ${target}: No such file or directory`);
  }
}

export function findExecutablesByPrefix(prefix: string): string[] {
  const found = new Set<string>();

  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }

    for (const name of entries) {
      if (!name.startsWith(prefix) || found.has(name)) continue;
      const fullPath = path.join(dir, name);
      try {
        fs.accessSync(fullPath, fs.constants.X_OK);
        if (fs.statSync(fullPath).isFile()) found.add(name);
      } catch {
        continue;
      }
    }
  }

  return [...found];
}

// Filesystem entries matching a partially typed path. The word is split at
// its last "/": the part before is the directory to search (the current
// directory if there is none), the part after is the name prefix to match.
// Hidden entries are only offered when the prefix itself starts with a dot.
export function findPathCompletions(word: string): Candidate[] {
  const slash = word.lastIndexOf("/");
  const dir = word.slice(0, slash + 1);
  const prefix = word.slice(slash + 1);

  let entries: string[];
  try {
    entries = fs.readdirSync(dir || ".");
  } catch {
    return [];
  }

  return entries
    .filter((name) => name.startsWith(prefix))
    .filter((name) => prefix.startsWith(".") || !name.startsWith("."))
    .map((name) => ({ value: dir + name, suffix: " " }));
}
