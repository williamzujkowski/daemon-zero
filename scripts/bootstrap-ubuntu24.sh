#!/usr/bin/env bash
# Bootstrap an Ubuntu 24.04 (noble) x86_64 host or devcontainer for DAEMON // 0.
# Installs OS packages and mise, then the exact tool versions pinned in mise.toml.
# Safe to re-run. Does not install Android tooling; that arrives in milestone M1.
set -euo pipefail

cd "$(dirname "$0")/.."

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi

echo "[bootstrap] OS packages"
$SUDO apt-get update -y
$SUDO apt-get install -y --no-install-recommends \
  build-essential ca-certificates curl git gnupg jq make unzip xz-utils libatomic1

if ! command -v mise >/dev/null 2>&1; then
  echo "[bootstrap] installing mise from its signed apt repository"
  $SUDO install -dm 755 /etc/apt/keyrings
  curl -fsSL https://mise.jdx.dev/gpg-key.pub | $SUDO tee /etc/apt/keyrings/mise-archive-keyring.asc >/dev/null
  echo "deb [signed-by=/etc/apt/keyrings/mise-archive-keyring.asc] https://mise.jdx.dev/deb stable main" \
    | $SUDO tee /etc/apt/sources.list.d/mise.list >/dev/null
  $SUDO apt-get update -y
  $SUDO apt-get install -y mise
fi

echo "[bootstrap] installing pinned toolchain from mise.toml"
mise trust --yes mise.toml
mise install

# Make the tools available in this shell and in future ones.
eval "$(mise activate bash)"
if ! grep -q 'mise activate bash' "$HOME/.bashrc" 2>/dev/null; then
  echo 'eval "$(mise activate bash)"' >> "$HOME/.bashrc"
fi

echo "[bootstrap] versions"
echo "  node $(mise exec -- node --version)"
echo "  pnpm $(mise exec -- pnpm --version)"

if [ -e /dev/kvm ]; then
  echo "[bootstrap] /dev/kvm present: Android emulator acceleration will be available in M1"
else
  echo "[bootstrap] /dev/kvm not found: enable virtualization in firmware before M1 if you want the emulator"
fi

echo "[bootstrap] done. Open a new shell (or run: eval \"\$(mise activate bash)\"), then: make setup && make verify"
