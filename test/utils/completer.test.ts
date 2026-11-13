import { beforeEach, describe, expect, test } from "bun:test";

import {
  type Candidate,
  type CompletionContext,
  createCompleter,
} from "../../app/utils/completer";

let bells: number;
let listed: string[][];

let scripts: Record<string, (context: CompletionContext) => string[]>;
let contexts: CompletionContext[];

function makeCompleter(commands: string[], paths: Candidate[] = []) {
  return createCompleter(
    {
      commands: () => commands,
      paths: () => paths,
      programmable: (context) => {
        contexts.push(context);
        return scripts[context.command]?.(context);
      },
    },
    {
      bell: () => bells++,
      list: (matches) => listed.push(matches),
    },
  );
}

const basename = (value: string) => value.slice(value.lastIndexOf("/") + 1);
const file = (value: string): Candidate => ({
  value,
  suffix: " ",
  label: basename(value),
});
const dir = (value: string): Candidate => ({
  value,
  suffix: "/",
  label: basename(value) + "/",
});

let complete: ReturnType<typeof createCompleter>;

beforeEach(() => {
  bells = 0;
  listed = [];
  scripts = {};
  contexts = [];
  complete = makeCompleter(["echo", "exit", "cd", "clear", "echo"]);
});

describe("completer", () => {
  test("completes a unique prefix with a trailing space", () => {
    expect(complete("ech")).toEqual([["echo "], "ech"]);
    expect(complete("exi")).toEqual([["exit "], "exi"]);
  });

  test("rings the bell and leaves input unchanged when nothing matches", () => {
    expect(complete("xyz")).toEqual([[], "xyz"]);
    expect(bells).toBe(1);
  });

  test("does not ring the bell on a single match", () => {
    complete("ech");
    expect(bells).toBe(0);
  });

  test("dedupes candidates that appear more than once", () => {
    expect(complete("ech")).toEqual([["echo "], "ech"]);
  });

  test("completes later words from paths, not commands", () => {
    complete = makeCompleter(["exit"], [file("readme.txt")]);
    expect(complete("cat re")).toEqual([["readme.txt "], "re"]);
    expect(complete("cat ex")).toEqual([[], "ex"]);
  });
});

describe("completer with multiple matches", () => {
  beforeEach(() => {
    complete = makeCompleter(["xyz_quz", "xyz_bar", "xyz_baz"]);
  });

  test("first <TAB> rings the bell and leaves input unchanged", () => {
    expect(complete("xyz_")).toEqual([[], "xyz_"]);
    expect(bells).toBe(1);
    expect(listed).toEqual([]);
  });

  test("second <TAB> lists matches in alphabetical order", () => {
    complete("xyz_");
    expect(complete("xyz_")).toEqual([[], "xyz_"]);
    expect(listed).toEqual([["xyz_bar", "xyz_baz", "xyz_quz"]]);
    expect(bells).toBe(1);
  });

  test("changing the input in between resets to ringing the bell", () => {
    complete("xyz_");
    complete("xyz_ba");
    expect(bells).toBe(2);
    expect(listed).toEqual([]);
  });
});

describe("completer longest common prefix", () => {
  beforeEach(() => {
    complete = makeCompleter(["xyz_foo_bar_baz", "xyz_foo", "xyz_foo_bar"]);
  });

  test("extends input to the longest common prefix without a space", () => {
    expect(complete("xyz_")).toEqual([["xyz_foo"], "xyz_"]);
    expect(bells).toBe(0);
  });

  test("completes step by step as the user narrows it down", () => {
    expect(complete("xyz_foo_")).toEqual([["xyz_foo_bar"], "xyz_foo_"]);
    expect(complete("xyz_foo_bar_")).toEqual([
      ["xyz_foo_bar_baz "],
      "xyz_foo_bar_",
    ]);
  });

  test("falls back to bell when the prefix cannot be extended", () => {
    expect(complete("xyz_foo")).toEqual([[], "xyz_foo"]);
    expect(bells).toBe(1);
  });
});

describe("completer filename completion", () => {
  test("completes a file name with a trailing space", () => {
    complete = makeCompleter([], [file("readme.txt"), file("main.ts")]);
    expect(complete("cat re")).toEqual([["readme.txt "], "re"]);
  });

  test("completes the word after the last space", () => {
    complete = makeCompleter([], [file("readme.txt")]);
    expect(complete("echo   hi  re")).toEqual([["readme.txt "], "re"]);
  });

  test("treats leading whitespace as part of the command position", () => {
    complete = makeCompleter(["echo"], [file("echo.txt")]);
    expect(complete("  ech")).toEqual([["echo "], "ech"]);
  });

  test("replaces the whole partial path with the full path", () => {
    complete = makeCompleter([], [file("path/to/file.txt")]);
    expect(complete("cat path/to/f")).toEqual([
      ["path/to/file.txt "],
      "path/to/f",
    ]);
  });

  test("completes a directory with a trailing slash and no space", () => {
    complete = makeCompleter([], [dir("project"), file("readme.txt")]);
    expect(complete("cd proj")).toEqual([["project/"], "proj"]);
  });
});

