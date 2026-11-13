#!/bin/sh
# Installs custom-shell from GitHub Releases:
#
#   curl -fsSL https://raw.githubusercontent.com/shameworm/custom-shell/main/install.sh | sh
#
# Options, as environment variables:
#   INSTALL_DIR  where to put the binary (default: ~/.local/bin)
#   VERSION      a release tag such as v1.0.0 (default: the latest release)
#
# Downloading with curl doesn't mark the file as quarantined, so macOS runs
# it without the "can't verify the developer" prompt a browser download gets.

set -eu

REPO="shameworm/custom-shell"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${VERSION:-latest}"

fail() {
  echo "install.sh: $*" >&2
  exit 1
}

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) fail "unsupported system: $(uname -s) (macOS and Linux are supported)" ;;
esac

case "$(uname -m)" in
  arm64 | aarch64) arch=arm64 ;;
  x86_64 | amd64) arch=x64 ;;
  *) fail "unsupported CPU: $(uname -m) (x64 and arm64 are supported)" ;;
esac

# An x64 shell on Apple Silicon (under Rosetta) still gets the native build.
if [ "$os" = darwin ] && [ "$arch" = x64 ] &&
  [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then
  arch=arm64
fi

asset="custom-shell-$os-$arch.tar.gz"
if [ "$VERSION" = latest ]; then
  base="https://github.com/$REPO/releases/latest/download"
else
  base="https://github.com/$REPO/releases/download/$VERSION"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

echo "Downloading $asset ($VERSION)..."
curl -fsSL "$base/$asset" -o "$tmp/$asset" ||
  fail "couldn't download $base/$asset"
curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS" ||
  fail "couldn't download $base/SHA256SUMS"

# Check the archive against the release's published checksum.
expected="$(grep " $asset\$" "$tmp/SHA256SUMS" | cut -d' ' -f1)"
[ -n "$expected" ] || fail "$asset is not listed in SHA256SUMS"
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/$asset" | cut -d' ' -f1)"
else
  actual="$(shasum -a 256 "$tmp/$asset" | cut -d' ' -f1)"
fi
[ "$actual" = "$expected" ] || fail "checksum mismatch for $asset"

tar -xzf "$tmp/$asset" -C "$tmp"
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
