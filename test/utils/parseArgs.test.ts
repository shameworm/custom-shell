import { describe, expect, test } from "bun:test";

import {
  ExpansionError,
  parseArgs,
  type Token,
  type VariableLookup,
} from "../../app/utils/parseArgs";

// The text of each token, for tests that only care about words.
const words = (line: string, lookup?: VariableLookup) =>
  parseArgs(line, lookup).map((t) => t.text);

describe("parseArgs", () => {
  test("returns [] for empty and whitespace-only input", () => {
    expect(words("")).toEqual([]);
    expect(words("   \t  ")).toEqual([]);
  });

  test("splits on single spaces", () => {
    expect(words("echo hello")).toEqual(["echo", "hello"]);
  });

  test("collapses runs of whitespace", () => {
    expect(words("  echo \t hello \n world  ")).toEqual([
      "echo",
      "hello",
      "world",
    ]);
  });

  test("keeps double-quoted content, including spaces", () => {
    expect(words('echo "hello world"')).toEqual(["echo", "hello world"]);
  });

  test("keeps single-quoted content, including spaces", () => {
    expect(words("echo 'hello world'")).toEqual(["echo", "hello world"]);
  });

  test("treats opposite quote inside quotes as literal", () => {
    expect(words(`echo "it's fine"`)).toEqual(["echo", "it's fine"]);
    expect(words(`echo 'say "hi"'`)).toEqual(["echo", 'say "hi"']);
  });

  test("escapes spaces outside quotes", () => {
    expect(words("echo hello\\ world")).toEqual(["echo", "hello world"]);
  });

  test("escapes double quotes and backslashes inside double quotes", () => {
    expect(words('echo "a\\"b"')).toEqual(["echo", 'a"b']);
    expect(words('echo "a\\\\b"')).toEqual(["echo", "a\\b"]);
  });

  test("does not unescape inside single quotes", () => {
    expect(words("echo 'a\\'")).toEqual(["echo", "a\\"]);
  });

  test("keeps a trailing backslash literal", () => {
    expect(words("echo a\\")).toEqual(["echo", "a\\"]);
  });

  test("joins quoted and unquoted parts into one token", () => {
    expect(words('echo pre"mid dle"post')).toEqual(["echo", "premid dlepost"]);
  });

  test("preserves empty quoted tokens", () => {
    expect(words('echo ""')).toEqual(["echo", ""]);
    expect(words("echo ''")).toEqual(["echo", ""]);
  });

  test("treats an unterminated quote as spanning to end of line", () => {
    expect(words('echo "unterminated')).toEqual(["echo", "unterminated"]);
    expect(words("echo 'unterminated")).toEqual(["echo", "unterminated"]);
  });

  test("handles a lone quote", () => {
    expect(words('"')).toEqual([""]);
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
  const parse = (line: string) => words(line, (name) => vars[name]);

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
    const parseWith = (v: string) => words("echo $v", () => v);
    expect(parseWith(`"quoted"`)).toEqual(["echo", `"quoted"`]);
    expect(parseWith("back\\slash")).toEqual(["echo", "back\\slash"]);
  });

  test("without a lookup, every variable is unset", () => {
    expect(words("echo $HOME x")).toEqual(["echo", "x"]);
  });
});

describe("parseArgs ${NAME} expansion", () => {
  const vars: Record<string, string> = { Var1: "foo", Var2: "bar", sp: "a b" };
  const parse = (line: string) => words(line, (name) => vars[name]);

  test("braces mark where the name ends", () => {
    expect(parse("echo ${Var1}end")).toEqual(["echo", "fooend"]);
    expect(parse("echo ${Var1}and${Var2}")).toEqual(["echo", "fooandbar"]);
  });

  test("follows the same quoting rules as $NAME", () => {
    expect(parse('echo "${sp}"')).toEqual(["echo", "a b"]);
    expect(parse("echo ${sp}")).toEqual(["echo", "a", "b"]);
    expect(parse("echo '${Var1}'")).toEqual(["echo", "${Var1}"]);
    expect(parse("echo \\${Var1}")).toEqual(["echo", "${Var1}"]);
  });

  test("reports a bad substitution for an invalid or missing name", () => {
    expect(() => parse("echo ${}")).toThrow(
      new ExpansionError("${}: bad substitution"),
    );
    expect(() => parse("echo ${1x}y")).toThrow(
      new ExpansionError("${1x}: bad substitution"),
    );
    expect(() => parse("echo ${a-b}")).toThrow(ExpansionError);
  });

  test("reports a missing closing brace", () => {
    expect(() => parse("echo ${Var1 x")).toThrow(
      new ExpansionError("${Var1 x: bad substitution"),
    );
  });
});

