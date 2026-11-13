import { beforeEach, describe, expect, test } from "bun:test";

import { JobTable, formatJob, jobCommand } from "../app/jobs";

let table: JobTable;

beforeEach(() => {
  table = new JobTable();
});

describe("JobTable.add", () => {
  test("numbers jobs sequentially from 1", () => {
    expect(table.add(100, "sleep 10").id).toBe(1);
    expect(table.add(101, "sleep 20").id).toBe(2);
    expect(table.add(102, "sleep 30").id).toBe(3);
  });

  test("records the pid and command", () => {
    table.add(4242, "sleep 10");
    expect(table.list()).toEqual([
      { id: 1, pid: 4242, command: "sleep 10", status: "Running" },
    ]);
  });
});

describe("jobCommand", () => {
  test("drops the trailing & and surrounding whitespace", () => {
    expect(jobCommand("  sleep 10 &  ")).toBe("sleep 10");
    expect(jobCommand("sleep 10   &")).toBe("sleep 10");
  });

  test("keeps the command as typed, quotes included", () => {
    expect(jobCommand(`echo "a  b" &`)).toBe(`echo "a  b"`);
  });
});

describe("formatJob", () => {
  test("pads the status to 24 characters and appends & for running jobs", () => {
    const job = {
      id: 1,
      pid: 1,
      command: "sleep 10",
      status: "Running" as const,
    };
    expect(formatJob(job, "+")).toBe(
      "[1]+  Running                 sleep 10 &",
    );
  });
});

describe("formatJob for finished jobs", () => {
  test("shows Done without the trailing &", () => {
    const job = { id: 1, pid: 1, command: "sleep 1", status: "Done" as const };
    expect(formatJob(job, "+")).toBe("[1]+  Done                    sleep 1");
  });
});

describe("JobTable.report", () => {
  test("is empty when there are no jobs", () => {
    expect(table.report()).toEqual([]);
  });

  test("marks a single running job with +", () => {
    table.add(100, "sleep 10");
    expect(table.report()).toEqual([
      "[1]+  Running                 sleep 10 &",
    ]);
  });

  test("marks the current job + and the previous job -", () => {
    table.add(100, "sleep 10");
    table.add(101, "sleep 20");
    table.add(102, "sleep 30");
    expect(table.report()).toEqual([
      "[1]   Running                 sleep 10 &",
      "[2]-  Running                 sleep 20 &",
      "[3]+  Running                 sleep 30 &",
    ]);
  });

  test("with two jobs, the older one is -", () => {
    table.add(100, "sleep 10");
    table.add(101, "sleep 20");
    expect(table.report()).toEqual([
      "[1]-  Running                 sleep 10 &",
      "[2]+  Running                 sleep 20 &",
    ]);
  });
});

describe("JobTable reaping", () => {
  test("reports a finished job as Done once, then drops it", () => {
    table.add(100, "sleep 1");
    table.markDone(100);
    expect(table.report()).toEqual(["[1]+  Done                    sleep 1"]);
    expect(table.report()).toEqual([]);
    expect(table.list()).toEqual([]);
  });

  test("ignores pids that are not in the table", () => {
    table.add(100, "sleep 10");
    table.markDone(999);
    expect(table.list()[0]?.status).toBe("Running");
  });

  test("reaps several jobs and recomputes markers afterwards", () => {
    table.add(100, "sleep 100");
    table.add(101, "sleep 5");
    table.add(102, "sleep 6");
    table.markDone(101);
    table.markDone(102);
    expect(table.report()).toEqual([
      "[1]   Running                 sleep 100 &",
      "[2]-  Done                    sleep 5",
      "[3]+  Done                    sleep 6",
    ]);
    expect(table.report()).toEqual([
      "[1]+  Running                 sleep 100 &",
    ]);
  });

  test("keeps running jobs between finished ones", () => {
    table.add(100, "sleep 1");
    table.add(101, "sleep 100");
    table.add(102, "sleep 2");
    table.markDone(100);
    table.markDone(102);
    table.report();
    expect(table.report()).toEqual([
      "[2]+  Running                 sleep 100 &",
    ]);
  });
});
