import { beforeEach, describe, expect, test } from "bun:test";

import { declareBuiltin, shellVariables } from "../app/variables";

let out: string[];
let err: string[];

function run(...args: string[]) {
  declareBuiltin(
    args,
    (line) => out.push(line),
    (line) => err.push(line),
  );
}

beforeEach(() => {
  out = [];
  err = [];
  shellVariables.clear();
});

describe("declare -p", () => {
  test("reports a variable that does not exist", () => {
    run("-p", "missing_variable");
    expect(out).toEqual([]);
    expect(err).toEqual(["declare: missing_variable: not found"]);
  });
});

describe("declare NAME=VALUE", () => {
  test("stores a variable that -p prints back", () => {
    run("foo=bar");
    run("-p", "foo");
    expect(out).toEqual(['declare -- foo="bar"']);
    expect(err).toEqual([]);
  });

  test("sets several variables at once", () => {
    run("a=1", "b=2");
    expect(shellVariables.get("a")).toBe("1");
    expect(shellVariables.get("b")).toBe("2");
  });

  test("replaces an existing value", () => {
    run("foo=old");
    run("foo=new");
    expect(shellVariables.get("foo")).toBe("new");
  });

  test("keeps everything after the first = as the value", () => {
    run("url=a=b=c");
    expect(shellVariables.get("url")).toBe("a=b=c");
  });

  test("allows an empty value", () => {
    run("empty=");
    run("-p", "empty");
    expect(out).toEqual(['declare -- empty=""']);
  });

  test("escapes quote, backslash, dollar and backtick in -p output", () => {
    run('v=say "hi" \\ $HOME `x`');
    run("-p", "v");
    expect(out).toEqual(['declare -- v="say \\"hi\\" \\\\ \\$HOME \\`x\\`"']);
  });

  test("-p with no names lists every variable", () => {
    run("a=1", "b=2");
    run("-p");
    expect(out).toEqual(['declare -- a="1"', 'declare -- b="2"']);
  });
});
