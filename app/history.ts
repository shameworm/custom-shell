// Commands entered at the prompt, oldest first.
export class History {
  private entries: string[] = [];

  /** Records a line as typed. Blank lines are not recorded. */
  add(line: string): void {
    if (line.trim() !== "") this.entries.push(line);
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

// The `history [n]` builtin.
export function historyBuiltin(
  args: string[],
  out: (line: string) => void,
  err: (line: string) => void,
): void {
  const [arg] = args;
  if (arg === undefined) {
    history.format().forEach(out);
  } else if (/^\d+$/.test(arg)) {
    history.format(Number(arg)).forEach(out);
  } else if (arg.startsWith("-")) {
    err(`history: ${arg}: invalid option`);
  } else {
    err(`history: ${arg}: numeric argument required`);
  }
}
