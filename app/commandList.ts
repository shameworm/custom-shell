import * as path from "path";

import { builtins } from "./builtins";
import { runCommand, startSubshellJob } from "./execute";
import { jobCommand } from "./jobs";
import { runPipeline, splitPipeline } from "./pipeline";
import { parseArgs, ShellSyntaxError, type Token } from "./utils/parseArgs";
import { parseRedirect } from "./utils/redirect";
import { lookupVariable, shellVariables } from "./variables";

// Pipelines joined by && and ||, e.g. `make && make test || echo failed`,
// each kept as its source text: like bash, a command is expanded only when
// it's about to run, so `declare x=1; echo $x` sees the new value.
// `background` is set when the list ends with &.
export interface AndOrList {
  first: string;
  rest: { op: "&&" | "||"; pipeline: string }[];
  background: boolean;
}

// Splits a line into and-or lists separated by ; or &. The whole line is
// checked first, as bash does, so a syntax error anywhere means nothing
// runs: an operator with no command before it, a line ending in && or ||,
// an empty pipeline stage, a redirect with no file, or a bad ${...}.
export function parseCommandList(line: string): AndOrList[] {
  // Variables are left as written ($NAME) here: this pass only finds the
  // structure, which expansion can't change (values never become operators).
  const positions: { start: number; end: number }[] = [];
  const tokens = parseArgs(line, (name) => `$${name}`, positions);

  const lists: AndOrList[] = [];
  let pipelineStart = 0;
  let list: AndOrList | undefined;
  let pending: "&&" | "||" | undefined;

  // Ends the pipeline made of tokens[pipelineStart..end), at an operator
  // (or the end of the line) whose text is `next`.
  const addPipeline = (end: number, next: string) => {
    if (end === pipelineStart) throw new ShellSyntaxError(next);
    checkPipeline(tokens.slice(pipelineStart, end));
    const source = line.slice(
      positions[pipelineStart]!.start,
      positions[end - 1]!.end,
    );
    if (!list) list = { first: source, rest: [], background: false };
    else list.rest.push({ op: pending!, pipeline: source });
  };

  tokens.forEach((token, index) => {
    if (token.type !== "operator") return;
    if (token.text === "&&" || token.text === "||") {
      addPipeline(index, token.text);
      pending = token.text;
    } else if (token.text === ";" || token.text === "&") {
      addPipeline(index, token.text);
      list!.background = token.text === "&";
      lists.push(list!);
      list = undefined;
    } else {
      return; // | and redirects belong to the pipeline
    }
    pipelineStart = index + 1;
  });

  if (pipelineStart < tokens.length) {
    addPipeline(tokens.length, "newline");
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

/** What a subshell process receives: the list and this shell's variables. */
export interface SubshellInput {
  list: AndOrList;
  variables: [string, string][];
}

async function runAndOr(list: AndOrList, jobText: string): Promise<number> {
  if (list.background) {
    // A single external command is started directly, so its own pid is the
    // job's. Anything else (a pipeline, an and-or list, a builtin) runs in
    // a subshell process, as in bash; a builtin like cd then can't affect
    // this shell. The subshell gets a copy of the variables, as in bash.
    if (list.rest.length === 0) {
      const tokens = parseArgs(list.first, lookupVariable);
      const name = tokens[0]?.text;
      if (!hasPipe(tokens) && name !== undefined && !builtins[name]) {
        return runCommand(parseRedirect(tokens), true, jobText);
      }
    }
    const input: SubshellInput = { list, variables: [...shellVariables] };
    startSubshellJob([SUBSHELL, JSON.stringify(input)], jobText);
    return 0;
  }

  let status = await runOne(list.first);
  for (const { op, pipeline } of list.rest) {
    if ((op === "&&") !== (status === 0)) continue;
    status = await runOne(pipeline);
  }
  return status;
}

// Expands one pipeline's source text, now, and runs it.
function runOne(source: string): number | Promise<number> {
  const tokens = parseArgs(source, lookupVariable);
  if (hasPipe(tokens)) return runPipeline(splitPipeline(tokens));
  return runCommand(parseRedirect(tokens), false, "");
}

function hasPipe(tokens: Token[]): boolean {
  return tokens.some((t) => t.type === "operator" && t.text === "|");
}

// An and-or list as text, for naming a background job when the line held
// several commands: each pipeline as typed, joined by its operators.
export function listText(list: AndOrList): string {
  const parts = [list.first];
  for (const { op, pipeline } of list.rest) parts.push(op, pipeline);
  return parts.join(" ");
}
