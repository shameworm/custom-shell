import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  colorEnabled,
  displayDir,
  fancyPrompt,
  gitBranch,
  paint,
  palette,
} from "../app/theme";

let tmpDir: string;
let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "shell-test-")),
  );
  savedEnv = { ...process.env };
});

afterEach(() => {
  process.env = savedEnv;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const tty = { isTTY: true } as NodeJS.WriteStream;
const pipe = { isTTY: false } as NodeJS.WriteStream;

describe("colorEnabled", () => {
  test("is on for a terminal and off for a pipe", () => {
    delete process.env.NO_COLOR;
    process.env.TERM = "xterm-256color";
    expect(colorEnabled(tty)).toBe(true);
    expect(colorEnabled(pipe)).toBe(false);
  });

  test("respects NO_COLOR and TERM=dumb", () => {
    process.env.NO_COLOR = "1";
    expect(colorEnabled(tty)).toBe(false);
    delete process.env.NO_COLOR;
    process.env.TERM = "dumb";
    expect(colorEnabled(tty)).toBe(false);
  });
});

describe("paint", () => {
  test("wraps text in a 24-bit colour and resets after it", () => {
    expect(paint("hi", "#F5BF03")).toBe("\x1b[38;2;245;191;3mhi\x1b[0m");
    expect(paint("hi", "#D35F5F", true)).toBe(
      "\x1b[1;38;2;211;95;95mhi\x1b[0m",
    );
  });
});

describe("displayDir", () => {
  test("shows the home directory and paths under it with ~", () => {
    expect(displayDir("/home/me", "/home/me")).toBe("~");
    expect(displayDir("/home/me/code/x", "/home/me")).toBe("~/code/x");
  });

  test("leaves other paths alone, including look-alike prefixes", () => {
    expect(displayDir("/tmp/x", "/home/me")).toBe("/tmp/x");
    expect(displayDir("/home/meadow", "/home/me")).toBe("/home/meadow");
  });
});

describe("gitBranch", () => {
  const makeRepo = (dir: string, head: string) => {
    fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".git", "HEAD"), head);
  };

  test("reads the branch from .git/HEAD, also from a subdirectory", () => {
    makeRepo(tmpDir, "ref: refs/heads/feature/x\n");
    fs.mkdirSync(path.join(tmpDir, "a", "b"), { recursive: true });
    expect(gitBranch(tmpDir)).toBe("feature/x");
    expect(gitBranch(path.join(tmpDir, "a", "b"))).toBe("feature/x");
  });

  test("shows a short commit id when HEAD is detached", () => {
    makeRepo(tmpDir, "0123456789abcdef0123456789abcdef01234567\n");
    expect(gitBranch(tmpDir)).toBe("0123456");
  });

  test("follows a .git file (worktree or submodule)", () => {
    const real = path.join(tmpDir, "real-git");
    fs.mkdirSync(real);
    fs.writeFileSync(path.join(real, "HEAD"), "ref: refs/heads/wt\n");
    const work = path.join(tmpDir, "work");
    fs.mkdirSync(work);
    fs.writeFileSync(path.join(work, ".git"), `gitdir: ${real}\n`);
    expect(gitBranch(work)).toBe("wt");
  });

  test("is undefined outside a repository", () => {
    expect(gitBranch(tmpDir)).toBeUndefined();
  });
});

describe("fancyPrompt", () => {
  test("ends with a gold arrow after success and a red one after failure", () => {
    expect(fancyPrompt(0)).toEndWith(`${paint("❯", palette.gold, true)} `);
    expect(fancyPrompt(1)).toEndWith(`${paint("❯", palette.red, true)} `);
  });
});
