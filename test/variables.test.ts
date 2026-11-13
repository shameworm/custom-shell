import { beforeEach, describe, expect, test } from "bun:test";

import { declareBuiltin, isIdentifier, shellVariables } from "../app/variables";

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

describe("identifier validation", () => {
  test("accepts letters, digits and underscores, not starting with a digit", () => {
    for (const name of ["foo", "_FOO", "a1", "_", "Variable_1"]) {
      expect(isIdentifier(name)).toBe(true);
    }
  });

  test("rejects names starting with a digit or containing other characters", () => {
    for (const name of ["67", "1abc", "", "a-b", "a.b", "a b", "é"]) {
      expect(isIdentifier(name)).toBe(false);
    }
  });

  test("declare accepts valid names silently", () => {
    run("foo=bar", "_FOO=BAR");
    expect(err).toEqual([]);
    expect(shellVariables.get("_FOO")).toBe("BAR");
  });

  test("declare reports an invalid name and does not create it", () => {
    run("67=x");
    expect(err).toEqual(["declare: `67=x': not a valid identifier"]);
    expect(shellVariables.has("67")).toBe(false);
  });

  test("declare still sets the valid names around an invalid one", () => {
    run("a=1", "2b=x", "c=3");
    expect(err).toEqual(["declare: `2b=x': not a valid identifier"]);
    expect([...shellVariables.keys()]).toEqual(["a", "c"]);
  });

  test("an invalid name without = is reported too", () => {
    run("9lives");
    expect(err).toEqual(["declare: `9lives': not a valid identifier"]);
  });
});
