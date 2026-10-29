import * as path from "path";
import * as fs from "fs";
import * as os from "os";

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

export function changeDirectory(args: string[]): void {
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
    console.log(`cd: ${target}: No such file or directory`);
  }
}
