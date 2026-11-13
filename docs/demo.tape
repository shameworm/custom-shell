# The README demo, recorded with VHS (https://github.com/charmbracelet/vhs).
# Re-record from the repository root with:  vhs docs/demo.tape
#
# Styled after the omarchy "blackgold" theme: gold on near-black, square
# corners and a thin gold border, like Hyprland's active window.

Output docs/demo.gif

Set Shell "bash"
Set FontSize 18
Set Width 1100
Set Height 640
Set Padding 28
Set Margin 3
Set MarginFill "#7F680B"
Set BorderRadius 0
Set TypingSpeed 45ms
Set Theme { "name": "blackgold", "background": "#0D0D0D", "foreground": "#EBDBB2", "cursor": "#A3850E", "selection": "#241F16", "black": "#0D0D0D", "red": "#D35F5F", "green": "#A3850E", "yellow": "#BFA75D", "blue": "#6E6A58", "magenta": "#BFA75D", "cyan": "#7A6A2C", "white": "#F6F1DD", "brightBlack": "#303531", "brightRed": "#D35F5F", "brightGreen": "#A3850E", "brightYellow": "#F5BF03", "brightBlue": "#6E6A58", "brightMagenta": "#BFA75D", "brightCyan": "#7A6A2C", "brightWhite": "#F6F1DD" }

# Set up a small project to show off in, with its own HOME so the prompt
# reads ~/projects/custom-shell-demo, then start the shell.
Hide
Type "export REPO=$PWD DEMO=$(mktemp -d) && mkdir -p $DEMO/projects/custom-shell-demo/src/utils && cd $DEMO/projects/custom-shell-demo" Enter
Type "printf 'black\ngold\ngolden hour\nolive\n' > notes.txt && touch README.md src/main.ts src/utils/colors.ts && git init -q -b main" Enter
Type "HOME=$DEMO bun $REPO/app/main.ts" Enter
Sleep 1.5s
Type "clear" Enter
Sleep 500ms
Show

Sleep 800ms
Type 'echo "hello from custom-shell"'
Sleep 300ms
Enter
Sleep 1.2s

# Tab completes file names; a pipeline filters them
Type "cat no"
Sleep 400ms
Tab
Sleep 600ms
Type "| grep gold"
Sleep 300ms
Enter
Sleep 1.5s

# Two tabs list the matches, directories in gold
Type "ls src/"
Sleep 300ms
Tab
Sleep 400ms
Tab
Sleep 1.2s
Type "u"
Tab
Sleep 500ms
Enter
Sleep 1.2s

# Errors are red, and so is the prompt arrow after a failure
Type "nosuchcmd"
Sleep 300ms
Enter
Sleep 1.5s
Type 'false || echo "rescued by ||"'
Sleep 300ms
Enter
Sleep 1.5s

# Variables, expanded per command
Type 'declare name=world; echo "hello, $name"'
Sleep 300ms
Enter
Sleep 1.5s

# Background jobs
Type 'sleep 2 && echo "background job done" &'
Sleep 300ms
Enter
Sleep 600ms
Type "jobs"
Enter
Sleep 2.6s
Enter
Sleep 1.2s

# Ctrl-C stops the running command, not the shell
Type "sleep 30"
Enter
Sleep 1.2s
Ctrl+C
Sleep 1.2s

Type "history 4"
Sleep 300ms
Enter
Sleep 3s
