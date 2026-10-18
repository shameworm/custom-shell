export const builtins: Record<string, (args: string[]) => void> = {
  exit: () => process.exit(0),
  echo: (args) => console.log(args.join(" ")),
  pwd: () => console.log(process.cwd()),
  type: ([target]) => {
    if (target! in builtins) {
      console.log(`${target} is shell builtin command`);
      return;
    }

    console.error(`${target}: not found`);
  },
};
