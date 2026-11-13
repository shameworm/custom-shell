export interface Job {
  /** Job number shown as [n]. */
  id: number;
  pid: number;
  /** The command as typed, without the trailing &. */
  command: string;
  status: "Running" | "Done";
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

  /** Records that the job's process has exited. */
  markDone(pid: number): void {
    const job = this.jobs.find((j) => j.pid === pid);
    if (job) job.status = "Done";
  }

  // The `jobs` builtin listing, oldest job first. Finished jobs are shown
  // as Done this once and then removed from the table.
  report(): string[] {
    const lines = this.jobs.map((job) => formatJob(job, this.marker(job)));
    this.jobs = this.jobs.filter((job) => job.status !== "Done");
    return lines;
  }

  // Done lines for jobs that finished since the last check, shown before the
  // next prompt. Markers are taken from the whole table, running jobs included,
  // before the finished jobs are removed.
  reap(): string[] {
    const done = this.jobs.filter((job) => job.status === "Done");
    const lines = done.map((job) => formatJob(job, this.marker(job)));
    this.jobs = this.jobs.filter((job) => job.status !== "Done");
    return lines;
  }

  // "+" for the most recent job, "-" for the one before it, " " otherwise.
  private marker(job: Job): string {
    const fromEnd = this.jobs.length - 1 - this.jobs.indexOf(job);
    return fromEnd === 0 ? "+" : fromEnd === 1 ? "-" : " ";
  }
}

// One line of `jobs` output, e.g. "[1]+  Running                 sleep 10 &".
// Like bash, only running jobs show the trailing &.
export function formatJob(job: Job, marker: string): string {
  const suffix = job.status === "Running" ? " &" : "";
  return `[${job.id}]${marker}  ${job.status.padEnd(24)}${job.command}${suffix}`;
}

/** The shell's background jobs. */
export const jobTable = new JobTable();

// The command text to remember for a job: the typed line without the
// trailing & and surrounding whitespace.
export function jobCommand(line: string): string {
  return line.trim().replace(/\s*&$/, "");
}
