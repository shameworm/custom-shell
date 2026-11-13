import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// The shell's colours, from the omarchy "blackgold" palette: gold accents
// on near-black, with a muted red for errors.
// https://github.com/HANCORE-linux/omarchy-blackgold-theme
export const palette = {
  gold: "#F5BF03",
  softGold: "#BFA75D",
  darkGold: "#A3850E",
  text: "#EBDBB2",
  olive: "#6E6A58",
  red: "#D35F5F",
};

// Colour is used only on an interactive terminal, and never when NO_COLOR
// is set (https://no-color.org) or TERM is "dumb". Otherwise output stays
// plain, so scripts, pipes and tests see exactly what bash would print.
export function colorEnabled(stream: NodeJS.WriteStream): boolean {
  return (
    stream.isTTY === true &&
    !process.env.NO_COLOR &&
    process.env.TERM !== "dumb"
  );
}

/** Wraps text in a 24-bit foreground colour, optionally bold. */
export function paint(text: string, hex: string, bold = false): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `\x1b[${bold ? "1;" : ""}38;2;${r};${g};${b}m${text}\x1b[0m`;
}

// The current directory for the prompt, with the home directory as ~.
export function displayDir(cwd = process.cwd(), home = os.homedir()): string {
  if (cwd === home) return "~";
  return cwd.startsWith(home + path.sep) ? "~" + cwd.slice(home.length) : cwd;
}

// The git branch of the repository containing `dir`, read from .git/HEAD
// without running git; the short commit id when HEAD is detached, and
// undefined outside a repository.
export function gitBranch(dir = process.cwd()): string | undefined {
  for (let current = dir; ; current = path.dirname(current)) {
    const head = readHead(path.join(current, ".git"));
    if (head !== undefined) {
      const ref = /^ref: refs\/heads\/(.+)$/.exec(head);
      return ref ? ref[1] : head.slice(0, 7);
    }
    if (path.dirname(current) === current) return undefined;
  }
}

// .git is usually a directory, but in worktrees and submodules it's a file
// pointing at the real one ("gitdir: <path>").
function readHead(dotGit: string): string | undefined {
  try {
    const stat = fs.statSync(dotGit);
    let gitDir = dotGit;
    if (stat.isFile()) {
      const pointer = /^gitdir: (.+)$/m.exec(fs.readFileSync(dotGit, "utf8"));
      if (!pointer) return undefined;
      gitDir = path.resolve(path.dirname(dotGit), pointer[1]!.trim());
    }
    return fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
  } catch {
    return undefined;
  }
}

// The interactive prompt: directory, git branch, and an arrow that is gold
// after a successful command and red after a failed one. For example:
//   ~/projects/custom-shell main ❯
export function fancyPrompt(lastStatus: number): string {
  const branch = gitBranch();
  return (
    [
      paint(displayDir(), palette.softGold, true),
      branch ? paint(branch, palette.olive) : "",
      paint("❯", lastStatus === 0 ? palette.gold : palette.red, true),
    ]
      .filter(Boolean)
      .join(" ") + " "
  );
}
