import { describe, expect, test } from "bun:test";

import { createCompleter } from "../../app/utils/completer";

const complete = createCompleter(["echo", "exit", "cd", "clear"]);

describe("completer", () => {
  test("completes a unique prefix with a trailing space", () => {
    expect(complete("ech")).toEqual([["echo "], "ech"]);
    expect(complete("exi")).toEqual([["exit "], "exi"]);
  });

  test("returns all matches for an ambiguous prefix", () => {
    expect(complete("e")).toEqual([["echo ", "exit "], "e"]);
  });

  test("returns no hits when nothing matches", () => {
    expect(complete("xyz")).toEqual([[], "xyz"]);
  });

  test("does not complete arguments", () => {
    expect(complete("echo ex")).toEqual([[], "echo ex"]);
  });
});