describe("completer filename edge cases", () => {
  test("rings the bell and leaves input unchanged for a missing entry", () => {
    complete = makeCompleter([], [file("readme.txt")]);
    expect(complete("cat absent_filenam")).toEqual([[], "absent_filenam"]);
    expect(bells).toBe(1);
  });

  test("rings the bell when there are no entries at all", () => {
    complete = makeCompleter([], []);
    expect(complete("cat x")).toEqual([[], "x"]);
    expect(bells).toBe(1);
  });
});

describe("completer filename multiple matches", () => {
  beforeEach(() => {
    complete = makeCompleter([], [dir("foo"), file("bar.txt")]);
  });

  test("first <TAB> rings the bell and leaves input unchanged", () => {
    expect(complete("stat ")).toEqual([[], ""]);
    expect(bells).toBe(1);
    expect(listed).toEqual([]);
  });

  test("second <TAB> lists names alphabetically, directories with a slash", () => {
    complete("stat ");
    complete("stat ");
    expect(listed).toEqual([["bar.txt", "foo/"]]);
  });

  test("lists entry names, not the typed directory path", () => {
    complete = makeCompleter([], [file("src/a.ts"), file("src/b.ts")]);
    complete("cat src/");
    complete("cat src/");
    expect(listed).toEqual([["a.ts", "b.ts"]]);
  });
});

describe("completer filename longest common prefix", () => {
  beforeEach(() => {
    complete = makeCompleter(
      [],
      [dir("xyz_foo"), dir("xyz_foo_bar"), dir("xyz_foo_bar_baz")],
    );
  });

  test("completes step by step, ending with a slash for the directory", () => {
    expect(complete("ls xyz_")).toEqual([["xyz_foo"], "xyz_"]);
    expect(complete("ls xyz_foo_")).toEqual([["xyz_foo_bar"], "xyz_foo_"]);
    expect(complete("ls xyz_foo_bar_")).toEqual([
      ["xyz_foo_bar_baz/"],
      "xyz_foo_bar_",
    ]);
    expect(bells).toBe(0);
  });

  test("extends to a shared prefix of files", () => {
    complete = makeCompleter([], [file("readme.txt"), file("report.txt")]);
    expect(complete("cat r")).toEqual([["re"], "r"]);
  });

  test("rings the bell when matches share nothing beyond the input", () => {
    complete = makeCompleter([], [file("app.py"), file("data.json")]);
    expect(complete("cat ")).toEqual([[], ""]);
    expect(bells).toBe(1);
  });
});

describe("completer in any argument position", () => {
  beforeEach(() => {
    complete = makeCompleter([], [file("foo"), dir("bar")]);
  });

  test("completes each later argument independently", () => {
    expect(complete("ls b")).toEqual([["bar/"], "b"]);
    expect(complete("ls bar/ f")).toEqual([["foo "], "f"]);
  });

  test("rings the bell for an unmatched later argument", () => {
    expect(complete("ls bar/ foo x")).toEqual([[], "x"]);
    expect(bells).toBe(1);
  });
});

describe("completer with a registered completer script", () => {
  test("completes a single candidate with a trailing space", () => {
    scripts.docker = () => ["run"];
    complete = makeCompleter(["docker"], [file("readme.txt")]);
    expect(complete("docker ")).toEqual([["run "], ""]);
  });

  test("uses the script instead of filenames", () => {
    scripts.docker = () => ["run"];
    complete = makeCompleter([], [file("readme.txt")]);
    expect(complete("docker r")).toEqual([["run "], "r"]);
  });

  test("falls back to filenames when no script is registered", () => {
    complete = makeCompleter([], [file("readme.txt")]);
    expect(complete("cat r")).toEqual([["readme.txt "], "r"]);
  });

  test("identifies the command even with leading whitespace", () => {
    scripts.git = () => [];
    complete = makeCompleter([]);
    complete("  git x");
    expect(contexts[0]?.command).toBe("git");
  });

  test("is not consulted for the command word itself", () => {
    scripts.git = () => ["status"];
    complete = makeCompleter(["git"]);
    expect(complete("gi")).toEqual([["git "], "gi"]);
    expect(contexts).toEqual([]);
  });

  test("rings the bell and leaves input unchanged when the script prints nothing", () => {
    scripts.docker = () => [];
    complete = makeCompleter([], [file("xyz.txt")]);
    expect(complete("docker xyz")).toEqual([[], "xyz"]);
    expect(bells).toBe(1);
  });
});
