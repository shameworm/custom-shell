/** Shell variables, by name. */
export const shellVariables = new Map<string, string>();

// The `declare` builtin:
//   declare NAME=VALUE...  set shell variables
//   declare -p [NAME...]   describe each variable (all of them with no names)
export function declareBuiltin(
  args: string[],
  out: (line: string) => void,
  err: (line: string) => void,
): void {
  const [flag, ...rest] = args;

  if (flag === "-p") {
    const names = rest.length > 0 ? rest : [...shellVariables.keys()];
    for (const name of names) {
      const value = shellVariables.get(name);
      if (value === undefined) err(`declare: ${name}: not found`);
      else out(`declare -- ${name}="${escapeValue(value)}"`);
    }
    return;
  }

  for (const assignment of args) {
    const eq = assignment.indexOf("=");
    const name = eq === -1 ? assignment : assignment.slice(0, eq);
    if (!isIdentifier(name)) {
      err(`declare: \`${assignment}': not a valid identifier`);
      continue;
    }
    if (eq !== -1) shellVariables.set(name, assignment.slice(eq + 1));
  }
}

/** A letter or underscore, then letters, digits and underscores. */
export function isIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

// Escapes the characters that are special inside double quotes, so the
// printed line reads back as the same value.
function escapeValue(value: string): string {
  return value.replace(/["\\$`]/g, (char) => `\\${char}`);
}
