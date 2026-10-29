import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { changeDirectory, findInPath } from "../../app/utils/pathUtils";

let tmpDir: string;
let originalPath: string | undefined;
let originalCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "shell-test-")),
  );
  originalPath = process.env.PATH;
  originalCwd = process.cwd();
});

afterEach(() => {
  process.env.PATH = originalPath;
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeExecutable(name: string): string {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, "#!/bin/sh\n");
  fs.chmodSync(file, 0o755);
  return file;
}

describe("findInPath", () => {
  test("finds an executable in a PATH directory", () => {
    const file = makeExecutable("mycmd");
    process.env.PATH = tmpDir;

    expect(findInPath("mycmd")).toBe(file);
  });

  test("searches directories in order and returns the first match", () => {
    const first = makeExecutable("dup");
    const otherDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "shell-test-")),
    );
    const second = path.join(otherDir, "dup");
    fs.writeFileSync(second, "#!/bin/sh\n");
    fs.chmodSync(second, 0o755);

    process.env.PATH = [tmpDir, otherDir].join(path.delimiter);

    expect(findInPath("dup")).toBe(first);

    fs.rmSync(otherDir, { recursive: true, force: true });
  });

  test("returns undefined when the command is not on PATH", () => {
    process.env.PATH = tmpDir;
    expect(findInPath("definitely-not-here")).toBeUndefined();
  });

  test("skips non-executable files", () => {
    const file = path.join(tmpDir, "plain");
    fs.writeFileSync(file, "not executable");
    fs.chmodSync(file, 0o644);
    process.env.PATH = tmpDir;

    expect(findInPath("plain")).toBeUndefined();
  });

  test("skips directories with a matching name", () => {
    fs.mkdirSync(path.join(tmpDir, "adir"));
    process.env.PATH = tmpDir;

    expect(findInPath("adir")).toBeUndefined();
  });

  test("returns undefined for an empty PATH", () => {
    process.env.PATH = "";
    expect(findInPath("anything")).toBeUndefined();
  });
});

describe("changeDirectory", () => {
  test("does nothing when no argument is given", () => {
    changeDirectory([]);
    expect(process.cwd()).toBe(originalCwd);
  });

  test("changes to an absolute path", () => {
    changeDirectory([tmpDir]);
    expect(process.cwd()).toBe(tmpDir);
  });

  test("changes to a relative path", () => {
    const sub = path.join(tmpDir, "sub");
    fs.mkdirSync(sub);
    process.chdir(tmpDir);

    changeDirectory(["sub"]);
    expect(process.cwd()).toBe(sub);
  });

  test("expands ~ to the home directory", () => {
    changeDirectory(["~"]);
    expect(process.cwd()).toBe(fs.realpathSync(os.homedir()));
  });

  test("expands ~/ prefixed paths", () => {
    changeDirectory(["~/."]);
    expect(process.cwd()).toBe(fs.realpathSync(os.homedir()));
  });

  test("logs an error and stays put for a missing path", () => {
    const log = spyOn(console, "log").mockImplementation(() => {});

    changeDirectory(["no-such-dir-xyz"]);

    expect(process.cwd()).toBe(originalCwd);
    expect(log).toHaveBeenCalledWith(
      "cd: no-such-dir-xyz: No such file or directory",
    );
    log.mockRestore();
  });

  test("logs an error when the target is a file", () => {
    const file = path.join(tmpDir, "file.txt");
    fs.writeFileSync(file, "x");
    const log = spyOn(console, "log").mockImplementation(() => {});

    changeDirectory([file]);

    expect(process.cwd()).toBe(originalCwd);
    expect(log).toHaveBeenCalledWith(`cd: ${file}: No such file or directory`);
    log.mockRestore();
  });
});
