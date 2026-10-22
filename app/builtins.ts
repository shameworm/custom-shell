import { changeDirectory, findInPath } from "./pathUtils";

export const builtins: Record<string, (args: string[]) => void> = {
  exit: () => process.exit(0),
  echo: (args) => console.log(args.join(" ")),
  pwd: () => console.log(process.cwd()),
  cd: (args) => changeDirectory(args),
  type: ([target]) => {
    if (!target) {
      return;
    }

    if (target in builtins) {
      console.log(`${target} is shell builtin command`);
      return;
    }

    const execPath = findInPath(target);
    if (execPath) {
      console.log(`${target} is ${execPath}`);
    } else {
      console.error(`${target}: not found`);
    }
  },
};
