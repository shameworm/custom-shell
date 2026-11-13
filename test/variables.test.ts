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
