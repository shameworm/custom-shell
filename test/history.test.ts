import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { History, history, historyBuiltin } from "../app/history";

let h: History;

beforeEach(() => {
  h = new History();
});

describe("History", () => {
  test("records lines in order, as typed", () => {
    h.add("echo hello");
    h.add("echo  'spaced'  ");
    expect(h.list()).toEqual(["echo hello", "echo  'spaced'  "]);
  });

  test("skips blank lines", () => {
    expect(h.add("")).toBe(false);
    expect(h.add("   ")).toBe(false);
    expect(h.list()).toEqual([]);
  });

  test("reports whether a line was recorded", () => {
    expect(h.add("ls")).toBe(true);
  });

  test("keeps repeated commands", () => {
    h.add("ls");
    h.add("ls");
    expect(h.list()).toEqual(["ls", "ls"]);
  });

  test("formats entries numbered from 1 in a 5-wide column", () => {
    h.add("echo hello");
    h.add("echo world");
    h.add("invalid_command");
    h.add("history");
    expect(h.format()).toEqual([
      "    1  echo hello",
      "    2  echo world",
      "    3  invalid_command",
      "    4  history",
    ]);
  });

  test("widens the number column past 99999 entries", () => {
    for (let i = 0; i < 100000; i++) h.add("x");
    expect(h.format().at(-1)).toBe("100000  x");
  });
});

describe("History.format with a limit", () => {
  beforeEach(() => {
    h.add("echo first");
    h.add("echo second");
    h.add("history 2");
  });

  test("shows the last n entries with their original numbers", () => {
    expect(h.format(2)).toEqual(["    2  echo second", "    3  history 2"]);
  });

  test("shows everything when n exceeds the history length", () => {
    expect(h.format(10)).toHaveLength(3);
  });

  test("shows nothing for 0", () => {
    expect(h.format(0)).toEqual([]);
  });
});

describe("history builtin", () => {
  let out: string[];
  let err: string[];
  const run = (...args: string[]) =>
    historyBuiltin(
      args,
      (l) => out.push(l),
      (l) => err.push(l),
    );

  beforeEach(() => {
    out = [];
    err = [];
    history.add("echo one");
    history.add("echo two");
  });

  test("limits output to the last n entries", () => {
    run("1");
    expect(out).toEqual([history.format(1)[0]!]);
  });

  test("rejects a non-numeric argument", () => {
    run("abc");
    expect(out).toEqual([]);
    expect(err).toEqual(["history: abc: numeric argument required"]);
  });

  test("rejects a negative number as an invalid option", () => {
    run("-1");
    expect(err).toEqual(["history: -1: invalid option"]);
  });
});

describe("history files", () => {
  let tmpDir: string;
  let file: string;
  let out: string[];
  let err: string[];
  const run = (...args: string[]) =>
    historyBuiltin(
      args,
      (l) => out.push(l),
      (l) => err.push(l),
    );

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shell-test-"));
    file = path.join(tmpDir, "history.txt");
    out = [];
    err = [];
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("History.readFile", () => {
    test("appends each line of the file, skipping blank ones", () => {
      fs.writeFileSync(file, "echo hello\necho world\n\n");
      h.add("history -r file");
      h.readFile(file);
      expect(h.format()).toEqual([
        "    1  history -r file",
        "    2  echo hello",
        "    3  echo world",
      ]);
    });

    test("notifies onAdd for each line read", () => {
      fs.writeFileSync(file, "a\nb\n");
      const seen: string[] = [];
      h.onAdd = (line) => seen.push(line);
      h.readFile(file);
      expect(seen).toEqual(["a", "b"]);
    });
  });

  describe("history -r", () => {
    test("reads the file into the shell history", () => {
      fs.writeFileSync(file, "echo from-file-xyz\n");
      run("-r", file);
      expect(history.list().at(-1)).toBe("echo from-file-xyz");
      expect(err).toEqual([]);
    });

    test("reports a missing file", () => {
      run("-r", path.join(tmpDir, "nope"));
      expect(err).toEqual([
        `history: ${path.join(tmpDir, "nope")}: No such file or directory`,
      ]);
    });

    test("reports a missing file argument", () => {
      run("-r");
      expect(err).toEqual(["history: -r: option requires a file argument"]);
    });
  });

  describe("History.writeFile", () => {
    test("writes every entry on its own line with a trailing newline", () => {
      h.add("echo hello");
      h.add("echo world");
      h.add("history -w file");
      h.writeFile(file);
      expect(fs.readFileSync(file, "utf8")).toBe(
        "echo hello\necho world\nhistory -w file\n",
      );
    });

    test("replaces what the file had before", () => {
      fs.writeFileSync(file, "old\n");
      h.add("new");
      h.writeFile(file);
      expect(fs.readFileSync(file, "utf8")).toBe("new\n");
    });
  });

  describe("history -w", () => {
    test("writes the shell history and reports a missing argument", () => {
      run("-w", file);
      expect(fs.readFileSync(file, "utf8")).toBe(
        history
          .list()
          .map((l) => l + "\n")
          .join(""),
      );
      run("-w");
      expect(err).toEqual(["history: -w: option requires a file argument"]);
    });

    test("reports a file it cannot write", () => {
      run("-w", path.join(tmpDir, "missing-dir", "h"));
      expect(err).toEqual([
        `history: ${path.join(tmpDir, "missing-dir", "h")}: No such file or directory`,
      ]);
    });
  });

  describe("History.appendFile", () => {
    test("adds new entries after the file's existing lines", () => {
      fs.writeFileSync(
        file,
        "echo initial_command_1\necho initial_command_2\n",
      );
      h.add("echo new_command");
      h.add("history -a file");
      h.appendFile(file);
      expect(fs.readFileSync(file, "utf8")).toBe(
        "echo initial_command_1\necho initial_command_2\n" +
          "echo new_command\nhistory -a file\n",
      );
    });

    test("only appends entries added since the last append", () => {
      h.add("one");
      h.appendFile(file);
      h.add("two");
      h.appendFile(file);
      expect(fs.readFileSync(file, "utf8")).toBe("one\ntwo\n");
    });

    test("does not re-append entries already written with -w", () => {
      h.add("one");
      h.writeFile(file);
      h.add("two");
      h.appendFile(file);
      expect(fs.readFileSync(file, "utf8")).toBe("one\ntwo\n");
    });

    test("creates the file if needed", () => {
      h.add("one");
      h.appendFile(file);
      expect(fs.readFileSync(file, "utf8")).toBe("one\n");
    });
  });

  describe("History.loadFile", () => {
    test("loads the file's lines into the history", () => {
      fs.writeFileSync(file, "echo hello\necho world\n\n");
      h.loadFile(file);
      expect(h.list()).toEqual(["echo hello", "echo world"]);
    });

    test("treats loaded lines as already saved", () => {
      fs.writeFileSync(file, "echo hello\n");
      h.loadFile(file);
      h.add("echo new");
      h.appendFile(file);
      expect(fs.readFileSync(file, "utf8")).toBe("echo hello\necho new\n");
    });

    test("does nothing when the file does not exist", () => {
      h.loadFile(path.join(tmpDir, "nope"));
      expect(h.list()).toEqual([]);
    });
  });
});
