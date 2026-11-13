import { beforeEach, describe, expect, test } from "bun:test";

import { complete, completionSpecs } from "../app/complete";

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
