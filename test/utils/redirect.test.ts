import { describe, expect, test } from "bun:test";

import { parseArgs, ShellSyntaxError } from "../../app/utils/parseArgs";
import { parseRedirect } from "../../app/utils/redirect";

const parse = (line: string) => parseRedirect(parseArgs(line));

describe("parseRedirect", () => {
  test("returns args unchanged when there is no redirect", () => {
    expect(parse("echo hi")).toEqual({ args: ["echo", "hi"] });
  });

  test("extracts > and 1> targets", () => {
    expect(parse("echo hello > out.txt")).toEqual({
      args: ["echo", "hello"],
      stdout: { file: "out.txt", append: false },
    });
    expect(parse("ls 1> out.txt").stdout).toEqual({
      file: "out.txt",
      append: false,
    });
  });

  test("extracts >> and 1>> targets in append mode", () => {
    expect(parse("echo hi >> out.txt").stdout).toEqual({
      file: "out.txt",
      append: true,
    });
    expect(parse("ls 1>> out.txt").stdout).toEqual({
      file: "out.txt",
      append: true,
    });
  });

  test("extracts 2> and 2>> targets", () => {
    expect(parse("cat nope 2> err.txt")).toEqual({
      args: ["cat", "nope"],
      stderr: { file: "err.txt", append: false },
    });
    expect(parse("cat nope 2>> err.txt").stderr).toEqual({
      file: "err.txt",
      append: true,
    });
  });

  test("handles stdout and stderr redirects together, without spaces", () => {
    expect(parse("ls >>out.txt 2>err.txt")).toEqual({
      args: ["ls"],
      stdout: { file: "out.txt", append: true },
      stderr: { file: "err.txt", append: false },
    });
  });

  test("last redirect wins", () => {
    expect(parse("echo a > x >> y").stdout).toEqual({
      file: "y",
      append: true,
    });
  });

  test("a quoted > is an ordinary argument", () => {
    expect(parse("echo '>' x")).toEqual({ args: ["echo", ">", "x"] });
  });

  test("a redirect with no file is a syntax error", () => {
    expect(() => parse("echo >")).toThrow(new ShellSyntaxError("newline"));
    expect(() => parse("echo > > f")).toThrow(new ShellSyntaxError(">"));
  });
});
