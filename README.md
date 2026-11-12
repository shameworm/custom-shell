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

### Tab completion

Completion works on the command name (the first word), for both builtins and executables in `PATH`:

- **One match**: completes the name and adds a trailing space.
- **Several matches**: extends the input to their longest common prefix (`xyz_` → `xyz_foo`).
- **Nothing more to add**: the first <kbd>Tab</kbd> rings the bell; a second <kbd>Tab</kbd> lists all matches alphabetically.
- **No match**: rings the bell and leaves the input unchanged.

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
└── utils/
    ├── parseArgs.ts     # tokenizer: quotes and backslash escapes
    ├── redirect.ts      # parses >, >>, 1>, 1>>, 2>, 2>>
    ├── pathUtils.ts     # PATH lookup, executable search, cd
    └── completer.ts     # tab completion logic
test/                    # unit tests (bun test)
```

## License

[MIT](LICENSE)
