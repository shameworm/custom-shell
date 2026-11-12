import { describe, expect, test } from "bun:test";

import { parseRedirect } from "../../app/utils/redirect";

describe("parseRedirect", () => {
  test("returns args unchanged when there is no redirect", () => {
    expect(parseRedirect(["echo", "hi"])).toEqual({ args: ["echo", "hi"] });
  });

  test("extracts > target", () => {
    expect(parseRedirect(["echo", "hello", ">", "out.txt"])).toEqual({
      args: ["echo", "hello"],
      stdout: { file: "out.txt", append: false },
    });
  });

  test("extracts 1> target", () => {
    expect(parseRedirect(["ls", "1>", "out.txt"])).toEqual({
      args: ["ls"],
      stdout: { file: "out.txt", append: false },
    });
  });

  test("extracts >> target in append mode", () => {
    expect(parseRedirect(["echo", "hi", ">>", "out.txt"])).toEqual({
      args: ["echo", "hi"],
      stdout: { file: "out.txt", append: true },
    });
  });

  test("extracts 1>> target in append mode", () => {
    expect(parseRedirect(["ls", "1>>", "out.txt"])).toEqual({
      args: ["ls"],
      stdout: { file: "out.txt", append: true },
    });
  });

  test("last redirect wins", () => {
    expect(parseRedirect(["echo", "a", ">", "x", ">>", "y"]).stdout).toEqual({
      file: "y",
      append: true,
    });
  });

  test("trailing > without a target is kept as an arg", () => {
    expect(parseRedirect(["echo", ">"]).args).toEqual(["echo", ">"]);
  });
});

describe("parseRedirect stderr", () => {
  test("extracts 2> target", () => {
    expect(parseRedirect(["cat", "nope", "2>", "err.txt"])).toEqual({
      args: ["cat", "nope"],
      stderr: { file: "err.txt", append: false },
    });
  });

  test("handles stdout and stderr redirects together", () => {
    expect(parseRedirect(["ls", ">>", "out.txt", "2>", "err.txt"])).toEqual({
      args: ["ls"],
      stdout: { file: "out.txt", append: true },
      stderr: { file: "err.txt", append: false },
    });
  });
});
