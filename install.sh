#!/bin/sh
# Builds and installs custom-shell from source:
#
#   curl -fsSL https://raw.githubusercontent.com/shameworm/custom-shell/main/install.sh | sh
#
# It downloads the source, compiles a standalone binary with Bun (installing
# Bun first if it's missing), and puts it in ~/.local/bin. The binary is
# built on this machine, so macOS runs it without any "can't verify the
# developer" prompt, and no prebuilt release is needed.
#
# Options, as environment variables:
#   INSTALL_DIR  where to put the binary (default: ~/.local/bin)
#   REF          the git branch, tag or commit to build (default: main)

set -eu

REPO="shameworm/custom-shell"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
REF="${REF:-main}"

fail() {
  echo "install.sh: $*" >&2
  exit 1
}

case "$(uname -s)" in
  Darwin | Linux) ;;
  *) fail "unsupported system: $(uname -s) (macOS and Linux are supported)" ;;
esac

# Use Bun from PATH, or from its default install location, or install it
# with Bun's official installer (into ~/.bun).
if command -v bun >/dev/null 2>&1; then
  BUN="$(command -v bun)"
elif [ -x "$HOME/.bun/bin/bun" ]; then
  BUN="$HOME/.bun/bin/bun"
else
  echo "Bun is needed to build custom-shell; installing it (https://bun.sh)..."
  curl -fsSL https://bun.sh/install | bash >/dev/null ||
    fail "couldn't install Bun; see https://bun.sh for manual installation"
  BUN="$HOME/.bun/bin/bun"
  [ -x "$BUN" ] || fail "Bun was installed but $BUN wasn't found"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

echo "Downloading custom-shell ($REF)..."
curl -fsSL "https://github.com/$REPO/archive/$REF.tar.gz" -o "$tmp/source.tar.gz" ||
  fail "couldn't download the source for '$REF'"
mkdir "$tmp/source"
tar -xzf "$tmp/source.tar.gz" -C "$tmp/source" --strip-components 1

echo "Building with Bun $("$BUN" --version)..."
# Built inside the temporary directory, so any files the compiler leaves
# behind are removed with it.
(cd "$tmp/source" &&
  "$BUN" build --compile --minify app/main.ts --outfile "$tmp/custom-shell" >/dev/null) ||
  fail "the build failed"

mkdir -p "$INSTALL_DIR"
mv "$tmp/custom-shell" "$INSTALL_DIR/custom-shell"
chmod +x "$INSTALL_DIR/custom-shell"

echo "Installed custom-shell to $INSTALL_DIR/custom-shell"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) echo "Run it with: custom-shell" ;;
  *)
    echo "$INSTALL_DIR is not on your PATH. Add it, e.g. in ~/.zshrc or ~/.bashrc:"
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
    echo "Or run it directly: $INSTALL_DIR/custom-shell"
    ;;
esac
