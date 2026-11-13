import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { complete, completionSpecs, runCompleter } from "../app/complete";

let out: string[];
let err: string[];

function run(...args: string[]) {
  complete(
    args,
    (line) => out.push(line),
    (line) => err.push(line),
  );
}

beforeEach(() => {
  out = [];
  err = [];
  completionSpecs.clear();
});

describe("complete -p", () => {
  test("reports a missing specification on stderr", () => {
    run("-p", "git");
    expect(out).toEqual([]);
    expect(err).toEqual(["complete: git: no completion specification"]);
  });

  test("reports each name separately", () => {
    run("-p", "git", "docker");
    expect(err).toEqual([
      "complete: git: no completion specification",
      "complete: docker: no completion specification",
    ]);
  });
});

describe("complete -C", () => {
  test("registers a script that -p prints back in normalized form", () => {
    run("-C", "/path/to/git/completer", "git");
    run("-p", "git");
    expect(out).toEqual(["complete -C '/path/to/git/completer' git"]);
    expect(err).toEqual([]);
  });

  test("keeps separate specs per command", () => {
    run("-C", "/path/to/git/completer", "git");
    run("-C", "/path/to/docker/completer", "docker");
    run("-p", "docker");
    expect(out).toEqual(["complete -C '/path/to/docker/completer' docker"]);
  });

  test("registers the same script for several names at once", () => {
    run("-C", "/c", "git", "hub");
    expect(completionSpecs.get("git")).toBe("/c");
    expect(completionSpecs.get("hub")).toBe("/c");
  });

  test("re-registering replaces the previous script", () => {
    run("-C", "/old", "git");
    run("-C", "/new", "git");
    expect(completionSpecs.get("git")).toBe("/new");
  });

  test("escapes single quotes in the printed script path", () => {
    run("-C", "/it's/here", "git");
    run("-p", "git");
    expect(out).toEqual([`complete -C '/it'\\''s/here' git`]);
  });

  test("reports usage when the script or name is missing", () => {
    run("-C", "/c");
    expect(err).toEqual(["complete: usage: complete -C <script> <name>..."]);
    expect(completionSpecs.size).toBe(0);
  });
});

describe("complete -r", () => {
  test("removes a spec silently", () => {
    run("-C", "/g", "git");
    run("-r", "git");
    expect(out).toEqual([]);
    expect(err).toEqual([]);
    expect(completionSpecs.has("git")).toBe(false);
  });

  test("leaves other specs in place", () => {
    run("-C", "/g", "git");
    run("-C", "/d", "docker");
    run("-r", "git");
    expect([...completionSpecs.keys()]).toEqual(["docker"]);
  });

  test("reports names that have no spec", () => {
    run("-r", "git");
    expect(err).toEqual(["complete: git: no completion specification"]);
  });

  test("with no names removes every spec", () => {
    run("-C", "/g", "git");
    run("-C", "/d", "docker");
    run("-r");
    expect(completionSpecs.size).toBe(0);
    expect(err).toEqual([]);
  });
});

describe("complete without names", () => {
  test("-p with no names prints every spec", () => {
    run("-C", "/g", "git");
    run("-C", "/d", "docker");
    run("-p");
    expect(out).toEqual(["complete -C '/g' git", "complete -C '/d' docker"]);
  });

  test("bare complete behaves like complete -p", () => {
    run("-C", "/g", "git");
    run();
    expect(out).toEqual(["complete -C '/g' git"]);
  });

  test("rejects unknown options", () => {
    run("-z", "git");
    expect(err).toEqual(["complete: -z: invalid option"]);
  });
});

describe("runCompleter", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shell-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function script(name: string, body: string): string {
    const file = path.join(tmpDir, name);
    fs.writeFileSync(file, `#!/bin/sh\n${body}\n`);
    fs.chmodSync(file, 0o755);
    return file;
  }

  const context = {
    command: "docker",
    word: "",
    previous: "docker",
    line: "docker ",
  };

  test("returns undefined when no script is registered", () => {
    expect(runCompleter(context)).toBeUndefined();
  });

  test("returns the script's stdout lines", () => {
    completionSpecs.set("docker", script("c", "echo run"));
    expect(runCompleter(context)).toEqual(["run"]);
  });

  test("returns no candidates when the script cannot be run", () => {
    completionSpecs.set("docker", path.join(tmpDir, "missing"));
    expect(runCompleter(context)).toEqual([]);
  });

  test("returns no candidates when the script prints nothing", () => {
    completionSpecs.set("docker", script("c", "exit 0"));
    expect(runCompleter(context)).toEqual([]);
  });

  test("passes the command, current word and previous word as arguments", () => {
    completionSpecs.set("git", script("c", `printf '%s|' "$1" "$2" "$3"`));
    expect(
      runCompleter({
        command: "git",
        word: "set",
        previous: "remote",
        line: "git remote set",
      }),
    ).toEqual(["git|set|remote|"]);
  });

  test("passes an empty previous word as an empty argument", () => {
    completionSpecs.set("git", script("c", `echo "$#:[$3]"`));
    expect(
      runCompleter({ command: "git", word: "x", previous: "", line: "git x" }),
    ).toEqual(["3:[]"]);
  });

  test("sets COMP_LINE and COMP_POINT for the cursor at the end", () => {
    completionSpecs.set("git", script("c", `echo "$COMP_LINE|$COMP_POINT"`));
    expect(
      runCompleter({
        command: "git",
        word: "ad",
        previous: "git",
        line: "git ad",
      }),
    ).toEqual(["git ad|6"]);
  });

  test("uses the full line and the cursor offset when they differ", () => {
    completionSpecs.set("git", script("c", `echo "$COMP_LINE|$COMP_POINT"`));
    expect(
      runCompleter(
        { command: "git", word: "ad", previous: "git", line: "git ad" },
        "git ad --force",
      ),
    ).toEqual(["git ad --force|6"]);
  });

  test("counts COMP_POINT in bytes, not characters", () => {
    completionSpecs.set("echo", script("c", `echo "$COMP_POINT"`));
    expect(
      runCompleter({
        command: "echo",
        word: "é",
        previous: "echo",
        line: "echo é",
      }),
    ).toEqual(["7"]);
  });
});
