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

describe("parseArgs $NAME expansion", () => {
  const vars: Record<string, string> = {
    Variable_1: "value",
    Variable_2: "value2",
    spaced: "a  b",
    padded: "  x  ",
    empty: "",
  };
  const parse = (line: string) => parseArgs(line, (name) => vars[name]);

  test("replaces $NAME with the variable's value", () => {
    expect(parse("echo $Variable_1 $Variable_2")).toEqual([
      "echo",
      "value",
      "value2",
    ]);
  });

  test("joins the value with surrounding text in the same word", () => {
    expect(parse("echo pre$Variable_1")).toEqual(["echo", "prevalue"]);
  });

  test("reads the longest name, so $Variable_1x is the variable Variable_1x", () => {
    expect(parse("echo $Variable_1x")).toEqual(["echo"]);
  });

  test("splits an unquoted value into separate words", () => {
    expect(parse("echo $spaced")).toEqual(["echo", "a", "b"]);
    expect(parse("echo [$padded]")).toEqual(["echo", "[", "x", "]"]);
  });

  test("keeps a double-quoted value as one word, spaces included", () => {
    expect(parse('echo "$spaced"')).toEqual(["echo", "a  b"]);
    expect(parse('echo "<$Variable_1>"')).toEqual(["echo", "<value>"]);
  });

  test("does not expand inside single quotes", () => {
    expect(parse("echo '$Variable_1'")).toEqual(["echo", "$Variable_1"]);
  });

  test("an empty unquoted expansion adds no word; a quoted one adds an empty word", () => {
    expect(parse("echo $empty end")).toEqual(["echo", "end"]);
    expect(parse('echo "$empty" end')).toEqual(["echo", "", "end"]);
  });

  test("a backslash keeps a literal $, outside and inside double quotes", () => {
    expect(parse("echo \\$Variable_1")).toEqual(["echo", "$Variable_1"]);
    expect(parse('echo "\\$Variable_1"')).toEqual(["echo", "$Variable_1"]);
  });

  test("a $ not followed by a name is literal", () => {
    expect(parse("echo $ 5$ $1 a$-b")).toEqual([
      "echo",
      "$",
      "5$",
      "$1",
      "a$-b",
    ]);
  });

  test("does not re-parse quotes or escapes in the value", () => {
    const parseWith = (v: string) => parseArgs("echo $v", () => v);
    expect(parseWith(`"quoted"`)).toEqual(["echo", `"quoted"`]);
    expect(parseWith("back\\slash")).toEqual(["echo", "back\\slash"]);
  });

  test("without a lookup, every variable is unset", () => {
    expect(parseArgs("echo $HOME x")).toEqual(["echo", "x"]);
  });
});
