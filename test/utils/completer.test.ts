import { beforeEach, describe, expect, test } from "bun:test";

import { type Candidate, createCompleter } from "../../app/utils/completer";

let bells: number;
let listed: string[][];

function makeCompleter(commands: string[], paths: Candidate[] = []) {
  return createCompleter(
    { commands: () => commands, paths: () => paths },
    {
      bell: () => bells++,
      list: (matches) => listed.push(matches),
    },
  );
}

const file = (value: string): Candidate => ({ value, suffix: " " });

let complete: ReturnType<typeof createCompleter>;

beforeEach(() => {
  bells = 0;
  listed = [];
  complete = makeCompleter(["echo", "exit", "cd", "clear", "echo"]);
});

describe("completer", () => {
  test("completes a unique prefix with a trailing space", () => {
    expect(complete("ech")).toEqual([["echo "], "ech"]);
    expect(complete("exi")).toEqual([["exit "], "exi"]);
  });

  test("rings the bell and leaves input unchanged when nothing matches", () => {
    expect(complete("xyz")).toEqual([[], "xyz"]);
    expect(bells).toBe(1);
  });

  test("does not ring the bell on a single match", () => {
    complete("ech");
    expect(bells).toBe(0);
  });

  test("dedupes candidates that appear more than once", () => {
    expect(complete("ech")).toEqual([["echo "], "ech"]);
  });

  test("completes later words from paths, not commands", () => {
    complete = makeCompleter(["exit"], [file("readme.txt")]);
    expect(complete("cat re")).toEqual([["readme.txt "], "re"]);
    expect(complete("cat ex")).toEqual([[], "ex"]);
  });
});

describe("completer with multiple matches", () => {
  beforeEach(() => {
    complete = makeCompleter(["xyz_quz", "xyz_bar", "xyz_baz"]);
  });

  test("first <TAB> rings the bell and leaves input unchanged", () => {
    expect(complete("xyz_")).toEqual([[], "xyz_"]);
    expect(bells).toBe(1);
    expect(listed).toEqual([]);
  });

  test("second <TAB> lists matches in alphabetical order", () => {
    complete("xyz_");
    expect(complete("xyz_")).toEqual([[], "xyz_"]);
    expect(listed).toEqual([["xyz_bar", "xyz_baz", "xyz_quz"]]);
    expect(bells).toBe(1);
  });

  test("changing the input in between resets to ringing the bell", () => {
    complete("xyz_");
    complete("xyz_ba");
    expect(bells).toBe(2);
    expect(listed).toEqual([]);
  });
});

describe("completer longest common prefix", () => {
  beforeEach(() => {
    complete = makeCompleter(["xyz_foo_bar_baz", "xyz_foo", "xyz_foo_bar"]);
  });

  test("extends input to the longest common prefix without a space", () => {
    expect(complete("xyz_")).toEqual([["xyz_foo"], "xyz_"]);
    expect(bells).toBe(0);
  });

  test("completes step by step as the user narrows it down", () => {
    expect(complete("xyz_foo_")).toEqual([["xyz_foo_bar"], "xyz_foo_"]);
    expect(complete("xyz_foo_bar_")).toEqual([
      ["xyz_foo_bar_baz "],
      "xyz_foo_bar_",
    ]);
  });

  test("falls back to bell when the prefix cannot be extended", () => {
    expect(complete("xyz_foo")).toEqual([[], "xyz_foo"]);
    expect(bells).toBe(1);
  });
});

describe("completer filename completion", () => {
  test("completes a file name with a trailing space", () => {
    complete = makeCompleter([], [file("readme.txt"), file("main.ts")]);
    expect(complete("cat re")).toEqual([["readme.txt "], "re"]);
  });

  test("completes the word after the last space", () => {
    complete = makeCompleter([], [file("readme.txt")]);
    expect(complete("echo   hi  re")).toEqual([["readme.txt "], "re"]);
  });

  test("treats leading whitespace as part of the command position", () => {
    complete = makeCompleter(["echo"], [file("echo.txt")]);
    expect(complete("  ech")).toEqual([["echo "], "ech"]);
  });
});
