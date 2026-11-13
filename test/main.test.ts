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

  test("appends this session's commands after the loaded ones", () => {
    fs.writeFileSync(
      histfile,
      "echo initial_command_1\necho initial_command_2\n",
    );
    shell("echo new_command\nexit\n", { HISTFILE: histfile });
    expect(fs.readFileSync(histfile, "utf8")).toBe(
      "echo initial_command_1\necho initial_command_2\n" +
        "echo new_command\nexit\n",
    );
  });

  test("keeps lines another session added to the file meanwhile", () => {
    fs.writeFileSync(histfile, "echo initial\n");
    // Simulates another shell saving its history while this one runs.
    const other = `sh -c 'echo from-other-session >> ${histfile}'`;
    shell(`${other}\nexit\n`, { HISTFILE: histfile });
    expect(fs.readFileSync(histfile, "utf8")).toBe(
      `echo initial\nfrom-other-session\n${other}\nexit\n`,
    );
  });

  test("does not repeat lines already saved with history -a", () => {
    shell(`echo one\nhistory -a ${histfile}\nexit\n`, { HISTFILE: histfile });
    expect(fs.readFileSync(histfile, "utf8")).toBe(
      `echo one\nhistory -a ${histfile}\nexit\n`,
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

describe("parameter expansion", () => {
  test("declared variables expand in commands; unset ones expand to nothing", () => {
    const { stdout } = shell(
      "declare greeting=hello\necho ${greeting}world\necho ${missing}world\n",
    );
    expect(stdout).toContain("helloworld\n");
    expect(stdout).toContain("$ world\n");
  });

  test("expanded values reach external programs as separate arguments", () => {
    const { stdout } = shell(
      "declare a=one\ndeclare b=two\nprintf '[%s]' $a $b\n",
    );
    expect(stdout).toContain("[one][two]");
  });

  test("a bad substitution is reported and the shell keeps running", () => {
    const { stdout, stderr } = shell("echo ${1x}\necho after\n");
    expect(stderr).toContain("${1x}: bad substitution");
    expect(stdout).toContain("after\n");
  });

  test("environment variables expand, and declare changes what children see", () => {
    const { stdout } = shell(
      "echo $CUSTOM_SHELL_E2E\ndeclare CUSTOM_SHELL_E2E=new\nsh -c 'echo child:$CUSTOM_SHELL_E2E'\n",
      { CUSTOM_SHELL_E2E: "old" },
    );
    expect(stdout).toContain("old\n");
    expect(stdout).toContain("child:new\n");
  });

  test("declared shell variables are not passed to children", () => {
    const { stdout } = shell(
      "declare not_exported=x\nsh -c 'echo child:[$not_exported]'\n",
    );
    expect(stdout).toContain("child:[]\n");
  });
});

describe("operators", () => {
  test("quoted operator characters are printed, not interpreted", () => {
    const { stdout } = shell(`echo '|' "&" '>' x\n`);
    expect(stdout).toContain("| & > x\n");
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });

  test("redirects and pipes work without spaces", () => {
    const { stdout } = shell("echo hi>out.txt\necho a|tr a b\n");
    expect(fs.readFileSync(path.join(tmpDir, "out.txt"), "utf8")).toBe("hi\n");
    expect(stdout).toContain("b\n");
  });

  test("a trailing & without a space starts a background job", () => {
    const { stdout } = shell("sleep 0&\n");
    expect(stdout).toMatch(/\[1\] \d+/);
  });

  test("syntax errors are reported and the shell keeps running", () => {
    const { stdout, stderr } = shell("echo >\necho a & echo b\necho after\n");
    expect(stderr).toContain("syntax error near unexpected token `newline'");
    expect(stderr).toContain("syntax error near unexpected token `&'");
    expect(stdout).toContain("after\n");
  });
});
