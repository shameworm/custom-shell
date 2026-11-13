export interface Job {
  /** Job number shown as [n]. */
  id: number;
  pid: number;
  /** The command as typed, without the trailing &. */
  command: string;
  status: "Running";
}

export class JobTable {
  private jobs: Job[] = [];
  private nextId = 1;

  add(pid: number, command: string): Job {
    const job: Job = { id: this.nextId++, pid, command, status: "Running" };
    this.jobs.push(job);
    return job;
  }

  list(): readonly Job[] {
    return this.jobs;
  }

  // The `jobs` builtin listing, oldest job first.
  report(): string[] {
    return this.jobs.map((job) => formatJob(job, this.marker(job)));
  }

  // "+" for the most recent job, "-" for the one before it, " " otherwise.
  private marker(job: Job): string {
    const fromEnd = this.jobs.length - 1 - this.jobs.indexOf(job);
    return fromEnd === 0 ? "+" : fromEnd === 1 ? "-" : " ";
  }
}

// One line of `jobs` output, e.g. "[1]+  Running                 sleep 10 &".
export function formatJob(job: Job, marker: string): string {
  return `[${job.id}]${marker}  ${job.status.padEnd(24)}${job.command} &`;
}

/** The shell's background jobs. */
export const jobTable = new JobTable();

// The command text to remember for a job: the typed line without the
// trailing & and surrounding whitespace.
export function jobCommand(line: string): string {
  return line.trim().replace(/\s*&$/, "");
}
