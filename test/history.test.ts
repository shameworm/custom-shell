import { beforeEach, describe, expect, test } from "bun:test";

import { History } from "../app/history";

let h: History;

beforeEach(() => {
  h = new History();
});

describe("History", () => {
  test("records lines in order, as typed", () => {
    h.add("echo hello");
    h.add("echo  'spaced'  ");
    expect(h.list()).toEqual(["echo hello", "echo  'spaced'  "]);
  });

  test("skips blank lines", () => {
    h.add("");
    h.add("   ");
    expect(h.list()).toEqual([]);
  });

  test("keeps repeated commands", () => {
    h.add("ls");
    h.add("ls");
    expect(h.list()).toEqual(["ls", "ls"]);
  });

  test("formats entries numbered from 1 in a 5-wide column", () => {
    h.add("echo hello");
    h.add("echo world");
    h.add("invalid_command");
    h.add("history");
    expect(h.format()).toEqual([
      "    1  echo hello",
      "    2  echo world",
      "    3  invalid_command",
      "    4  history",
    ]);
  });

  test("widens the number column past 99999 entries", () => {
    for (let i = 0; i < 100000; i++) h.add("x");
    expect(h.format().at(-1)).toBe("100000  x");
  });
});
