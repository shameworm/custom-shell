import { describe, expect, test } from "bun:test";

import { parseRedirect } from "../../app/utils/redirect";

describe("parseRedirect", () => {
  test("returns args unchanged when there is no redirect", () => {
    expect(parseRedirect(["echo", "hi"])).toEqual({
      args: ["echo", "hi"],
      stdoutFile: undefined,
    });
  });

  test("extracts > target", () => {
    expect(parseRedirect(["echo", "hello", ">", "out.txt"])).toEqual({
      args: ["echo", "hello"],
      stdoutFile: "out.txt",
    });
  });

  test("extracts 1> target", () => {
    expect(parseRedirect(["ls", "1>", "out.txt"])).toEqual({
      args: ["ls"],
      stdoutFile: "out.txt",
    });
  });

  test("last redirect wins", () => {
    expect(parseRedirect(["echo", "a", ">", "x", ">", "y"]).stdoutFile).toBe(
      "y",
    );
  });

  test("trailing > without a target is kept as an arg", () => {
    expect(parseRedirect(["echo", ">"]).args).toEqual(["echo", ">"]);
  });
});
