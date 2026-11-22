# Android emulator check of the phone main view, 2026-11-22

This pass ran the release build natively, on a disposable Android emulator driven by an agent through `adb` and
`uiautomator2`. It is the first native run since the phone main view changed:
- #436: the resource HUD sticks under the alert band while it fits 35% of the window (vote-1795328874247-003j4kk);
- #437: the interrupt forecast joins it while all three fit the cap (vote-1795335412078-ubcj3e7).

Those were verified on web, where the sticky block is CSS `position: sticky`. On Android it is React Native's
`ScrollView` `stickyHeaderIndices`, which is a different implementation. Tracking issue: #6. No product code changed
in this PR.

**Evidence label: emulator, not a device; nobody listened.** The build was a test-signed release APK on an x86_64
emulator with a software GPU, operated by injected input; audio was off. In TESTING.md's terms this is
`AGENT-OBSERVATION`, not `DEVICE-TEST`. It does not close #6.

## Environment

| | |
|---|---|
| Source | The #437 head, `4b30825`, which merged as `ce5ad05`. Extracted with `git archive` into a `mktemp -d` directory outside the repository |
| Build | `mise exec -- make setup`, then `mise exec -- make android-release`. The APK was `0.2.0-rc.1` (versionCode 2, minSdk 24, targetSdk 36), sha256 prefix `68a434122400a849` |
| Signing | A throwaway RSA 2048 PKCS12 key made for this run with `keytool` (`CN=DAEMON0 TEST ONLY agent emulator 2026-11-22`, 30-day validity, password in a 0600 file), deleted after the run. Not a production key |
| Emulator | A new AVD, `dz-emu-1122` (`pixel_7` profile, 1080x2400, 420 dpi), on the already installed `system-images;android-36;google_apis;x86_64`. Booted with `-no-window -no-snapshot -gpu swiftshader_indirect` on port 5614; boot took 40 s |
| Isolation | `ANDROID_AVD_HOME` pointed into the run's temporary directory, and every `adb` call named `-s emulator-5614`. `daemon-zero-m1` was never booted or addressed: its 24 files had identical sizes and mtimes before and after. No Metro started, port 8081 was untouched, and there was no host screen or audio capture |
| Driver | `adb shell input` and `screencap`, `uiautomator dump`, and `uiautomator2` 3.7.1 in a scratch virtualenv, for the clipboard and the element bounds |

## Results

| Check | Result | Observation |
|---|---|---|
| Cold start | Pass | `am start -W` reported `Status: ok` in 2091 ms. A fresh game showed EXECUTE and the boot sequence |
| Import a mid-game save | Pass | The `victory-ready` fixture code (13,336 characters) went on the clipboard via uiautomator2 and read back equal. A tap focused `save-code`, Ctrl+A selected it and `KEYCODE_PASTE` replaced it; the field read back identical. Import showed REPLACE RUN, then CONFIRM, and the run became Phase 4. Typing the code with `adb shell input text` had mangled it, and the app correctly refused it as "Save code is invalid or unsupported" |
| HUD and forecast pinned at rest | Pass | `sticky-chrome` spanned y 304-831 and held `terminal-hud` (y 304-662) and the forecast: 527 of 2400 px, 22%, under the 35% cap |
| Scrolled to purchases | Pass | After two swipes, the CORP purchases (Desert Solar Array, Sovereign Tensor Halls) filled the view. The HUD (CYC, UND, MEM, CAP, THM, SUS, AEGIS LOCK) and the interrupt forecast stayed pinned under the status bar over an opaque background, and the cards scrolled beneath |
| A purchase while scrolled | Pass | Tapping Buy Desert Solar Array took it to Level 1/20 and raised the price to 7,800,000. The pinned CAP rate fell from +73.5K/s to +72.5K/s, the card's stated -1000 $/s |
| Font scale 2.0 (`settings put system font_scale 2.0`, this emulator only) | Pass, as designed | The HUD alone measured y 136-924 (788 px, 33% of 2400), under the cap, so it stayed pinned. The forecast no longer fitted beside it and was not in the pinned block, which is the tier from vote-1795335412078-ubcj3e7. The font scale was reset to 1.0 afterwards |
| Crashes | None | logcat showed no `FATAL EXCEPTION` and no `ANR in com.daemonzero` |

## Not covered

- **Sound:** emulator audio was off for this run.
- **Device-only checks:** TalkBack reading order across a pin flip (a flip remounts the HUD, so its alerts can be spoken
  again; UI-SPEC records the limit), haptics, a real notch, thermal and battery.
- **Rest of the game:** Phases 0 to 3 by hand, and an ending, on this build.
- **A scrolled or focused control under the pinned block:** `scroll-padding-top` is a web mechanism. On native, a
  control is only ever under the block when the player scrolls it there, so this run checked visible layout only.

These stay on #6 for a phone.
