/** Shell variables, by name. */
export const shellVariables = new Map<string, string>();

// The `declare` builtin:
//   declare -p NAME...  describe each variable
export function declareBuiltin(
  args: string[],
  out: (line: string) => void,
  err: (line: string) => void,
): void {
  const [flag, ...names] = args;

  if (flag === "-p") {
    for (const name of names) {
      err(`declare: ${name}: not found`);
    }
  }
}
