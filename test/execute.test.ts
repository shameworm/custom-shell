import { describe, expect, spyOn, test } from "bun:test";

import { exitStatus, NOT_FOUND, runBuiltin, runCommand } from "../app/execute";
import { parseArgs } from "../app/utils/parseArgs";
import { parseRedirect } from "../app/utils/redirect";

const command = (line: string) =>
  runCommand(parseRedirect(parseArgs(line)), false, line);

function quietly<T>(fn: () => T): T {
  const log = spyOn(console, "log").mockImplementation(() => {});
  const error = spyOn(console, "error").mockImplementation(() => {});
  try {
    return fn();
  } finally {
    log.mockRestore();
    error.mockRestore();
  }
}

describe("exitStatus", () => {
  test("uses the exit code when there is one", () => {
    expect(exitStatus(0, null)).toBe(0);
    expect(exitStatus(3, null)).toBe(3);
  });

  test("is 128 plus the signal number for a killed process", () => {
    expect(exitStatus(null, "SIGPIPE")).toBe(141);
    expect(exitStatus(null, "SIGKILL")).toBe(137);
  });
});

describe("runBuiltin", () => {
  test("is 0 when the builtin reports no error", () => {
    expect(quietly(() => runBuiltin("echo", ["hi"], undefined, () => {}))).toBe(
      0,
    );
  });

  test("is 1 when the builtin reports an error, which still reaches err", () => {
    const errors: string[] = [];
    expect(
      runBuiltin(
        "type",
        ["nosuch-xyz"],
        () => {},
        (l) => errors.push(l),
      ),
    ).toBe(1);
    expect(errors).toEqual(["nosuch-xyz: not found"]);
  });
});

describe("runCommand exit status", () => {
  test("is the program's exit code", () => {
    expect(command("true")).toBe(0);
    expect(command("false")).toBe(1);
    expect(command("sh -c 'exit 7'")).toBe(7);
  });

  test("is 127 for an unknown command", () => {
    expect(quietly(() => command("nosuchcmd-xyz"))).toBe(NOT_FOUND);
  });

  test("follows builtins: 0 on success, 1 on error", () => {
    expect(quietly(() => command("echo ok"))).toBe(0);
    expect(quietly(() => command("cd /no/such/dir"))).toBe(1);
  });
});
