import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { parseArgs } from "../app/utils/parseArgs";
import { runPipeline, splitPipeline } from "../app/pipeline";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shell-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Runs a command line as a pipeline and returns what landed in out.txt.
async function run(line: string): Promise<string> {
  const out = path.join(tmpDir, "out.txt");
  await runPipeline(splitPipeline(parseArgs(`${line} > ${out}`)));
  return fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
}

function fixture(name: string, content: string): string {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, content);
  return file;
}

describe("splitPipeline", () => {
  const split = (line: string) =>
    splitPipeline(parseArgs(line)).map((stage) => stage.map((t) => t.text));

  test("splits tokens at each |", () => {
    expect(split("cat f | wc -l")).toEqual([
      ["cat", "f"],
      ["wc", "-l"],
    ]);
  });

  test("returns a single stage when there is no |", () => {
    expect(split("ls")).toEqual([["ls"]]);
  });

  test("keeps empty stages so they can be reported", () => {
    expect(split("ls |")).toEqual([["ls"], []]);
  });

  test("a quoted | does not split", () => {
    expect(split("echo '|' x")).toEqual([["echo", "|", "x"]]);
  });
});

describe("runPipeline with two external commands", () => {
  test("connects the first command's stdout to the second's stdin", async () => {
    const file = fixture("file", "a b\nc d\ne f\n");
    expect((await run(`cat ${file} | wc -l`)).trim()).toBe("3");
  });

  test("ends when the reader exits early (SIGPIPE reaches the writer)", async () => {
    expect(await run("yes | head -n 2")).toBe("y\ny\n");
  });

  test("an unknown command reports an error and feeds EOF downstream", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    expect((await run("nosuchcmd-xyz | wc -l")).trim()).toBe("0");
    expect(error).toHaveBeenCalledWith("nosuchcmd-xyz: command not found");
    error.mockRestore();
  });

  test("a redirect on an earlier stage takes its output out of the pipe", async () => {
    const mid = path.join(tmpDir, "mid.txt");
    const out = await run(`echo hi > ${mid} | wc -l`);
    expect(fs.readFileSync(mid, "utf8")).toBe("hi\n");
    expect(out.trim()).toBe("0");
  });

  test("reports an empty stage as a syntax error", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    await runPipeline(splitPipeline(parseArgs("ls |")));
    expect(error).toHaveBeenCalledWith(
      "syntax error near unexpected token `|'",
    );
    error.mockRestore();
  });
});

describe("runPipeline with builtins", () => {
  test("a builtin first feeds its output to the next command", async () => {
    expect((await run("echo apple-orange | wc -c")).trim()).toBe("13");
  });

  test("a builtin last ignores its input and prints its own output", async () => {
    expect(await run("ls | type exit")).toBe("exit is a shell builtin\n");
  });

  test("a builtin in the middle passes its output on", async () => {
    expect((await run("yes | echo hi | wc -l")).trim()).toBe("1");
  });

  test("builtins can be chained", async () => {
    expect(await run("echo a | echo b")).toBe("b\n");
  });

  test("builtin output is dropped quietly if the reader already exited", async () => {
    expect(await run("type echo | head -n 0")).toBe("");
  });

  test("a builtin's error output goes to its own 2> redirect", async () => {
    const err = path.join(tmpDir, "err.txt");
    await run(`type nosuch-xyz 2> ${err} | wc -l`);
    expect(fs.readFileSync(err, "utf8")).toBe("nosuch-xyz: not found\n");
  });
});

describe("runPipeline with three or more stages", () => {
  test("chains three external commands", async () => {
    const file = fixture("file", "a\nb\nc\nd\ne\n");
    expect((await run(`cat ${file} | head -n 3 | wc -l`)).trim()).toBe("3");
  });

  test("chains four stages", async () => {
    const file = fixture("file", "1\n2\n3\n4\n5\n6\n7\n8\n");
    expect(await run(`cat ${file} | tail -n 5 | head -n 3 | grep 5`)).toBe(
      "5\n",
    );
  });

  test("mixes builtins and external commands across several stages", async () => {
    expect((await run("echo one | cat | tr a-z A-Z | cat")).trim()).toBe("ONE");
  });

  test("ends a long chain whose last stage exits early", async () => {
    expect(await run("yes | cat | cat | head -n 1")).toBe("y\n");
  });
});

describe("runPipeline syntax errors", () => {
  test("a redirect with no file is reported before anything runs", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    const marker = path.join(tmpDir, "should-not-exist");
    await runPipeline(splitPipeline(parseArgs(`touch ${marker} | wc >`)));
    expect(error).toHaveBeenCalledWith(
      "syntax error near unexpected token `newline'",
    );
    expect(fs.existsSync(marker)).toBe(false);
    error.mockRestore();
  });

  test("works without spaces around |", async () => {
    expect((await run("echo a|tr a b")).trim()).toBe("b");
  });
});
