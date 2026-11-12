#!/usr/bin/env bash
# Generate disposable native sources and build both release artifacts with external signing.
set -euo pipefail
: "${ANDROID_HOME:?Source the Android SDK environment first}"
: "${DAEMON_ANDROID_KEYSTORE:?Set the absolute keystore path}"
: "${DAEMON_ANDROID_STORE_PASSWORD:?Set the keystore password in the environment}"
: "${DAEMON_ANDROID_KEY_ALIAS:?Set the key alias}"
: "${DAEMON_ANDROID_KEY_PASSWORD:?Set the key password in the environment}"
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
[[ "$DAEMON_ANDROID_KEYSTORE" = /* && -f "$DAEMON_ANDROID_KEYSTORE" ]] || {
  echo 'Signing keystore must be an existing absolute path.' >&2; exit 1;
}
export EXPO_NO_TELEMETRY=1
export CI=1
unset NO_COLOR
# Expo rewrites package scripts during prebuild; preserve the checked-in commands.
package_backup="$(mktemp)"
cp package.json "$package_backup"
trap 'cp "$package_backup" "$repo_dir/package.json"; rm -f "$package_backup"' EXIT
pnpm exec expo prebuild --platform android --no-install
cp "$package_backup" package.json
cd android
./gradlew --no-daemon --max-workers=2 -I ../scripts/android-signing.gradle :app:bundleRelease :app:assembleRelease