describe("parseArgs unset variables", () => {
  const parse = (line: string) =>
    words(line, (name) => (name === "greeting" ? "hello" : undefined));

  test("an unset ${NAME} expands to nothing, keeping the text around it", () => {
    expect(parse("echo ${greeting}world")).toEqual(["echo", "helloworld"]);
    expect(parse("echo ${missing}world")).toEqual(["echo", "world"]);
    expect(parse("echo pre${missing}post")).toEqual(["echo", "prepost"]);
  });

  test("an unset $NAME on its own adds no word", () => {
    expect(parse("echo a $missing b")).toEqual(["echo", "a", "b"]);
    expect(parse("echo ${missing}")).toEqual(["echo"]);
  });

  test("an unset variable in double quotes still makes an empty word", () => {
    expect(parse('echo "${missing}" x')).toEqual(["echo", "", "x"]);
  });
});

describe("parseArgs operators", () => {
  const word = (text: string): Token => ({ type: "word", text });
  const op = (text: Token["text"]) => ({ type: "operator", text }) as Token;

  test("marks |, &, > and >> as operators", () => {
    expect(parseArgs("a | b & c > f >> g")).toEqual([
      word("a"),
      op("|"),
      word("b"),
      op("&"),
      word("c"),
      op(">"),
      word("f"),
      op(">>"),
      word("g"),
    ]);
  });

  test("recognises operators without spaces around them", () => {
    expect(parseArgs("cat f|wc")).toEqual([
      word("cat"),
      word("f"),
      op("|"),
      word("wc"),
    ]);
    expect(parseArgs("sleep 1&")).toEqual([word("sleep"), word("1"), op("&")]);
    expect(parseArgs("echo hi>out")).toEqual([
      word("echo"),
      word("hi"),
      op(">"),
      word("out"),
    ]);
  });

  test("a bare 1 or 2 before > names the stream", () => {
    expect(parseArgs("ls 2>err 1>>out")).toEqual([
      word("ls"),
      op("2>"),
      word("err"),
      op("1>>"),
      word("out"),
    ]);
  });

  test("a digit inside a word stays part of it, as in bash", () => {
    expect(parseArgs("echo a2>f")).toEqual([
      word("echo"),
      word("a2"),
      op(">"),
      word("f"),
    ]);
    expect(parseArgs("echo 22>f")).toEqual([
      word("echo"),
      word("22"),
      op(">"),
      word("f"),
    ]);
  });

  test("quoted or escaped operator characters are plain words", () => {
    expect(parseArgs(`echo '|' "&" \\> a'>'b`)).toEqual([
      word("echo"),
      word("|"),
      word("&"),
      word(">"),
      word("a>b"),
    ]);
  });

  test("a quoted digit before > is a word, not a stream number", () => {
    expect(parseArgs(`echo "2">f`)).toEqual([
      word("echo"),
      word("2"),
      op(">"),
      word("f"),
    ]);
  });

  test("operator characters from an expanded variable are plain words", () => {
    expect(parseArgs("echo $v", () => "a | b &")).toEqual([
      word("echo"),
      word("a"),
      word("|"),
      word("b"),
      word("&"),
    ]);
  });

  test("an empty quoted word is still a word", () => {
    expect(parseArgs(`echo "" ''`)).toEqual([word("echo"), word(""), word("")]);
  });

  test("reads && and || as single operators, and ; as one", () => {
    expect(parseArgs("a && b || c ; d")).toEqual([
      word("a"),
      op("&&"),
      word("b"),
      op("||"),
      word("c"),
      op(";"),
      word("d"),
    ]);
    expect(parseArgs("a&&b||c;d")).toEqual([
      word("a"),
      op("&&"),
      word("b"),
      op("||"),
      word("c"),
      op(";"),
      word("d"),
    ]);
  });

  test("keeps | and & single when they are not doubled", () => {
    expect(parseArgs("a | b & c")).toEqual([
      word("a"),
      op("|"),
      word("b"),
      op("&"),
      word("c"),
    ]);
  });

  test("quoted list operators are plain words", () => {
    expect(parseArgs(`echo '&&' "||" \\;`)).toEqual([
      word("echo"),
      word("&&"),
      word("||"),
      word(";"),
    ]);
  });
});
