import { beforeEach, describe, expect, test } from "bun:test";

import { createCompleter } from "../../app/utils/completer";

let bells: number;
let listed: string[][];

function makeCompleter(candidates: string[]) {
  return createCompleter(() => candidates, {
    bell: () => bells++,
    list: (matches) => listed.push(matches),
  });
}

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

  test("does not complete arguments", () => {
    expect(complete("echo ex")).toEqual([[], "echo ex"]);
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
    complete("xyz_b");
    expect(bells).toBe(2);
    expect(listed).toEqual([]);
  });
});
