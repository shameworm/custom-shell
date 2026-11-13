import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Integration tests: run the real shell with piped input.
const MAIN = path.join(import.meta.dir, "..", "app", "main.ts");

let tmpDir: string;
let histfile: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shell-test-"));
  histfile = path.join(tmpDir, "history");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function shell(input: string, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [MAIN], {
    input,
    cwd: tmpDir,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

describe("HISTFILE", () => {
  test("loads the file on startup", () => {
    fs.writeFileSync(histfile, "echo hello\necho world\n\n");
    const { stdout } = shell("history\n", { HISTFILE: histfile });
    expect(stdout).toContain(
      "    1  echo hello\n    2  echo world\n    3  history\n",
    );
  });

  test("saves the history when the shell exits", () => {
    shell("echo hello\necho world\nexit\n", { HISTFILE: histfile });
    expect(fs.readFileSync(histfile, "utf8")).toBe(
      "echo hello\necho world\nexit\n",
    );
  });

  test("saves the history when input ends without exit", () => {
    shell("echo eof\n", { HISTFILE: histfile });
    expect(fs.readFileSync(histfile, "utf8")).toBe("echo eof\n");
  });

  test("leaves no file behind when HISTFILE is unset", () => {
    const env = { ...process.env };
    delete env.HISTFILE;
    spawnSync(process.execPath, [MAIN], { input: "exit\n", cwd: tmpDir, env });
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });
});
