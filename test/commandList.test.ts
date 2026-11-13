import { describe, expect, test } from "bun:test";

import { listText, parseCommandList } from "../app/commandList";
import { parseArgs, ShellSyntaxError } from "../app/utils/parseArgs";

const parse = (line: string) => parseCommandList(parseArgs(line));
const texts = (tokens: { text: string }[]) => tokens.map((t) => t.text);

describe("parseCommandList", () => {
  test("an empty line has no lists", () => {
    expect(parse("")).toEqual([]);
  });

  test("a single command is one list", () => {
    const [list] = parse("echo hi");
    expect(texts(list!.first)).toEqual(["echo", "hi"]);
    expect(list!.rest).toEqual([]);
    expect(list!.background).toBe(false);
  });

  test("; and & separate lists; & marks the one before it as background", () => {
    const lists = parse("a; b & c &");
    expect(lists.map((l) => texts(l.first))).toEqual([["a"], ["b"], ["c"]]);
    expect(lists.map((l) => l.background)).toEqual([false, true, true]);
  });

  test("a trailing ; is allowed", () => {
    expect(parse("a;")).toHaveLength(1);
  });

  test("&& and || join pipelines into one list", () => {
    const [list] = parse("a | b && c || d");
    expect(texts(list!.first)).toEqual(["a", "|", "b"]);
    expect(list!.rest.map((r) => [r.op, texts(r.pipeline)])).toEqual([
      ["&&", ["c"]],
      ["||", ["d"]],
    ]);
  });

  test("& applies to the whole and-or list before it", () => {
    const [list] = parse("sleep 2 && echo done &");
    expect(list!.background).toBe(true);
    expect(list!.rest).toHaveLength(1);
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

  test("checks pipelines and redirects of every command up front", () => {
    expect(() => parse("echo ok; a | | b")).toThrow(new ShellSyntaxError("|"));
    expect(() => parse("echo ok && echo >")).toThrow(
      new ShellSyntaxError("newline"),
    );
  });
});

describe("listText", () => {
  test("writes a list back out, quoting words that need it", () => {
    const [list] = parse(
      `sleep 2 && echo "Done sleeping" || echo it's`.replace("it's", `"it's"`),
    );
    expect(listText(list!)).toBe(
      `sleep 2 && echo 'Done sleeping' || echo 'it'\\''s'`,
    );
  });
});
