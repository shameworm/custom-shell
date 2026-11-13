import { beforeEach, describe, expect, test } from "bun:test";

import { JobTable, jobCommand } from "../app/jobs";

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
    expect(table.list()).toEqual([{ id: 1, pid: 4242, command: "sleep 10" }]);
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
