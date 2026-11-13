import { beforeEach, describe, expect, test } from "bun:test";

import { History, history, historyBuiltin } from "../app/history";

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
    expect(h.add("")).toBe(false);
    expect(h.add("   ")).toBe(false);
    expect(h.list()).toEqual([]);
  });

  test("reports whether a line was recorded", () => {
    expect(h.add("ls")).toBe(true);
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

describe("History.format with a limit", () => {
  beforeEach(() => {
    h.add("echo first");
    h.add("echo second");
    h.add("history 2");
  });

  test("shows the last n entries with their original numbers", () => {
    expect(h.format(2)).toEqual(["    2  echo second", "    3  history 2"]);
  });

  test("shows everything when n exceeds the history length", () => {
    expect(h.format(10)).toHaveLength(3);
  });

  test("shows nothing for 0", () => {
    expect(h.format(0)).toEqual([]);
  });
});

describe("history builtin", () => {
  let out: string[];
  let err: string[];
  const run = (...args: string[]) =>
    historyBuiltin(
      args,
      (l) => out.push(l),
      (l) => err.push(l),
    );

  beforeEach(() => {
    out = [];
    err = [];
    history.add("echo one");
    history.add("echo two");
  });

  test("limits output to the last n entries", () => {
    run("1");
    expect(out).toEqual([history.format(1)[0]!]);
  });

  test("rejects a non-numeric argument", () => {
    run("abc");
    expect(out).toEqual([]);
    expect(err).toEqual(["history: abc: numeric argument required"]);
  });

  test("rejects a negative number as an invalid option", () => {
    run("-1");
    expect(err).toEqual(["history: -1: invalid option"]);
  });
});
