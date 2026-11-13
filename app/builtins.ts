import { complete } from "./complete";
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
  // Lists background jobs; implemented once jobs are tracked.
  jobs: () => {},
  type: ([target], out = defaultOut, err = defaultErr) => {
    if (!target) {
      return;
    }

    if (target in builtins) {
      out(`${target} is shell builtin command`);
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
