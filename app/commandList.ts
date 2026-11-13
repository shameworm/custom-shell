import * as path from "path";

import { builtins } from "./builtins";
import { runCommand, startSubshellJob } from "./execute";
import { jobCommand } from "./jobs";
import { runPipeline, splitPipeline } from "./pipeline";
import { ShellSyntaxError, type Token } from "./utils/parseArgs";
import { parseRedirect } from "./utils/redirect";

// Pipelines joined by && and ||, e.g. `make && make test || echo failed`.
// `background` is set when the list ends with &.
export interface AndOrList {
  first: Token[];
  rest: { op: "&&" | "||"; pipeline: Token[] }[];
  background: boolean;
}

// Splits a line's tokens into and-or lists separated by ; or &. The whole
// line is checked first, as bash does, so a syntax error anywhere means
// nothing runs: an operator with no command before it, a line ending in
// && or ||, an empty pipeline stage, or a redirect with no file.
export function parseCommandList(tokens: Token[]): AndOrList[] {
  const lists: AndOrList[] = [];
  let pipeline: Token[] = [];
  let list: AndOrList | undefined;
  let pending: "&&" | "||" | undefined;

  const addPipeline = (next: string) => {
    if (pipeline.length === 0) throw new ShellSyntaxError(next);
    checkPipeline(pipeline);
    if (!list) list = { first: pipeline, rest: [], background: false };
    else list.rest.push({ op: pending!, pipeline });
    pipeline = [];
  };

  for (const token of tokens) {
    if (token.type !== "operator") {
      pipeline.push(token);
    } else if (token.text === "&&" || token.text === "||") {
      addPipeline(token.text);
      pending = token.text;
    } else if (token.text === ";" || token.text === "&") {
      addPipeline(token.text);
      list!.background = token.text === "&";
      lists.push(list!);
      list = undefined;
    } else {
      pipeline.push(token);
    }
  }

  if (pipeline.length > 0) {
    addPipeline("newline");
    lists.push(list!);
  } else if (list) {
    // The line ended right after && or ||.
    throw new ShellSyntaxError("newline");
  }
  return lists;
}

// Throws for an empty stage (`a | | b`) or a redirect with no file.
function checkPipeline(tokens: Token[]): void {
  for (const stage of splitPipeline(tokens)) {
    if (stage.length === 0) throw new ShellSyntaxError("|");
    parseRedirect(stage);
  }
}

// Runs the lists in order and resolves to the last exit status. Within an
// and-or list, a pipeline after && runs only if the status so far is 0, and
// one after || only if it isn't; a skipped pipeline keeps the status, so
// `false && a || b` runs b.
export async function runCommandList(
  lists: AndOrList[],
  line: string,
): Promise<number> {
  let status = 0;
  for (const list of lists) {
    // The typed line is the job's name when it holds a single command.
    const jobText = lists.length === 1 ? jobCommand(line) : listText(list);
    status = await runAndOr(list, jobText);
  }
  return status;
}

const SUBSHELL = path.join(import.meta.dir, "subshell.ts");

async function runAndOr(list: AndOrList, jobText: string): Promise<number> {
  if (list.background) {
    // A single external command is started directly, so its own pid is the
    // job's. Anything else (a pipeline, an and-or list, a builtin) runs in
    // a subshell process, as in bash; a builtin like cd then can't affect
    // this shell.
    if (list.rest.length === 0 && !hasPipe(list.first)) {
      const redirect = parseRedirect(list.first);
      const name = redirect.args[0];
      if (name !== undefined && !builtins[name]) {
        return runCommand(redirect, true, jobText);
      }
    }
    startSubshellJob([SUBSHELL, JSON.stringify(list)], jobText);
    return 0;
  }

  let status = await runOne(list.first);
  for (const { op, pipeline } of list.rest) {
    if ((op === "&&") !== (status === 0)) continue;
    status = await runOne(pipeline);
  }
  return status;
}

function runOne(pipeline: Token[]): number | Promise<number> {
  if (hasPipe(pipeline)) return runPipeline(splitPipeline(pipeline));
  return runCommand(parseRedirect(pipeline), false, "");
}

function hasPipe(tokens: Token[]): boolean {
  return tokens.some((t) => t.type === "operator" && t.text === "|");
}

// An and-or list written back out as text, for naming a background job
// when the line held several commands.
export function listText(list: AndOrList): string {
  const parts = [tokensText(list.first)];
  for (const { op, pipeline } of list.rest)
    parts.push(op, tokensText(pipeline));
  return parts.join(" ");
}

function tokensText(tokens: Token[]): string {
  return tokens
    .map((t) =>
      t.type === "operator" || /^[\w@%+=:,./-]+$/.test(t.text)
        ? t.text
        : `'${t.text.replaceAll("'", `'\\''`)}'`,
    )
    .join(" ");
}
