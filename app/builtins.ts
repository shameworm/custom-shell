export const builtins: Record<string, (args: string[]) => void> = {
  exit: () => process.exit(0),
  echo: (args) => console.log(args.join(" ")),
};
