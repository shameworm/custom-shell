import { describe, expect, test } from "bun:test";

import { parseArgs } from "../../app/utils/parseArgs";

describe("parseArgs", () => {
  test("returns [] for empty and whitespace-only input", () => {
    expect(parseArgs("")).toEqual([]);
    expect(parseArgs("   \t  ")).toEqual([]);
  });

  test("splits on single spaces", () => {
    expect(parseArgs("echo hello")).toEqual(["echo", "hello"]);
  });

  test("collapses runs of whitespace", () => {
    expect(parseArgs("  echo \t hello \n world  ")).toEqual([
      "echo",
      "hello",
      "world",
    ]);
  });

  test("keeps double-quoted content, including spaces", () => {
    expect(parseArgs('echo "hello world"')).toEqual(["echo", "hello world"]);
  });

  test("keeps single-quoted content, including spaces", () => {
    expect(parseArgs("echo 'hello world'")).toEqual(["echo", "hello world"]);
  });

  test("treats opposite quote inside quotes as literal", () => {
    expect(parseArgs(`echo "it's fine"`)).toEqual(["echo", "it's fine"]);
    expect(parseArgs(`echo 'say "hi"'`)).toEqual(["echo", 'say "hi"']);
  });

  test("escapes spaces outside quotes", () => {
    expect(parseArgs("echo hello\\ world")).toEqual(["echo", "hello world"]);
  });

  test("escapes double quotes and backslashes inside double quotes", () => {
    expect(parseArgs('echo "a\\"b"')).toEqual(["echo", 'a"b']);
    expect(parseArgs('echo "a\\\\b"')).toEqual(["echo", "a\\b"]);
  });

  test("does not unescape inside single quotes", () => {
    expect(parseArgs("echo 'a\\'")).toEqual(["echo", "a\\"]);
  });

  test("keeps a trailing backslash literal", () => {
    expect(parseArgs("echo a\\")).toEqual(["echo", "a\\"]);
  });

  test("joins quoted and unquoted parts into one token", () => {
    expect(parseArgs('echo pre"mid dle"post')).toEqual([
      "echo",
      "premid dlepost",
    ]);
  });

  test("preserves empty quoted tokens", () => {
    expect(parseArgs('echo ""')).toEqual(["echo", ""]);
    expect(parseArgs("echo ''")).toEqual(["echo", ""]);
  });

  test("treats an unterminated quote as spanning to end of line", () => {
    expect(parseArgs('echo "unterminated')).toEqual(["echo", "unterminated"]);
    expect(parseArgs("echo 'unterminated")).toEqual(["echo", "unterminated"]);
  });

  test("handles a lone quote", () => {
    expect(parseArgs('"')).toEqual([""]);
  });
});
