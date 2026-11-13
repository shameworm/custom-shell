import * as fs from "fs";

// Commands entered at the prompt, oldest first.
export class History {
  private entries: string[] = [];
  /** How many leading entries are already saved to the history file. */
  private saved = 0;

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

  /** Replaces the file's contents with the whole history, one line each. */
  writeFile(path: string): void {
    fs.writeFileSync(path, toFileText(this.entries));
    this.saved = this.entries.length;
  }

  /** Appends the entries not saved yet (by -a or -w) to the file. */
  appendFile(path: string): void {
    fs.appendFileSync(path, toFileText(this.entries.slice(this.saved)));
    this.saved = this.entries.length;
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

function toFileText(lines: readonly string[]): string {
  return lines.map((line) => line + "\n").join("");
}

/** The shell's command history. */
export const history = new History();

// The `history` builtin:
//   history [n]      list the history, or only the last n entries
//   history -r file  read a history file into the history
//   history -w file  write the history to a file, replacing its contents
//   history -a file  append the entries not saved yet to a file
export function historyBuiltin(
  args: string[],
  out: (line: string) => void,
  err: (line: string) => void,
): void {
  const [arg, path] = args;
  const fileAction = arg ? FILE_ACTIONS[arg] : undefined;
  if (fileAction) {
    if (path === undefined) {
      err(`history: ${arg}: option requires a file argument`);
      return;
    }
    try {
      fileAction(path);
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

const FILE_ACTIONS: Record<string, (path: string) => void> = {
  "-r": (path) => history.readFile(path),
  "-w": (path) => history.writeFile(path),
  "-a": (path) => history.appendFile(path),
};

function describe(error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT") return "No such file or directory";
  if (code === "EACCES") return "Permission denied";
  if (code === "EISDIR") return "Is a directory";
  return error instanceof Error ? error.message : String(error);
}
