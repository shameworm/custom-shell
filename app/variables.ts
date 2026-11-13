/** Shell variables, by name. Environment variables live in process.env. */
export const shellVariables = new Map<string, string>();

// A variable's value: a shell variable, or else an environment variable,
// which bash treats as an exported shell variable.
export function lookupVariable(name: string): string | undefined {
  return shellVariables.get(name) ?? process.env[name];
}

// Sets a variable. One that comes from the environment stays exported, as
// in bash: the new value is what child processes see (and, for PATH, where
// commands are looked up).
export function setVariable(name: string, value: string): void {
  if (name in process.env) process.env[name] = value;
  else shellVariables.set(name, value);
}

// One line of `declare -p` output, or undefined if the variable isn't set.
// Exported (environment) variables are marked -x, others --.
function describeVariable(name: string): string | undefined {
  const shell = shellVariables.get(name);
  if (shell !== undefined) return `declare -- ${name}="${escapeValue(shell)}"`;
  const env = process.env[name];
  if (env !== undefined) return `declare -x ${name}="${escapeValue(env)}"`;
  return undefined;
}

// The `declare` builtin:
//   declare NAME=VALUE...  set variables
//   declare -p [NAME...]   describe each variable (all of them, sorted by
//                          name, with no names)
export function declareBuiltin(
  args: string[],
  out: (line: string) => void,
  err: (line: string) => void,
): void {
  const [flag, ...rest] = args;

  if (flag === "-p") {
    const names =
      rest.length > 0
        ? rest
        : [...new Set([...shellVariables.keys(), ...Object.keys(process.env)])]
            .filter(isIdentifier)
            .sort();
    for (const name of names) {
      const line = describeVariable(name);
      if (line === undefined) err(`declare: ${name}: not found`);
      else out(line);
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
    if (eq !== -1) setVariable(name, assignment.slice(eq + 1));
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
