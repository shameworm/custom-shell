import { beforeEach, describe, expect, test } from "bun:test";

import { complete } from "../app/complete";

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
