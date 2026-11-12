# M6 local release qualification

M6 follows the completed audit in REVIEW-COHESION.md. The maintainer confirmed
that production signing credentials/EAS access do not exist and store signing
is aspirational. This milestone therefore delivers a clearly labelled local
**test-signed release candidate**, not a store-ready production release.

## Verified

- App identity: `com.daemonzero.app`, version 0.1.0, Android versionCode 1,
  iOS buildNumber 1. Reproducible bracketed-zero icons, monochrome adaptive icon,
  dark splash and SDK-matched system UI configuration. Launcher icon and
  actual standalone cold-start splash were captured and visually checked.
- Exact new packages resolved through Expo: expo-splash-screen 58.0.14 and
  expo-system-ui 58.0.7. Frozen lockfile retained; no framework upgrades.
- Local Gradle release build succeeded in 5m 42s, producing APK and AAB for
  arm64-v8a, armeabi-v7a, x86 and x86_64. Signing came from external environment
  values and a generated test-only RSA key outside the repository. APK signature
  verification passed; no Expo debug-key fallback was used.
- APK installed and cold-booted on the Pixel 7 API 36 x86_64 emulator without
  Metro access. Twelve manual inputs and the first hardware purchase used UI
  controls. Background/foreground and force-stop/relaunch preserved the purchase;
  screenshot and AsyncStorage database checks agree (schema 3, owned first node).
- Packaged manifest: no INTERNET, microphone or storage permission, automatic
  backup false, no debuggable flag. Remaining permissions are VIBRATE and the
  app's signature-protected non-exported-receiver permission.
- Inspected both APK/AAB embedded Hermes bundles: no `__daemon`, `dev-drawer`,
  `dev-open`, `dev-grant` or `dev-force-wipe`. No DEV control on the installed app.
- Production web Playwright: **14/14 cases pass** after the release changes.
- `make verify-full`: **255 tests, 37 files**, statements **98.97%**, branches
  **94.66%**, functions **99.44%**, lines **99.82%**. Typecheck, zero-warning lint,
  content, coverage, unchanged pacing gates, standalone web export, dependency
  audit, gitleaks, OSV, Trivy and CycloneDX SBOM all pass.
- Fresh production-export tests require web, Android and iOS JavaScript chunks
  and reject dev markers in all of them. Exporting iOS JavaScript is not an iOS
  native build. Four additional release-policy tests cover offline configuration,
  identity, profiles and refusal to build with missing signing credentials.

One full test attempt overlapped native compilation and timed out in the sim
and lint-harness tests. No timeout or gate was raised; the final run passed after
compilation. A new subprocess test initially omitted Expo's required NODE_ENV
ProcessEnv field; it was corrected without changing TypeScript flags.

## Artifacts

The GitHub prerelease includes the APK, AAB, static web archive, configured
CycloneDX SBOM and checksums. No signing key/password, review database or binary
screenshot is committed. The locally built native artifacts have these hashes:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| APK | 67193386 | `97eb8b5a6a6f707ab0a44a6bdf0e90e7556205562ddce632bb6d1bcba33c9558` |
| AAB | 45186024 | `7ee062e0afbcfc76eac5f4cb23c94fc15fe752c76b511ea2fbabf301c36d4e53` |

## Limits

- Production upload signing, Google Play submission/review and EAS cloud builds
  were not performed. EAS profiles are prepared; no project/account was invented.
- No Mac, Apple signing or authenticated EAS account: no iOS native build.
- No physical Android device: #6 remains open for mid-range input/performance
  qualification; emulator results do not establish smooth physical performance.
- Native compilation emitted upstream Java/Kotlin/Gradle deprecation warnings.
  Build success is not a claim that those upstream warnings were absent.
- Optional CodeQL/dependency-review workflows are deferred. Existing security
  tooling, CI permissions, lint rules, strict flags, thresholds and pacing gates
  are unchanged. Engine/content behavior and narrative are unchanged.
- Human opening approval and measured agent/bot evidence are reconciled in
  BALANCE.md; no new full human campaign or new balance tuning is claimed.
