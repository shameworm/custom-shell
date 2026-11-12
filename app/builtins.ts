import { changeDirectory, findInPath } from "./utils/pathUtils";

export type Writer = (line: string) => void;

const defaultOut: Writer = (line) => console.log(line);

export const builtins: Record<string, (args: string[], out?: Writer) => void> =
  {
    exit: () => process.exit(0),
    clear: () => console.clear(),
    echo: (args, out = defaultOut) => out(args.join(" ")),
    pwd: (_args, out = defaultOut) => out(process.cwd()),
    cd: (args) => changeDirectory(args),
    type: ([target], out = defaultOut) => {
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
        console.error(`${target}: not found`);
      }
    },
  };
