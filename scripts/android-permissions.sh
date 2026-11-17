#!/usr/bin/env bash
# Lists every Android permission declared by a library this app links, one
# "permission<TAB>package" per line, without a native build. It reads the AndroidManifest.xml
# of each module Expo autolinks and of each direct dependency (React Native community modules
# are linked by the React Native CLI, not by Expo).
#
# It cannot see manifests inside Maven AARs (androidx.media3, androidx.core): only Gradle
# resolves those. docs/RELEASE.md lists them and says how to read the merged manifest after a
# build. tests/release-permissions.spec.ts compares this output, plus that hand-read list and
# minus app.json's blockedPermissions, with the table in docs/RELEASE.md.
set -euo pipefail
cd "$(dirname -- "${BASH_SOURCE[0]}")/.."

{
  pnpm exec expo-modules-autolinking resolve --platform android --json |
    node -e 'const r = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
      for (const m of r.modules) for (const p of m.projects) console.log(p.sourceDir + "\t" + m.packageName);'
  node -e 'for (const name of Object.keys(require("./package.json").dependencies))
      console.log("node_modules/" + name + "/android\t" + name);'
} | while IFS=$'\t' read -r dir package; do
  manifest="$dir/src/main/AndroidManifest.xml"
  [[ -f "$manifest" ]] || continue
  { grep -o '<uses-permission[^>]*android:name="[^"]*"' "$manifest" || true; } |
    sed -e 's/.*android:name="//' -e 's/"$//' | while read -r permission; do
      printf '%s\t%s\n' "$permission" "$package"
    done
done | sort -u
