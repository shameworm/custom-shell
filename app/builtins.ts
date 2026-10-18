export const builtins: Record<string, (args: string[]) => void> = {
  exit: () => process.exit(0),
};
