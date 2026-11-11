#!/usr/bin/env bash
# Installs the Android SDK and KVM prerequisites on Ubuntu x86_64.
# Invoked by bootstrap-ubuntu24.sh --android; SDK/JDK paths stay outside the repo.
set -euo pipefail

cd "$(dirname "$0")/.."
if [ "$(uname -m)" != x86_64 ]; then
  echo "[android] This SDK bootstrap currently supports Linux x86_64 only." >&2
  exit 1
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
$SUDO apt-get install -y --no-install-recommends \
  qemu-system-x86 cpu-checker libgl1 libpulse0 libnss3 libx11-6 libxcb1 libxcomposite1 \
  libxcursor1 libxi6 libxrandr2 libxtst6 libvulkan1

export JAVA_HOME
JAVA_HOME="$(mise where java)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/22.0/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

# Upstream URL and SHA-256: https://developer.android.com/studio#command-tools
TOOLS_BUILD=15859902
TOOLS_SHA256=4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583
TOOLS_DIR="$ANDROID_HOME/cmdline-tools/22.0"
if [ ! -x "$TOOLS_DIR/bin/sdkmanager" ]; then
  ANDROID_DOWNLOAD_DIR="$(mktemp -d)"
  trap 'rm -rf "$ANDROID_DOWNLOAD_DIR"' EXIT
  curl -fL --retry 3 "https://dl.google.com/android/repository/commandlinetools-linux-${TOOLS_BUILD}_latest.zip" \
    -o "$ANDROID_DOWNLOAD_DIR/tools.zip"
  echo "$TOOLS_SHA256  $ANDROID_DOWNLOAD_DIR/tools.zip" | sha256sum --check
  unzip -q "$ANDROID_DOWNLOAD_DIR/tools.zip" -d "$ANDROID_DOWNLOAD_DIR/unpacked"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  mv "$ANDROID_DOWNLOAD_DIR/unpacked/cmdline-tools" "$TOOLS_DIR"
fi

sdkmanager --sdk_root="$ANDROID_HOME" --licenses < <(yes)
sdkmanager --sdk_root="$ANDROID_HOME" \
  'platform-tools' 'platforms;android-37.0' 'build-tools;37.0.0' 'emulator'

# A separate file avoids embedding user-specific paths in the repository.
mkdir -p "$HOME/.config/daemon-zero"
{
  printf 'export JAVA_HOME=%q\n' "$JAVA_HOME"
  printf 'export ANDROID_HOME=%q\n' "$ANDROID_HOME"
  printf 'export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/22.0/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"\n'
} > "$HOME/.config/daemon-zero/android-env.sh"
if ! grep -q 'daemon-zero/android-env.sh' "$HOME/.bashrc"; then
  echo '. "$HOME/.config/daemon-zero/android-env.sh"' >> "$HOME/.bashrc"
fi

echo '[android] SDK installed. Source ~/.config/daemon-zero/android-env.sh in this shell.'
echo '[android] Install a system image and create an AVD before running make android (see docs/TESTING.md).'
