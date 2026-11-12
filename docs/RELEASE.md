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
backup and no debuggable flag. Check APK signatures with SDK `apksigner verify`.
Inspect the APK/AAB embedded JS/Hermes bundle for forbidden development markers.
The APK and AAB must come from the same source, version and signing configuration.

A local test key is not a production upload key. Do not submit its artifacts to a
store or promise updates signed by it. A future production key must be retained
securely by the maintainer; losing it can prevent updates. Native version codes
and iOS build numbers are explicit in app.json and must increase for store updates.

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

The existing audit, secret, OSV and Trivy scans remain required. Optional CodeQL
and dependency-review workflow additions are deferred; no CI permissions or
security-tool configuration changed in this release. [PRIVACY.md](PRIVACY.md)
is the store disclosure. Physical Android qualification (#6), iOS and store
review remain separate from an emulator-tested local release candidate.
