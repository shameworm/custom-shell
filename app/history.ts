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
  // a 5-character column, then two spaces, as bash prints it.
  format(): string[] {
    return this.entries.map(
      (line, index) => `${String(index + 1).padStart(5)}  ${line}`,
    );
  }
}

/** The shell's command history. */
export const history = new History();
