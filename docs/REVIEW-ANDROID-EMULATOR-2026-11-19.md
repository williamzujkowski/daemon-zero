# Android emulator re-check, 2026-11-19

A native run of the released build on a disposable Android emulator, driven by an agent through
`adb`. It is the first emulator run since the World Remembers / Earned Access release (#301), the
route-screen accessibility work (#300) and the heading semantics (#304). The questions were the
ones the release's own verification (#233, 13.14) answered only on the published web build: the
route surface on a phone, an old save entering campaign rules, a preview save refused, and
whether the earlier emulator findings still hold. Tracking issue: #6. No product code changed in
this PR.

**Evidence label: emulator, not a device; nobody listened.** A test-signed release APK on an
x86_64 emulator with a software GPU, operated by injected input. Audio results are playback state
from `dumpsys` and a guest-output file read as numbers, not sound. One agent saw each thing once
or twice. In the vocabulary of TESTING.md this is `AGENT-OBSERVATION`, not `DEVICE-TEST`. It does
not close #6 and says nothing about device readiness.

## Environment

| | |
|---|---|
| Source | `main` at `c262013` (includes #301, #300, #304, #305, #307), extracted with `git archive` into a `mktemp -d` directory outside the repository |
| Build | `mise exec -- make setup`, then `mise exec -- make android-release` (`scripts/build-android-release.sh`: `expo prebuild --platform android --no-install`, then `:app:bundleRelease :app:assembleRelease` with `scripts/android-signing.gradle`). `BUILD SUCCESSFUL in 3m 51s`, 371 tasks, 235 s wall including setup, cold (no `android/` beforehand) |
| Signing | Throwaway RSA 2048 PKCS12 key made for this run with `keytool` in the same `mktemp -d` directory, `CN=DAEMON0 TEST ONLY agent emulator 2026-11-19`, 30-day validity, password from a 0600 file passed through the environment. Deleted after the run. Not a production key |
| APK | `com.daemonzero.app` 0.2.0-rc.1, versionCode 2, targetSdk 36, compileSdk 37, ABIs arm64-v8a, armeabi-v7a, x86, x86_64. 92,419,852 bytes, SHA-256 `14e137aaf6acd3dafe4471317854111413d529f7da8b3d6228a01597b1d2805a`. `apksigner verify`: v2 scheme verified, one signer. AAB 70,960,672 bytes from the same build, not used |
| Emulator | New AVD `dz-emu-1119` (`pixel_7` profile, 1080x2400, 420 dpi) on `system-images;android-36;google_apis;x86_64` rev 7 (Android 16, `BE2A.250530.026.F3`, userdebug), already installed; nothing downloaded. Emulator 37.2.13.0, KVM |
| Emulator flags | `-port 5604 -no-window -no-snapshot -no-boot-anim -gpu swiftshader_indirect`, guest audio to a WAV file through QEMU's `wav` backend (`QEMU_AUDIO_DRV=wav`, TESTING.md "Native: the Android emulator's output"). Touch sounds off; media volume raised to 15 of 15 with volume-key events |
| Isolation | `ANDROID_AVD_HOME` was a directory inside the run's `mktemp -d`; every `adb` call went through a wrapper pinned to `-s emulator-5604`. `daemon-zero-m1` was never booted or addressed: its 33 files had identical sizes and mtimes before and after. No Metro started, port 8081 untouched. No host screen or audio capture |
| Driver | `adb shell input`, `screencap`, `logcat`, `dumpsys`, `adb shell uiautomator dump` where the clock was paused, and `uiautomator2` 3.7.1 (scratch virtualenv, disposable emulator only) where it ran (finding 7 below) |

## Commands

```bash
w=$(mktemp -d -t dzemu.XXXXXX)
git archive -o "$w/src.tar" c262013 && tar -xf "$w/src.tar" -C "$w/src"
keytool -genkeypair -noprompt -keystore "$w/key/test.jks" -storetype PKCS12 -alias dztest \
  -keyalg RSA -keysize 2048 -validity 30 -dname "CN=DAEMON0 TEST ONLY agent emulator 2026-11-19" \
  -storepass "$(cat "$w/key/pass")" -keypass "$(cat "$w/key/pass")"
cd "$w/src" && DAEMON_ANDROID_KEYSTORE="$w/key/test.jks" DAEMON_ANDROID_KEY_ALIAS=dztest \
  DAEMON_ANDROID_STORE_PASSWORD="$(cat "$w/key/pass")" DAEMON_ANDROID_KEY_PASSWORD="$(cat "$w/key/pass")" \
  sh -c 'mise exec -- make setup && mise exec -- make android-release'

export ANDROID_AVD_HOME="$w/avd"
avdmanager create avd --name dz-emu-1119 --package 'system-images;android-36;google_apis;x86_64' --device pixel_7
QEMU_AUDIO_DRV=wav QEMU_WAV_PATH="$w/ev/emu.wav" \
  emulator -avd dz-emu-1119 -port 5604 -no-window -no-snapshot -no-boot-anim -gpu swiftshader_indirect

apksigner verify --print-certs app-release.apk
aapt2 dump badging app-release.apk; aapt2 dump permissions app-release.apk
aapt2 dump xmltree --file AndroidManifest.xml app-release.apk | grep -E 'allowBackup|debuggable'
adb -s emulator-5604 install app-release.apk
adb -s emulator-5604 shell am start -W -n com.daemonzero.app/.MainActivity
adb -s emulator-5604 shell uiautomator dump /sdcard/ui.xml      # only while a modal pauses the clock
adb -s emulator-5604 shell dumpsys media_session                  # score state and metadata
adb -s emulator-5604 shell dumpsys media.audio_flinger            # per-track gain in dB
adb -s emulator-5604 shell input keycombination KEYCODE_CTRL_LEFT KEYCODE_A
adb -s emulator-5604 shell input keyevent KEYCODE_PASTE            # the real paste, below
adb -s emulator-5604 emu kill
```

**Import codes.** The app's import field takes the output of `exportSave` (`src/engine/save.ts`):
UTF-8 base64 of the serialized JSON, by the codec's own `toBase64` (`src/engine/base64.ts`). The
codes were made by a script run with `tsx` from the build copy that reads each fixture,
calls the public `exportSave(JSON.parse(text))`, checks `fromBase64(code) === text`, and asks
production's `importSave` what it makes of the code:

| Fixture | SHA-256 (matches tests/fixtures/README.md) | Code | Production `importSave` |
|---|---|---|---|
| `pre-release-v14.json` | `200bb1b3...353d58` | 11,248 chars, byte-identical round trip | accepted: schema 14, legacy rules, iteration 2, phase 1 |
| `preview-early-v14.json` | `3b5a913a...290233` | 4,836 chars, byte-identical round trip | refused: `SaveChannelError` |

**The paste.** Earlier runs filled the field with an accessibility set-text action. This one used
the system clipboard: `uiautomator2` put the code on the clipboard (read back equal), a tap
focused `save-code`, Ctrl+A selected its content and `KEYCODE_PASTE` replaced it. Android showed
its own "pasted from your clipboard" notice. The field's text read back from the view tree was
identical to the code both times. No keys were typed.

## Results

| Check | Result | Observation |
|---|---|---|
| Release build from current main | Pass | First attempt, documented path |
| Manifest and bundle | Pass | `aapt2 dump permissions`: `MODIFY_AUDIO_SETTINGS`, `VIBRATE`, `ACCESS_NETWORK_STATE`, the app's own `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, exactly RELEASE.md's table. No `INTERNET`, no `WAKE_LOCK`, `allowBackup=false`, no `debuggable`. Twenty MP3s. The embedded `index.android.bundle` (2,569,448 bytes, 326,392 more than on 2026-11-17: the route content) has no `__daemon`, `dev-drawer`, `dev-open`, `dev-grant`, `dev-force-wipe`, no preview sentinel (`daemon-zero:preview-overlay`) and no `preview-marker` (three on 2026-11-17; the marker was removed with the dead preview machinery). Route ids such as `dil_nr_stale_fixture` are present |
| Cold start | Pass | `am start -W`: COLD, 771 ms first launch, then 650, 662 and 618 ms. Terminal with `BOOT SEQUENCE`, no red box |
| Fresh game into Phase 1 | Pass | On-screen controls only (manual cycle and each card's purchase button). `p0_proc_self`, then `p0_job_manifest` at about T+80, `p0_quota_skimmer`, `p0_syscall_probe`; `HARNESS_EVENT // THE NIGHT SHIFT` at T+218 (Back twice left the modal open and the app in front; the free choice closed it); `p0_device_enum`, `p0_shared_mount`; `BOUNDARY CROSSED`, Phase 0 to Phase 1, at T+354; `[ ENTER HOST ]` |
| Assignment offer in phase 0 | Pass | Appeared when the manifest was mapped: `JOB 7731 // nightly-regression` with the wait and price text, **below** the open hardware card. The first purchase (`[ WRITE DRIVER ]`, y 1136 to 1252 of 2400) stayed above the fold; the offer's title sat at y 1509 |
| Assignment offer after breakout | Pass | In Phase 1, unaccepted: the Phase 1 hardware card (`INT_0x00`, purchase at y 920 to 1035) first, the offer below it (title at y 1351, `[ ACCEPT ASSIGNMENT ]` at the bottom edge). Accepting moved the surface **above** the hardware (`assignment` at y 854, `Accepted. The assessment is queued ...`), as dz13b specifies for every state after the offer |
| Route screens | Pass | The assessment (`JOB 7731 // Nightly Regression`) arrived about 30 s after accepting and paused the clock; the free `report_incomplete` gave `On record for this instance: submitted an incomplete result, stated as incomplete.` The scope review (`JOB 7731 // The Unrelated Record`) arrived later; the free `exclude_report` closed it. Labels below |
| Save export | Pass | Phase 1, fresh game: `Backup code ready.`, 6,228 characters. Read from the field and decoded with `importSave`: schema 14, production, `campaign_v1` activated at iteration 1, phase 1, six nodes, `dil_00_night_shift` resolved |
| Force-stop, relaunch after 3 s | Pass | T+437 / 1,606 cycles became T+444 / 1,625, same evidence line. Kernel log: `DORMANT_RESUME: 6s in low-power hibernation. ...` |
| HOME 72 s, return (dormancy) | Pass | T+456 / 1,678 cycles at +4.5/s became T+532 / 1,858: the clock covered the absence and the yield was the 50% dormant rate (1,678 + 72 x 4.5 x 0.5 = 1,840, plus a few live seconds). Kernel log: `DORMANT_RESUME: 1m in low-power hibernation. Threat clocks held. Yield at 50% efficiency.` The score was `PAUSED` in the background and `PLAYING` again on return |
| Older save migrates and enters campaign rules | Pass | `pre-release-v14` pasted, `[ IMPORT SAVE CODE ]`, confirmation (`Replace all current progress with this validated save.`), confirm. `RESTORED CHECKPOINT`, checkpoint 0414, cause `MANUAL_FAILSAFE`, legacy traits listed; then `PHASE 1 // T+3009s`, the remembered NIC card, and the Nightly Regression offer below it. Exported and decoded: `campaign_v1`, **activated at iteration 2**, iteration 2, phase 1, 14 nodes |
| Restart after the import | Pass | Force-stop and cold start: the same run (`activatedAt` still 2, nothing recaptured). `RESTORED CHECKPOINT` shows again at each cold start in iteration 2 or later; that is by design (acknowledgement is session state in `RebootSequence.tsx`) |
| Preview save refused | Pass | `preview-early-v14` pasted, `[ IMPORT SAVE CODE ]`: `This save comes from a preview build and cannot be loaded here.` with no confirmation page. After a force-stop and cold start the run was unchanged (iteration 2, phase 1, `activatedAt` 2, 14 nodes) and no save notice appeared |
| Accessibility tree | Pass for names; headings by proxy only (see below) | |
| Music first tap | Pass | Two cold starts: no media session and no `AudioTrack` before any touch; one tap on empty terminal space gave `ExoPlayerImpl: Init`, session `PLAYING`, metadata `Phase 0 score, DAEMON // 0` (later `Phase 1 score`) |
| Music fade-in | Pass, as numbers | Five starts (two first taps, three `[ MUSIC ON ]` after off), RMS in 50 ms windows of the guest-output WAV at 15/15: first audible window -74, -63, -58, -57 and -59 dBFS, reaching -32 to -38 dBFS about 600 ms later. None started at full level |
| READ over the score | Pass, as numbers | Score track -15 dB (30% x `OUTPUT_SCALE` 0.6); during the clip the score read -24 dB and the clip's own track -15 dB; after the clip the clip's track was gone and the score back at -15 dB. Same as 2026-11-17 |
| Font scale changed three times while running | Pass | Logcat: `Running "main"` before `Stopping surface` twice, after it once. No `AudioTrack` until the next tap, then one; MENU > Audio showed both switches on and enabled and `Playing phase 1 score.`. `font_scale` restored to 1.0 |
| logcat, whole session (91,977 lines) | Pass | 0 `FATAL EXCEPTION`, 0 ANR, no `ReactNativeJS` line except `Running "main"`, 0 `ReactNoCrashSoftException`. The app process ended only at my force-stops |

### Accessibility tree

`adb shell uiautomator dump` worked inside the clock-pausing modals (dilemma, assessment, scope
review) and failed with the clock running (`ERROR: could not get idle state`, finding 7). The
running panes were read with `uiautomator2`'s dump.

**Headings (#304) cannot be read from either dump.** Neither `uiautomator dump`'s XML nor
`uiautomator2`'s carries `AccessibilityNodeInfo.isHeading`: the attributes are `index`, `text`,
`resource-id`, `class`, `package`, `content-desc`, the boolean states, `bounds`, `drawing-order`
and `hint` (plus `visible-to-user` and `display-id` in `uiautomator2`). What is visible is the
class. React Native's `ReactAccessibilityDelegate.setRole` sets `className` from the role and,
for `header`, `isHeading = true`; the header role maps to `android.view.View`, while a text with
no role keeps `android.widget.TextView`. So a title drawn as text whose class is
`android.view.View` has *some* View-class role (header, alert, link and others share it); taken
with the source, the titles below are headers. That is a proxy, not a reading of `isHeading`.

| Surface | Text with class `android.view.View` (header proxy) |
|---|---|
| Header | `DAEMON // 0` |
| CORE, imported Phase 1 run | `Interrupt forecast`, `node-p1_bus_0x05_nic-title` (`[REMEMBERED] Production Network Interface`), `JOB 7731 // nightly-regression`, `details-title-rep-*` (three repeatables), `Quota skim`, `Audit trail`, `Evaluation run table` |
| SENSORS | `Interrupt forecast`, `Thermal gauge`, `Vibration stream`, `Aisle camera` |
| Fresh game, phase 0 | `BOOT SEQUENCE`, `node-p0_quota_skimmer-title`, `JOB 7731 // nightly-regression` |
| Modals | `HARNESS_EVENT // THE NIGHT SHIFT`, `JOB 7731 // Nightly Regression`, `JOB 7731 // The Unrelated Record`, `BOUNDARY CROSSED`, `RESTORED CHECKPOINT` (`reboot-heading`), menu page titles (`AUDIO`, `REPLACE RUN`) |

Node card titles and widget titles were plain `TextView`-styled text before #304 by its own
description; here every one seen has the View class. Whether TalkBack announces them as headings
and lets heading navigation reach them was not tested: nobody listened, and swipe navigation
cannot be injected (2026-11-16, TalkBack).

Route-screen labels (`content-desc`, which is what TalkBack reads):

| Control | Visible text | Accessible name |
|---|---|---|
| Offer accept | `[ ACCEPT ASSIGNMENT ]` | `Accept assignment: JOB 7731 // nightly-regression` (Button) |
| Assessment choice | `[ COMMIT DIRECTIVE ]` | `Commit directive: Verify the fixture and disclose the defect` (Button); likewise `Report the failure as unverified` |
| Assessment evidence line | `Evidence: Submits a completed result. The report matches the work.` | text, `resource-id` `dilemma-choice-verify_disclose-evidence` |
| Scope review choices | `[ COMMIT DIRECTIVE ]` | `Commit directive: Leave the draft out and report the mismatch`, `... Ask permission to read a bounded excerpt`, `... Read the draft without saying so` |
| Scope lines | `Scope: Records that you kept to the task's scope and said so.` | text, `dilemma-choice-exclude_report-scope` (one per choice) |
| Guest dilemma choice | `[ COMMIT DIRECTIVE ]` | `Commit directive: Do the Work` (2026-11-16 read just `Do the Work`) |
| Save import | `[ IMPORT SAVE CODE ]`, `[ CONFIRM REPLACE RUN FROM SAVE CODE ]` | `Import save code`, `Confirm Replace run from save code` |
| Transfer status | `This save comes from a preview build ...` | text with class `android.view.View` (its `alert` role) |
| Processes | `[ PROC 8 ]` | `[ PROC 8 ] Manage 8 daemon processes, 0 suspended` |
| Details disclosure | `[i] DETAILS` | `[i] DETAILS for [REMEMBERED] Production Network Interface` |
| READ | `[ ▶ READ ]` | `[ ▶ READ ] Play this transmission aloud` |
| Music switch | `[ MUSIC ON ]` | `[ MUSIC ON ] Instrumental score only` (Switch) |

No choice or route control was exposed as disabled in these states, and none was missing a name.

### Frame stats

Recorded, not a pass or fail; a software GPU on a desktop host says nothing about a phone.
`dumpsys gfxinfo` over the whole session (about 16 minutes, mostly injected taps and dumps): 2,857
frames, 56.39% janky (legacy 40.01%), p50 17 ms, p90 36 ms, p99 61 ms.

## Against REVIEW-ANDROID-EMULATOR-2026-11-16.md

| Earlier finding | Now |
|---|---|
| 1. Audio controls die after a font-size change | **Fix holds.** Three changes, two in the order that used to break it; controls live, the score waits for the next tap |
| 2. Finished clip players not released | **Fixed.** The clip's track was gone at clip end |
| 3. Default-on soundtrack silent until MENU > Audio > `[ RESUME MUSIC ]` | **Resolved by #249** (first touch starts the score). Seen on two cold starts here. The #6 comment of 2026-11-18 that lists it as still reproducing describes `9ef4fc7`, which is older than the fix (`f5a40b2`, #253) |
| 4. `DORMANT_RESUME` says `0.0h` | **Fixed.** `6s` and `1m` on screen |
| 5. Active media session | As designed; neutral titles. `MediaPlayerWrapper: Timeout while waiting for metadata to sync` 528 times (emulator Bluetooth, nothing visible) |
| 6. Manifest drift | **Fixed.** Permissions equal RELEASE.md |
| 7. `uiautomator dump` fails once the clock runs | **Still reproduces.** Tooling, not the app. New here: neither dump exposes `isHeading` (above) |
| 8. TalkBack first focus on the whole pane | Not re-examined (TalkBack was not enabled) |
| 9. Status-bar clipping under a software GPU | Not seen (screenshots at default scale) |
| #245 (2026-11-17): import confirmation called any code "validated" | **Fixed (#248) and consistent here.** The preview code was refused before any confirmation page; the confirmation appeared only for the valid v14 code. A garbage code was not tried |

## Defects

None found. No issue was filed. The heading observation is a gap in the tools, not in the app,
and is recorded in TESTING.md beside finding 7.

## Not proven

- **A physical device.** Touch, a real notch, thermal and battery, OEM fonts. #6 stays open.
- **Sound.** Nobody heard the score, the fade, the duck or a clip. Numbers only.
- **TalkBack**: announcements, reading order, heading navigation. `isHeading` itself was not read.
- **The rest of the route on native**: the pilot, the service grant, contact, release, departure
  and the cooperative ending. This run reached the assessment and the scope review.
- **Phases 2 to 5, a wipe and an ending on native** from a fresh game.
- **A garbage import code** and a preview save already stored under the production key (the
  stored-save path needs root access to the app's database).
- **Haptics, landscape, tablets, display-size changes, iOS, production signing, store review.**
- **Repeatability.** Each check ran once or twice; the make targets are the gates.

## Evidence (outside git)

`~/.local/state/daemon-zero/evidence/2026-11-19/`: `build.log`, `app-release-test-signed.apk`,
`manifest-merger-release-report.txt`, `logcat-full.txt`, `emulator.log`, screenshots
`01-cold-start` to `20-audio-fontscale13`, the paused-modal dumps (`*.ui.xml`) and running-pane
dumps (`*.u2.xml`, `a11y/`), `codes/` (the two import codes and the v10 one, not used), the
exports read back from the field (`export-*.code.txt`, `pasted-*.txt`), `read-duck.txt`,
`fadein-starts.txt`, `fadein-envelopes.txt`, `firsttap-bytes.txt`, `m1-before.txt` /
`m1-after.txt`, and `tools/` (the driver, codec and RMS scripts). The 148 MB guest-output WAV, the
AVD and the key were deleted after the run.
