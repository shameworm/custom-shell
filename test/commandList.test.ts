import { describe, expect, test } from "bun:test";

import { listText, parseCommandList } from "../app/commandList";
import { ExpansionError, ShellSyntaxError } from "../app/utils/parseArgs";

const parse = parseCommandList;

describe("parseCommandList", () => {
  test("an empty line has no lists", () => {
    expect(parse("")).toEqual([]);
    expect(parse("   ")).toEqual([]);
  });

  test("a single command is one list, kept as its source text", () => {
    expect(parse(`echo "a  b" $x`)).toEqual([
      { first: `echo "a  b" $x`, rest: [], background: false },
    ]);
  });

  test("; and & separate lists; & marks the one before it as background", () => {
    const lists = parse("a; b & c &");
    expect(lists.map((l) => l.first)).toEqual(["a", "b", "c"]);
    expect(lists.map((l) => l.background)).toEqual([false, true, true]);
  });

  test("a trailing ; is allowed", () => {
    expect(parse("a;")).toHaveLength(1);
  });

  test("&& and || join pipelines into one list", () => {
    const [list] = parse("a | b && c || d");
    expect(list!.first).toBe("a | b");
    expect(list!.rest).toEqual([
      { op: "&&", pipeline: "c" },
      { op: "||", pipeline: "d" },
    ]);
  });

  test("works without spaces around operators", () => {
    const [list] = parse("a&&b||c");
    expect([list!.first, ...list!.rest.map((r) => r.pipeline)]).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("& applies to the whole and-or list before it", () => {
    const [list] = parse("sleep 2 && echo done &");
    expect(list!.background).toBe(true);
    expect(list!.rest).toHaveLength(1);
  });

  test("keeps quoted operator characters inside the command", () => {
    expect(parse(`echo 'a;b' "&&" x`)[0]!.first).toBe(`echo 'a;b' "&&" x`);
  });

  test("keeps redirects, including 2>, in the command's source", () => {
    expect(parse("ls 2>err; echo hi>out")).toMatchObject([
      { first: "ls 2>err" },
      { first: "echo hi>out" },
    ]);
  });

  test("reports an operator with no command before it", () => {
    expect(() => parse("; a")).toThrow(new ShellSyntaxError(";"));
    expect(() => parse("&& a")).toThrow(new ShellSyntaxError("&&"));
    expect(() => parse("a ;; b")).toThrow(new ShellSyntaxError(";"));
    expect(() => parse("a || && b")).toThrow(new ShellSyntaxError("&&"));
  });

  test("reports a line ending in && or ||", () => {
    expect(() => parse("a &&")).toThrow(new ShellSyntaxError("newline"));
    expect(() => parse("a ||")).toThrow(new ShellSyntaxError("newline"));
  });

  test("checks pipelines, redirects and ${...} of every command up front", () => {
    expect(() => parse("echo ok; a | | b")).toThrow(new ShellSyntaxError("|"));
    expect(() => parse("echo ok && echo >")).toThrow(
      new ShellSyntaxError("newline"),
    );
    expect(() => parse("echo ok; echo ${1x}")).toThrow(ExpansionError);
  });
});

describe("listText", () => {
  test("joins each pipeline as typed with its operators", () => {
    const [list] = parse(`sleep 2 && echo "Done sleeping" || echo 'it''s'`);
    expect(listText(list!)).toBe(
      `sleep 2 && echo "Done sleeping" || echo 'it''s'`,
    );
  });
});
