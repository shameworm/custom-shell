import * as fs from "fs";

// Commands entered at the prompt, oldest first.
export class History {
  private entries: string[] = [];

  /** Called for each recorded line, e.g. to make it reachable with the arrow keys. */
  onAdd?: (line: string) => void;

  /** Records a line as typed; returns false for blank lines, which are skipped. */
  add(line: string): boolean {
    if (line.trim() === "") return false;
    this.entries.push(line);
    this.onAdd?.(line);
    return true;
  }

  /** Appends each non-blank line of a history file to the history. */
  readFile(path: string): void {
    for (const line of fs.readFileSync(path, "utf8").split("\n")) {
      this.add(line);
    }
  }

  list(): readonly string[] {
    return this.entries;
  }

  // `history` output: each entry with its 1-based number right-aligned in
  // a 5-character column, then two spaces, as bash prints it. With a
  // limit, only the last `limit` entries are shown, keeping their numbers.
  format(limit = this.entries.length): string[] {
    const start = Math.max(0, this.entries.length - limit);
    return this.entries
      .slice(start)
      .map((line, i) => `${String(start + i + 1).padStart(5)}  ${line}`);
  }
}

/** The shell's command history. */
export const history = new History();

// The `history` builtin:
//   history [n]      list the history, or only the last n entries
//   history -r file  read a history file into the history
export function historyBuiltin(
  args: string[],
  out: (line: string) => void,
  err: (line: string) => void,
): void {
  const [arg, path] = args;
  if (arg === "-r") {
    if (path === undefined) {
      err("history: -r: option requires a file argument");
      return;
    }
    try {
      history.readFile(path);
    } catch (error) {
      err(`history: ${path}: ${describe(error)}`);
    }
  } else if (arg === undefined) {
    history.format().forEach(out);
  } else if (/^\d+$/.test(arg)) {
    history.format(Number(arg)).forEach(out);
  } else if (arg.startsWith("-")) {
    err(`history: ${arg}: invalid option`);
  } else {
    err(`history: ${arg}: numeric argument required`);
  }
}

function describe(error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT") return "No such file or directory";
  if (code === "EACCES") return "Permission denied";
  if (code === "EISDIR") return "Is a directory";
  return error instanceof Error ? error.message : String(error);
}
