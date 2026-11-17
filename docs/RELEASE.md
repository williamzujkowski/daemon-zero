# Release procedure

v0.2.0-rc.1 includes gameplay phases 0–5, epistemic manipulation, swarm cohorts,
post-orbital endings and Lineage. Production signing and store
submission are aspirational per the maintainer; local qualification uses a
separate **test-only** signing key, never a debug-key fallback.

## Verify and export

```bash
mise exec -- make setup
mise exec -- make verify-full
mise exec -- make e2e
mise exec -- make sbom
mise exec -- make build-web
```

The static web export is `dist/`; serve its files from an HTTPS host. There is no
backend or runtime API configuration. Keep the origin stable to retain browser
saves. `tests/production-export.spec.ts` freshly exports web and native JavaScript
and rejects the development hook/drawer markers in every chunk.

## GitHub Pages

The playable web deployment is https://williamzujkowski.github.io/daemon-zero/.
GitHub Pages uses the repository's GitHub Actions publishing source. On pushes
to `main`, the `ci` workflow publishes only after its complete `verify` job passes,
including security, SBOM and production E2E at both the root and Pages subpath.
PRs run these checks but cannot deploy. Only the separate deployment job receives
`pages: write` and `id-token: write`; verification retains read-only permissions.

`make build-pages` sets `DAEMON_WEB_BASE_PATH=/daemon-zero` for Expo's
`experiments.baseUrl` and writes `dist/daemon-zero/`. That directory alone becomes
the Pages artifact. `make e2e-pages` serves it under the real subpath and runs all
production scenarios at phone and desktop sizes, including asset-path checks.
Ordinary `make build-web`, development and native builds keep the root base path;
release web archives still package the ordinary root export. Always run a fresh
`make build-web` before archiving `dist`, since Pages builds add a nested directory.

Keep the hosting origin stable: browser saves are local to that origin, with no
cloud sync. Use Save export/import to transfer from localhost or Android. The
static app has no service worker, so offline page loading is not guaranteed.
GitHub receives normal hosting requests, not gameplay saves (see PRIVACY.md).
Roll back through a reviewed revert on `main` and the same quality gates.

## Local Android release

Install the SDK/JDK with `scripts/bootstrap-ubuntu24.sh --android`, source
`~/.config/daemon-zero/android-env.sh`, and supply these environment variables
from the local credential store (never a tracked file or command-line password):

- `DAEMON_ANDROID_KEYSTORE`: absolute path to a keystore outside the repository.
- `DAEMON_ANDROID_STORE_PASSWORD` and `DAEMON_ANDROID_KEY_PASSWORD`.
- `DAEMON_ANDROID_KEY_ALIAS`.

Then run `mise exec -- make android-release`. Expo generates disposable ignored
`android/` sources; the script preserves the package scripts that prebuild would
otherwise rewrite. Gradle builds both `android/app/build/outputs/bundle/release/app-release.aab`
and `android/app/build/outputs/apk/release/app-release.apk`. It fails if signing
variables are missing. The Gradle signing initializer overrides Expo's default
debug signing for the release variant without writing passwords to a file.

Install the APK with `adb install -r <apk>`. Verify a cold launch with no Metro
connection, manual input, a purchase, background/foreground and force-stop/
relaunch. Inspect the packaged manifest for no INTERNET permission, disabled
backup and no debuggable flag, and compare its permissions with the table below. Check APK signatures with SDK `apksigner verify`.
Inspect the APK/AAB embedded JS/Hermes bundle for forbidden development markers.
The APK and AAB must come from the same source, version and signing configuration.

A local test key is not a production upload key. Do not submit its artifacts to a
store or promise updates signed by it. A future production key must be retained
securely by the maintainer; losing it can prevent updates. Native version codes
and iOS build numbers are explicit in app.json and must increase for store updates.

## Android permissions and size

