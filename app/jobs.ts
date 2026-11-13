export interface Job {
  /** Job number shown as [n]. */
  id: number;
  pid: number;
  /** The command as typed, without the trailing &. */
  command: string;
}

export class JobTable {
  private jobs: Job[] = [];
  private nextId = 1;

  add(pid: number, command: string): Job {
    const job = { id: this.nextId++, pid, command };
    this.jobs.push(job);
    return job;
  }

  list(): readonly Job[] {
    return this.jobs;
  }
}

/** The shell's background jobs. */
export const jobTable = new JobTable();

// The command text to remember for a job: the typed line without the
// trailing & and surrounding whitespace.
export function jobCommand(line: string): string {
  return line.trim().replace(/\s*&$/, "");
}
