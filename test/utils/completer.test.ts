import { beforeEach, describe, expect, test } from "bun:test";

import { createCompleter } from "../../app/utils/completer";

let bells = 0;
const complete = createCompleter(["echo", "exit", "cd", "clear"], {
  bell: () => bells++,
});

beforeEach(() => {
  bells = 0;
});

describe("completer", () => {
  test("completes a unique prefix with a trailing space", () => {
    expect(complete("ech")).toEqual([["echo "], "ech"]);
    expect(complete("exi")).toEqual([["exit "], "exi"]);
  });

  test("returns all matches for an ambiguous prefix", () => {
    expect(complete("e")).toEqual([["echo ", "exit "], "e"]);
  });

  test("rings the bell and leaves input unchanged when nothing matches", () => {
    expect(complete("xyz")).toEqual([[], "xyz"]);
    expect(bells).toBe(1);
  });

  test("does not ring the bell on a match", () => {
    complete("ech");
    expect(bells).toBe(0);
  });

  test("does not complete arguments", () => {
    expect(complete("echo ex")).toEqual([[], "echo ex"]);
  });
});