Recorded 2026-11-16 for 0.2.0-rc.1 (versionCode 2), from a test-signed release APK built by
`make android-release` and installed on an emulator (`dumpsys package com.daemonzero.app`,
"requested permissions"). This replaces the permission line in REVIEW-M6.md, which predates
audio (#186 item 3). The app asks for nothing itself (`android.permissions` is `[]`); every
entry comes from a library.

| Permission | Declared by | Why it is there, and whether the app needs it |
|---|---|---|
| `android.permission.VIBRATE` | `expo-haptics` (its AndroidManifest.xml) | Needed: haptic feedback on presses |
| `android.permission.MODIFY_AUDIO_SETTINGS` | `expo-audio` (its AndroidManifest.xml and its config plugin, unconditionally) | Kept: `setAudioModeAsync`, which the app calls before any playback, sets the audio mode and speaker routing through `AudioManager` (`AudioModule.kt`, `updatePlaySoundThroughEarpiece`). Normal-level, no prompt |
| `android.permission.ACCESS_NETWORK_STATE` | `androidx.media3:media3-common` and `media3-exoplayer` 1.9.1, the player inside `expo-audio` (manifests inside the AARs) | Kept: the player library declares it for itself, and removing it was not shown safe. It lets the app see *whether* the device has a connection. It cannot open one: see `INTERNET` below. Normal-level, no prompt |
| `${applicationId}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | `androidx.core` 1.17.0 (manifest inside the AAR) | A signature-level permission the app defines for its own unexported broadcast receivers; grants nothing to anyone else |

Removed from the build by `android.blockedPermissions` in `app.json`:

- `INTERNET`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`: declared by `expo-file-system`
  (linked through `expo`); the game uses none of them. `INTERNET` being absent is what
  PRIVACY.md rests on.
- `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`: belt and braces; `expo-audio`'s plugin is also
  configured with `recordAudioAndroid: false`.
- `WAKE_LOCK`, blocked on 2026-11-16: declared by `media3-exoplayer` for its optional wake
  mode. Nothing in this app uses it: `expo-audio` never calls `setWakeMode` (no `WakeLock`,
  `PowerManager` or `setWakeMode` anywhere in its Android sources or in the other linked
  modules), the app plays nothing in the background, and it runs no headless JS task. On the
  emulator the build without it played, paused, resumed and switched the score normally.

No foreground service, notification, microphone or storage permission is present, and
background playback stays disabled in the `expo-audio` plugin options.

**Keeping this true.** `tests/release-permissions.spec.ts` runs
`scripts/android-permissions.sh`, which lists every permission declared by a library the
build links (Expo-autolinked modules and direct dependencies) without a native build, adds
the AAR permissions above, subtracts the block list, and fails unless the result is exactly
the first table. It cannot read manifests inside Maven AARs, so those are listed by hand in
the test and pinned to media3 1.9.1; when `expo-audio` moves to another media3 the pin fails.
Then, and before any release, read the real thing:

```bash
mise exec -- make android-release
"$ANDROID_HOME"/build-tools/*/aapt2 dump permissions android/app/build/outputs/apk/release/app-release.apk
# which library contributed each line:
grep -n 'uses-permission' -A2 android/app/build/outputs/logs/manifest-merger-release-report.txt
```

**Size.** The same APK is 92,206,340 bytes, against 67,193,386 at M6: 25,012,954 more.
Read from the APK's own file table (`unzip -lv`):

| In the APK | Bytes | Share |
|---|---|---|
| Native libraries, four ABIs (x86 17.7 MB, x86_64 17.1 MB, arm64-v8a 16.6 MB, armeabi-v7a 11.4 MB) | 62,748,796 | 68.6% |
| The six scores (`res/*.mp3`, stored uncompressed, byte-for-byte the manifest total) | 22,251,291 | 24.3% |
| The fourteen voice clips | 591,400 | 0.6% |
| Dex (Java/Kotlin code) | 2,782,566 | 3.0% |
| Hermes JavaScript bundle | 2,196,828 | 2.4% |
| Everything else (resources, manifest, signature) | 957,265 | 1.0% |

Since 2026-11-17 the six scores total 22,092,180 bytes, 159,111 fewer: their container tags
were replaced with neutral ones plus an AI-origin comment, and the audio is unchanged (#193,
[SOUNDTRACK.md](SOUNDTRACK.md)). The APK was not rebuilt or re-measured for that change, so
the table above is still the 2026-11-16 measurement.

Audio assets are 22,842,691 bytes, 91% of the growth since M6. The remaining 2.2 MB was not
attributed file by file, because the M6 APK was not rebuilt for comparison; it is the size of
the audio library's code (media3 arrives with `expo-audio`) plus dependency updates since.
The universal APK carries every ABI; the AAB from the same build is 70,910,022 bytes and a
store would deliver one ABI's libraries from it, roughly 17 MB instead of 63. Each further
score adds its file size once: MP3 is not compressed again inside the package.

## EAS and iOS

`eas.json` pins CLI 27.7.2, with preview APK and production AAB profiles. Authenticate
and link a maintainer-owned EAS project before running
`pnpm dlx eas-cli@27.7.2 build --platform android --profile production`.
Use EAS-managed signing secrets; local `credentials.json` is ignored. Never put
credentials in app.json, eas.json or GitHub comments. No EAS account or production
credential was available for this local verification. iOS needs a Mac or an
authenticated EAS account and Apple signing; it is not claimed as built.

The identity is `com.daemonzero.app` on both platforms. Icons are reproducibly
rendered by `python3 scripts/generate-branding.py`. The dark splash uses the SDK's
splash plugin. Network updates and Android automatic cloud backup are disabled.
See [Expo signing](https://docs.expo.dev/app-signing/existing-credentials/),
[build profiles](https://docs.expo.dev/eas/json/) and
[splash configuration](https://docs.expo.dev/versions/latest/sdk/splash-screen/).

## Publishing

Merge only the exact reviewed head after CI passes. Tag that main commit, attach
the APK/AAB, static web archive, `SHA256SUMS.txt` and `sbom.cdx.json` to a GitHub
release. v0.2.0-rc.1 uses app/package version 0.2.0-rc.1, Android versionCode 2
and iOS buildNumber 2 (no iOS native qualification claimed).
Test-only signing must be called out in the title/notes and published as a
prerelease. Production signing/store distribution is a later maintainer task.
Do not publish keystores, credential JSON, passwords or review save databases.

The existing audit, secret, OSV and Trivy scans remain required. CodeQL runs as a
separate workflow (`.github/workflows/codeql.yml`, added 2026-11-16 on maintainer
instruction, after the v0.2.0-rc.1 review); check its code-scanning alerts before
tagging. A dependency-review workflow checks every pull request's dependency changes
for known vulnerabilities and disallowed licenses. [PRIVACY.md](PRIVACY.md)
is the store disclosure. Physical Android qualification (#6), iOS and store
review remain separate from an emulator-tested local release candidate.
