import { complete } from "./complete";
import { jobTable } from "./jobs";
import { changeDirectory, findInPath } from "./utils/pathUtils";

export type Writer = (line: string) => void;

const defaultOut: Writer = (line) => console.log(line);
const defaultErr: Writer = (line) => console.error(line);

export type Builtin = (args: string[], out?: Writer, err?: Writer) => void;

export const builtins: Record<string, Builtin> = {
  exit: () => process.exit(0),
  clear: () => console.clear(),
  echo: (args, out = defaultOut) => out(args.join(" ")),
  pwd: (_args, out = defaultOut) => out(process.cwd()),
  cd: (args, _out, err = defaultErr) => changeDirectory(args, err),
  complete: (args, out = defaultOut, err = defaultErr) =>
    complete(args, out, err),
  jobs: (_args, out = defaultOut) => jobTable.report().forEach(out),
  // Lists previously run commands; implemented once commands are recorded.
  history: () => {},
  type: ([target], out = defaultOut, err = defaultErr) => {
    if (!target) {
      return;
    }

    if (target in builtins) {
      out(`${target} is a shell builtin`);
      return;
    }

    const execPath = findInPath(target);
    if (execPath) {
      out(`${target} is ${execPath}`);
    } else {
      err(`${target}: not found`);
    }
  },
};
