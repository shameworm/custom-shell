import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  changeDirectory,
  findExecutablesByPrefix,
  findInPath,
  findPathCompletions,
} from "../../app/utils/pathUtils";

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
    const log = spyOn(console, "error").mockImplementation(() => {});

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
    const log = spyOn(console, "error").mockImplementation(() => {});

    changeDirectory([file]);

    expect(process.cwd()).toBe(originalCwd);
    expect(log).toHaveBeenCalledWith(`cd: ${file}: No such file or directory`);
    log.mockRestore();
  });
});

describe("findExecutablesByPrefix", () => {
  test("returns executables whose name starts with the prefix", () => {
    makeExecutable("custom_executable");
    makeExecutable("custom_other");
    makeExecutable("unrelated");
    process.env.PATH = tmpDir;

    expect(findExecutablesByPrefix("custom").sort()).toEqual([
      "custom_executable",
      "custom_other",
    ]);
  });

  test("skips non-executable files and missing directories", () => {
    fs.writeFileSync(path.join(tmpDir, "custom_plain"), "x");
    makeExecutable("custom_exec");
    process.env.PATH = ["/no/such/dir", tmpDir].join(path.delimiter);

    expect(findExecutablesByPrefix("custom")).toEqual(["custom_exec"]);
  });

  test("dedupes names found in several PATH directories", () => {
    makeExecutable("dupcmd");
    const otherDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "shell-test-")),
    );
    fs.writeFileSync(path.join(otherDir, "dupcmd"), "#!/bin/sh\n");
    fs.chmodSync(path.join(otherDir, "dupcmd"), 0o755);
    process.env.PATH = [tmpDir, otherDir].join(path.delimiter);

    expect(findExecutablesByPrefix("dupcmd")).toEqual(["dupcmd"]);
    fs.rmSync(otherDir, { recursive: true, force: true });
  });
});

describe("findPathCompletions", () => {
  test("lists entries in the current directory that start with the word", () => {
    fs.writeFileSync(path.join(tmpDir, "readme.txt"), "");
    fs.writeFileSync(path.join(tmpDir, "report.txt"), "");
    fs.writeFileSync(path.join(tmpDir, "main.ts"), "");
    process.chdir(tmpDir);

    expect(
      findPathCompletions("re")
        .map((c) => c.value)
        .sort(),
    ).toEqual(["readme.txt", "report.txt"]);
  });

  test("completes files with a trailing space", () => {
    fs.writeFileSync(path.join(tmpDir, "readme.txt"), "");
    process.chdir(tmpDir);

    expect(findPathCompletions("re")).toEqual([
      { value: "readme.txt", suffix: " " },
    ]);
  });

  test("hides dotfiles unless the word starts with a dot", () => {
    fs.writeFileSync(path.join(tmpDir, ".env"), "");
    fs.writeFileSync(path.join(tmpDir, "env.ts"), "");
    process.chdir(tmpDir);

    expect(findPathCompletions("").map((c) => c.value)).toEqual(["env.ts"]);
    expect(findPathCompletions(".").map((c) => c.value)).toEqual([".env"]);
  });
});
