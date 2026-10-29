import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { builtins } from "../app/builtins";

let tmpDir: string;
let originalPath: string | undefined;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "shell-test-")),
  );
  originalPath = process.env.PATH;
});

afterEach(() => {
  process.env.PATH = originalPath;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function captureLog() {
  return spyOn(console, "log").mockImplementation(() => {});
}

function captureError() {
  return spyOn(console, "error").mockImplementation(() => {});
}

describe("builtins", () => {
  test("exposes the expected command names", () => {
    expect(Object.keys(builtins).sort()).toEqual([
      "cd",
      "clear",
      "echo",
      "exit",
      "pwd",
      "type",
    ]);
  });

  test("exit terminates the process with code 0", () => {
    const exit = spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit called");
    }) as never);

    expect(() => builtins.exit!([])).toThrow("exit called");
    expect(exit).toHaveBeenCalledWith(0);
    exit.mockRestore();
  });

  test("clear clears the console", () => {
    const clear = spyOn(console, "clear").mockImplementation(() => {});

    builtins.clear!([]);

    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });

  test("echo prints its args joined by a space", () => {
    const log = captureLog();

    builtins.echo!(["hello", "world"]);

    expect(log).toHaveBeenCalledWith("hello world");
    log.mockRestore();
  });

  test("echo with no args prints an empty line", () => {
    const log = captureLog();

    builtins.echo!([]);

    expect(log).toHaveBeenCalledWith("");
    log.mockRestore();
  });

  test("pwd prints the current working directory", () => {
    const log = captureLog();

    builtins.pwd!([]);

    expect(log).toHaveBeenCalledWith(process.cwd());
    log.mockRestore();
  });

  test("type reports a builtin", () => {
    const log = captureLog();

    builtins.type!(["cd"]);

    expect(log).toHaveBeenCalledWith("cd is shell builtin command");
    log.mockRestore();
  });

  test("type reports the path of an executable on PATH", () => {
    const file = path.join(tmpDir, "mycmd");
    fs.writeFileSync(file, "#!/bin/sh\n");
    fs.chmodSync(file, 0o755);
    process.env.PATH = tmpDir;
    const log = captureLog();

    builtins.type!(["mycmd"]);

    expect(log).toHaveBeenCalledWith(`mycmd is ${file}`);
    log.mockRestore();
  });

  test("type reports a missing command on stderr", () => {
    process.env.PATH = tmpDir;
    const error = captureError();

    builtins.type!(["nope-not-here"]);

    expect(error).toHaveBeenCalledWith("nope-not-here: not found");
    error.mockRestore();
  });

  test("type with no argument does nothing", () => {
    const log = captureLog();
    const error = captureError();

    builtins.type!([]);

    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    error.mockRestore();
  });

  test("cd delegates to changeDirectory", () => {
    const sub = path.join(tmpDir, "sub");
    fs.mkdirSync(sub);
    const cwd = process.cwd();

    builtins.cd!([sub]);
    expect(process.cwd()).toBe(sub);

    process.chdir(cwd);
  });
});
