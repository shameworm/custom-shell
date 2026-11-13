# custom-shell

A POSIX-style interactive shell written in TypeScript and running on [Bun](https://bun.com).

It reads commands at a `$ ` prompt, runs builtins and external programs from your `PATH`, handles shell-style quoting, redirects output and errors to files, and has tab completion.

```console
$ echo 'hello   world' "and \"quotes\""
hello   world and "quotes"
$ type echo
echo is shell builtin command
$ ls /nonexistent 2>> errors.txt
$ echo first > out.txt
$ echo second >> out.txt
$ cat out.txt
first
second
$ xyz_<TAB><TAB>
xyz_bar  xyz_baz  xyz_quz
$ xyz_
```

## Features

### Builtins

| Command | Description |
| --- | --- |
| `echo [args...]` | Print the arguments, separated by spaces |
| `pwd` | Print the current working directory |
| `cd [dir]` | Change directory; supports absolute and relative paths, `~` and `~/...` |
| `type <name>` | Say whether a name is a builtin or the path of an executable |
| `clear` | Clear the screen |
| `complete` | Manage programmable completion (see below) |
| `jobs` | List background jobs (see below) |
| `exit` | Exit the shell |

Any other command is looked up in `PATH` and run as an external program. Unknown commands print `<name>: command not found`.

### Quoting and escaping

- **Single quotes** `'...'` keep everything literally.
- **Double quotes** `"..."` keep spaces; inside them, `\"` and `\\` are escapes.
- **Backslash** outside quotes escapes the next character (e.g. `\ ` for a literal space).
- Adjacent quoted and unquoted parts join into one argument: `'a'"b"c` → `abc`.

### Redirection

| Operator | Effect |
| --- | --- |
| `>` / `1>` | Write stdout to a file (overwrite) |
| `>>` / `1>>` | Append stdout to a file |
| `2>` | Write stderr to a file (overwrite) |
| `2>>` | Append stderr to a file |

Target files are created when they don't exist. Redirection works for builtins and external programs alike, and stdout and stderr can be redirected in the same command.

### Background jobs

End a command with `&` to run it in the background. The shell prints the job number and process ID and returns to the prompt right away. The job's output still goes to the terminal unless it is redirected.

```console
$ sleep 10 &
[1] 84470
$ sleep 20 &
[2] 84471
$ jobs
[1]-  Running                 sleep 10 &
[2]+  Running                 sleep 20 &
$ echo hello
hello
[1]-  Done                    sleep 10
$
```

- `+` marks the most recent job and `-` the one before it.
- Finished jobs are reported as `Done` once, either before the next prompt or by `jobs`, whichever comes first, and then removed.
- Job numbers are reused: a new job gets one more than the highest number still running, or `[1]` when there are none.

### Tab completion

Press <kbd>Tab</kbd> to complete the word before the cursor:

- the **first word** is completed against builtins and executables in `PATH`;
- **any later word** is completed by the command's [completer script](#programmable-completion) if one is registered, and otherwise against files and directories, including nested paths like `src/utils/pa` and absolute paths. Dotfiles are only offered when the word starts with `.`.

What happens depends on how many entries match:

- **One match**: it is completed, followed by a space, or by `/` for a directory so you can keep going into it.
- **Several matches**: the word is extended to their longest common prefix (`xyz_` → `xyz_foo`).
- **Nothing more to add**: the first <kbd>Tab</kbd> rings the bell; a second <kbd>Tab</kbd> lists the matches alphabetically, with directories shown as `name/`.
- **No match**: rings the bell and leaves the input unchanged.

```console
$ cd proj<TAB>
$ cd project/
$ stat <TAB><TAB>
bar.txt  foo/
$ stat
```

### Programmable completion

`complete -C` registers a script that supplies completions for a command, as in bash:

```console
$ complete -C /path/to/git-completer git
$ complete -p git
complete -C '/path/to/git-completer' git
$ git che<TAB>
$ git checkout
$ complete -r git
```

| Usage | Effect |
| --- | --- |
| `complete -C <script> <name>...` | Register a completer script for each name |
| `complete -p [name...]` | Print the registered specs (all of them if no name is given) |
| `complete -r [name...]` | Remove specs (all of them if no name is given) |

When you press <kbd>Tab</kbd> on an argument of a registered command, the script is run with:

- `$1`: the command name, `$2`: the word being completed, `$3`: the word before it;
- `COMP_LINE`: the whole input line, and `COMP_POINT`: the cursor's byte offset in it.

Each line it prints is a candidate, and the usual rules apply: one candidate completes with a trailing space, several complete to their common prefix or are listed on a second <kbd>Tab</kbd>, and no output rings the bell. A script that can't be started, or runs for more than 5 seconds, gives no candidates.

## Getting started

Requires [Bun](https://bun.com) 1.3 or later.

```bash
bun install
bun run dev        # start the shell
bun test           # run the test suite
```

## Project structure

```
app/
├── main.ts              # REPL loop: prompt, parse, redirect, dispatch
├── builtins.ts          # builtin commands
├── complete.ts          # complete builtin and completer-script runner
├── jobs.ts              # background job table and jobs output
└── utils/
    ├── parseArgs.ts     # tokenizer: quotes and backslash escapes
    ├── redirect.ts      # parses >, >>, 1>, 1>>, 2>, 2>>
    ├── pathUtils.ts     # PATH lookup, executable search, cd
    └── completer.ts     # tab completion: commands, scripts, files, directories
test/                    # unit tests (bun test)
```

## License

[MIT](LICENSE)
