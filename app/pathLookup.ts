import * as path from "path";
import * as fs from "fs";

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
