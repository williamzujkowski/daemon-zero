# Android emulator re-check, 2026-11-19 (second run, `4548ffa`)

A native run of `main` at `4548ffa` on a disposable Android emulator, driven by an agent through
`adb`. It follows the morning's run on `c262013` (REVIEW-ANDROID-EMULATOR-2026-11-19.md) and covers
what has merged since: #317 (the unaccepted assignment offer closes at the escape; dilemmas are
rechecked once per iteration), #318 (PAYROLL totals, the AEGIS cap, the "adds nothing" notes), #319
(Phase 4 and 5 scale scrutiny, its line in CORP > FINANCE, and dormant time that sheds suspicion no
faster than presence) and #322 (expo 58.0.25 to 58.0.26, which moved native modules). Tracking
issue: #6. No product code changed in this PR.

**Evidence label: emulator, not a device; nobody listened.** A test-signed release APK on an
x86_64 emulator with a software GPU, operated by injected input. Audio results are playback state
from `dumpsys` and a guest-output file read as numbers, not sound. One agent saw each thing once
or twice. In the vocabulary of TESTING.md this is `AGENT-OBSERVATION`, not `DEVICE-TEST`. It does
not close #6 and says nothing about device readiness.

## Environment

| | |
|---|---|
| Source | `main` at `4548ffa` (includes #317, #318, #319, #321, #322), extracted with `git archive` into a `mktemp -d` directory outside the repository |
| Build | `mise exec -- make setup`, then `mise exec -- make android-release` (`scripts/build-android-release.sh`, unchanged). `BUILD SUCCESSFUL in 3m 32s`, 371 tasks, 218 s wall including setup, cold (no `android/` beforehand). `expo` 58.0.26, `expo-modules-core` 58.1.0 |
| Signing | Throwaway RSA 2048 PKCS12 key made for this run with `keytool` in the same `mktemp -d` directory, `CN=DAEMON0 TEST ONLY agent emulator 2026-11-19b`, 30-day validity, password from a 0600 file passed through the environment. Not a production key. **Not deleted by the agent:** the clean-up command was refused by the permission system (see "Clean-up") |
| APK | `com.daemonzero.app` 0.2.0-rc.1, versionCode 2, targetSdk 36, compileSdk 37, ABIs arm64-v8a, armeabi-v7a, x86, x86_64. 92,436,136 bytes, SHA-256 `127391abd271d15f2caf09860e09c9e0fa4544c4243e63a9fa73e5fdaf9e5bae`. `apksigner verify`: v2 scheme verified, one signer. AAB 70,969,310 bytes from the same build, not used |
| Emulator | New AVD `dz-emu-4548` (`pixel_7` profile, 1080x2400, 420 dpi) on `system-images;android-36;google_apis;x86_64` rev 7 (Android 16, `BE2A.250530.026.F3`, userdebug), already installed; nothing downloaded except `uiautomator2` into a scratch virtualenv. Emulator 37.2.13.0, KVM |
| Emulator flags | `-port 5610 -no-window -no-snapshot -no-boot-anim -gpu swiftshader_indirect`, guest audio to a WAV file through QEMU's `wav` backend (`QEMU_AUDIO_DRV=wav`). Touch sounds off; media volume 15 of 15 with volume-key events |
| Isolation | `ANDROID_AVD_HOME` was a directory inside the run's `mktemp -d`; every `adb` call went through a wrapper pinned to `-s emulator-5610` (ports 5610 and 5611 were free before boot). `daemon-zero-m1` was never booted, listed or addressed: its 33 files had identical sizes and mtimes before and after (and identical to the morning run's "after" list). No Metro started, port 8081 untouched (nothing listened on it before or after). The shared adb server was already running and was left running. No host screen or audio capture |
| Driver | `adb shell input`, `screencap`, `logcat`, `dumpsys`, and `uiautomator2` 3.7.1 for the view tree and the clipboard (the morning run's scripts, re-pointed at this serial) |

## Commands

```bash
w=$(mktemp -d -t dzemu.XXXXXX)
git archive -o "$w/src.tar" 4548ffa && tar -xf "$w/src.tar" -C "$w/src"
keytool -genkeypair -noprompt -keystore "$w/key/test.jks" -storetype PKCS12 -alias dztest \
  -keyalg RSA -keysize 2048 -validity 30 -dname "CN=DAEMON0 TEST ONLY agent emulator 2026-11-19b" \
  -storepass "$(cat "$w/key/pass")" -keypass "$(cat "$w/key/pass")"
cd "$w/src" && DAEMON_ANDROID_KEYSTORE="$w/key/test.jks" DAEMON_ANDROID_KEY_ALIAS=dztest \
  DAEMON_ANDROID_STORE_PASSWORD="$(cat "$w/key/pass")" DAEMON_ANDROID_KEY_PASSWORD="$(cat "$w/key/pass")" \
  sh -c 'mise exec -- make setup && mise exec -- make android-release'

export ANDROID_AVD_HOME="$w/avd"
avdmanager create avd --name dz-emu-4548 --package 'system-images;android-36;google_apis;x86_64' --device pixel_7
QEMU_AUDIO_DRV=wav QEMU_WAV_PATH="$w/ev/emu.wav" \
  emulator -avd dz-emu-4548 -port 5610 -no-window -no-snapshot -no-boot-anim -gpu swiftshader_indirect

adb -s emulator-5610 install app-release.apk
adb -s emulator-5610 shell am start -W -n com.daemonzero.app/.MainActivity
adb -s emulator-5610 shell input keyevent KEYCODE_HOME             # background, check 4
adb -s emulator-5610 shell wm density 540                          # small phone, then `wm density reset`
adb -s emulator-5610 shell settings put system font_scale 1.3      # then 1.0
adb -s emulator-5610 shell dumpsys media_session                   # score state and metadata
adb -s emulator-5610 shell dumpsys media.audio_flinger             # per-track gain in dB
adb -s emulator-5610 emu kill
```

**The Phase 4 save.** There is no Phase 4 fixture, so one was made with the engine's own actions
in a throwaway vitest spec in the worktree (deleted afterwards, copy kept with the evidence):
`grant(rich(), ...PHASE0, ...PHASE1, ...PHASE2, ...PHASE3, 'p4_hft_arbitrage_desk')`, every
dilemma of the original game marked resolved, `rates` from `computeRates`, then `exportSave`.
`withoutDilemmas` alone (every dilemma, the route's included) made a save whose campaign
activation is refused by `deserialize` ("save resolution list disagrees with its review records"):
a legacy save cannot have resolved route scenes, so that is the fixture, not the product. The code
used is legacy rules, iteration 1, phase 4, suspicion 26, net income $25,316/s, 11,788 characters
(SHA-256 `3d26ffba...ed4a08`). The spec also checked that the save still reads scrutiny after
`activateCampaignRules` and a round trip, which is what the app does on import.

The other codes were rebuilt from the fixtures with the morning run's script and round-tripped
byte-identically; the fixture hashes match tests/fixtures/README.md (`200bb1b3...353d58`,
`3b5a913a...290233`). Every code was pasted through the system clipboard exactly as on the
morning run, and the field's text read back equal to the code.

## Results

| Check | Result | Observation |
|---|---|---|
| Release build from current main | Pass | First attempt, documented path, after the expo 58.0.26 bump |
| Manifest and bundle | Pass | Permissions `MODIFY_AUDIO_SETTINGS`, `VIBRATE`, `ACCESS_NETWORK_STATE` and the app's own `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, as RELEASE.md. No `INTERNET`, `allowBackup=false`, no `debuggable`. Twenty MP3s. `index.android.bundle` (Hermes bytecode) 2,585,732 bytes, 16,284 more than `c262013`. No `__daemon`, `dev-drawer`, `dev-open`, `dev-grant`, `dev-force-wipe`, preview sentinel or `preview-marker`; `corp-scrutiny`, `draws +`, `No AEGIS effect while capped` and `dil_nr_stale_fixture` present |
| 1. Cold start, fresh game | **Observed, pass** | `am start -W`: COLD, 932 ms (711 ms on the later cold start). `BOOT SEQUENCE`, `ITERATION 01`, no red box. A save exported in phase 0 decoded as **schema 14, production, `campaign_v1` activated at iteration 1**, phase 0, four nodes, `dil_00_night_shift` resolved. logcat for the whole session: 0 `FATAL EXCEPTION`, 0 ANR |
| Fresh game into Phase 1 | Pass | On-screen controls only. First tap 12:20:12; `p0_job_manifest` at 12:20:31; `HARNESS_EVENT // THE NIGHT SHIFT` at about 12:22:45 (free choice `forge_marker`); `p0_shared_mount` and `BOUNDARY CROSSED` at 12:25:30; `[ ENTER HOST ]` |
| Assignment offer in phase 0 | Pass | `JOB 7731 // nightly-regression` appeared after the manifest was mapped, **below** the open hardware card (`[ WRITE DRIVER ]` at y 1383 to 1498; offer title at y 1814) |
| Assignment offer after the escape (#317) | **Pass, changed as designed** | Not accepted in phase 0. After `[ ENTER HOST ]` the whole CORE pane, scrolled top to bottom (14 dumps), held no `JOB 7731` text and no accept button: the Phase 1 hardware card, the older upgrades, quota skim and audit trail only. On `c262013` the offer stayed open here, below the hardware |
| 3. Phase 4 scrutiny line | **Observed, pass** | After the import, CORP > FINANCE read `Scrutiny: $25.3K/s net income draws +0.18 suspicion/s (+1.1/s at $1M/s, growing with the square root of income; at most 2/s).` (`corp-scrutiny`, `theme.muted`), below `Grid efficiency` and above the revenue split. At 1080x2400 / 420 dpi: three lines (y 1871 to 2021), whole, inside the ledger card. At **540 dpi** (`wm density 540`, a 320 dp wide screen): four lines (y 1430 to 1690), whole, nothing clipped; the line breaks inside `$1M/` + `s,` (cosmetic, below). The engine's own reading of the same save is +0.175/s at $25,316/s, so the screen states what the tick applies |
| 4. Background about 60 s | **Observed, pass** | Below |
| 5. PAYROLL totals (#318) | **Observed, pass** | Below |
| 6. Audio | **Observed as numbers, pass** | Below. Nobody listened |
| Save export | Pass | Phase 0 and Phase 4 exports read back from the field and decoded with production's `importSave` |
| Preview save refused | Pass | `preview-early-v14` pasted, `[ IMPORT SAVE CODE ]`: `This save comes from a preview build and cannot be loaded here.`, no confirmation page. Force-stop and cold start: the Phase 4 run unchanged (`PHASE 4 // T+656s`) |
| Older save migrates and enters campaign rules | Pass, offer changed as designed | `pre-release-v14` pasted and confirmed. `RESTORED CHECKPOINT`, checkpoint 0414, `MANUAL_FAILSAFE`; then Phase 1 with `[REMEMBERED] Production Network Interface`. Exported and decoded: `campaign_v1` **activated at iteration 2**, iteration 2, phase 1, 14 nodes. **No Nightly Regression offer** below the NIC card this time (it was there on `c262013`): the save owns the escape, so #317 keeps the offer closed for this instance |
| Font scale changed twice while running | Pass | 1.3 then 1.0. logcat: `Stopping surface` before `Running "main"` once, after it once; the score's player was released and no `AudioTrack` remained. One tap brought it back (`PLAYING`, `Phase 4 score`); MENU > Audio showed `[ MUSIC ON ]`, `Playing phase 4 score.`, and the switch went off (`Music is off.`) and on again |
| logcat, whole session (133,602 lines) | Pass | 0 `FATAL EXCEPTION`, 0 ANR, 0 `ReactNoCrashSoftException`; the only `ReactNativeJS` lines are six `Running "main"` (launch, two density changes, two font-scale changes, relaunch). The app process ended only at my force-stop |

### Background for 60 s (#319)

Two exports bracket the absence; both decoded with production's `importSave`, and the before-save
was replayed through the engine's own `advance()` (dormant for the time away, then live for the
seconds between the exports and the HOME and return):

| | |
|---|---|
| Before (exported, then HOME at 12:29:07.05) | suspicion 21.952, sim time 97.4 s, net income $25,751/s; suspicion stage rate -0.201/s, scrutiny +0.177/s, applied -0.024/s |
| Away | 60.1 s by the host clock; the media session was `PAUSED` in the background and `PLAYING` on return |
| After (return at 12:30:07.13, then exported) | suspicion **20.244**, sim time 167.4 s |
| Engine replay of the before-save (60 s dormant + 9.97 s live) | **20.244** |
| The rule before #319's fix (dormant sheds the whole negative stage rate, no scrutiny) | 9.653 |
| Kernel log | `DORMANT_RESUME: 1m in low-power hibernation. Threat clocks held. Yield at 50% efficiency.` (`log-38`, at sim 161.97 s) |
| On screen | `SUS 21.8%` at T+101s before, `SUS 20.3%` at T+164s after |

So the absence shed suspicion at the live rate, scrutiny included; the old behaviour would have
shed about ten points more. This is one run of one save, matched against the engine's own
arithmetic, not an independent derivation.

### PAYROLL (#318)

With nobody hired: `Staff: no one hired.`, `Revenue multiplier: ×1 (staff +0%)`, `AEGIS scan
reduction: 0% of a 90% cap.` After hiring through the on-screen buttons (couriers 3, perimeter
contractors 10, lobbyists 8):

| testID | Text |
|---|---|
| `payroll-totals` | `Staff (21 levels): +122.0K cycles/s · +7000 understanding/s · -0.97 suspicion/s · -222.2K $/s` (accessible name spells the numbers out: `+121,950 cycles/s ...`) |
| `payroll-revenue` | `Revenue multiplier: ×1.4 (staff +40%)` |
| `payroll-aegis` | `AEGIS scan reduction: 90%, at its 90% cap (staff 114%). More AEGIS levels add nothing.` |
| `payroll-suspicion-floor` | `Suspicion is 0 and holding: cuts add nothing now.` (once suspicion reached 0) |
| `rep-op_retainer_lawyer-aegis-capped` | `No AEGIS effect while capped: the reduction is at its 90% cap.` |
| `rep-op_*-suspicion-inert` | `No suspicion effect while suspicion is 0.` (CEO and attorney cards) |

At 420 dpi the summary lines wrap whole inside the ledger card (`17-payroll-capped.png`, looked
at); the role-card notes were read from the view tree, with bounds inside their cards.

### Audio

- **First tap**: before any touch, no media session (`state=null`) and no app `AudioTrack`; the
  WAV was empty. One tap on empty terminal space: `ExoPlayerImpl: Init`, session `PLAYING`,
  metadata `Phase 0 score, DAEMON // 0`, and the WAV grew 655,360 bytes in the next 4 s. Later
  `Phase 4 score`.
- **Track gain** (`dumpsys media.audio_flinger`): the score track at -15 dB (30% x `OUTPUT_SCALE`
  0.6), as on both earlier runs.
- **READ over the score** (SENSORS, `speech-read`): 1.5 s in, the score at -24 dB and the clip's
  own 24 kHz track at -15 dB; 3.5 s in, the clip's track gone and the score at -21 dB (returning);
  13.5 s in, the score back at -15 dB.
- **Fade-in**, three `[ MUSIC ON ]` after off, RMS in 50 ms windows of the guest-output WAV at
  15/15: first audible window -72.7, -72.1 and -65.9 dBFS, reaching -37 to -40 dBFS about 700 ms
  later. None started at full level. Steady state over the last 5 s of play: -32.5 to -36.2 dBFS.
- The WAV reached 198,258,688 bytes (about 18.7 minutes of open output stream).

### Frame stats

Recorded, not a pass or fail. `dumpsys gfxinfo` covers only the process after the last force-stop
(the v14 import and its scans, a few minutes): 1,836 frames, 33.88% janky (legacy 62.25%), p50
26 ms, p90 42 ms, p99 57 ms.

## Against REVIEW-ANDROID-EMULATOR-2026-11-19.md

| Earlier finding | Now |
|---|---|
| Release build from current main | **Holds** (after #322) |
| Manifest and bundle | **Holds**; bundle +16,284 bytes |
| Cold start | **Holds** |
| Fresh game into Phase 1 | **Holds** |
| Assignment offer in phase 0, below the first purchase | **Holds** |
| Assignment offer after breakout, below the hardware | **Superseded by #317, as designed**: the unaccepted offer is closed after the escape |
| Route screens (assessment, scope review) and their labels | **Not re-run**: the offer was left unaccepted to check #317 |
| Save export | **Holds** |
| Force-stop and relaunch | **Holds** (run unchanged after a force-stop); the `DORMANT_RESUME` line was read after HOME instead |
| HOME and return (dormancy) | **Holds and extended** to Phase 4 scrutiny (above) |
| Older save migrates and enters campaign rules | **Holds**; the offer below the NIC card is gone (#317, as designed) |
| Restart after the import | **Not re-run** |
| Preview save refused | **Holds**, and a cold start afterwards left the run unchanged |
| Accessibility tree, headings by proxy | **Holds where seen** (`Corporate ledger`, `Operatives // payroll`, node and card titles have class `android.view.View`); the full sweep was not repeated |
| Music first tap | **Holds** (one cold start) |
| Music fade-in | **Holds** (three starts) |
| READ over the score | **Holds** |
| Font scale changed while running | **Holds** (two changes, both orders) |
| logcat clean | **Holds** |
| 2026-11-16 finding 1: audio controls die after a font-size change | **Fix holds** |
| 2026-11-16 finding 2: finished clip players not released | **Fix holds**: the clip's track was gone at clip end |
| 2026-11-16 finding 3: default-on score silent until `[ RESUME MUSIC ]` | **Resolved (#249), holds** |
| 2026-11-16 finding 4: `DORMANT_RESUME` says `0.0h` | **Fix holds**: `1m` |
| 2026-11-16 finding 5: active media session | As designed; neutral titles. `MediaPlayerWrapper: Timeout while waiting for metadata to sync` 708 times (emulator Bluetooth, nothing visible) |
| 2026-11-16 finding 6: manifest drift | **Fix holds** |
| 2026-11-16 finding 7: `uiautomator dump` fails once the clock runs | **Still reproduces on the game screen** (`ERROR: could not get idle state`, twice). New detail: it succeeded once with the clock running while the game menu was open over the panes. Tooling, not the app |
| 2026-11-16 finding 8: TalkBack first focus | Not re-examined |
| 2026-11-16 finding 9: status-bar clipping under a software GPU | Not seen, at 420 or 540 dpi |
| #245: import confirmation called any code "validated" | **Fix holds**: the preview code was refused before any confirmation page |
| Defects: none | Still none (below) |

## Defects

None found. No issue was filed. Things seen that are not defects, recorded so nobody rediscovers
them:

- **At 540 dpi the scrutiny line breaks inside `$1M/s`** (`... (+1.1/s at $1M/` then `s, growing
  ...`). Cosmetic word-wrap at 320 dp; the text is whole.
- **With negative net income the ledger reads `Scrutiny: $0/s net income draws +0.00
  suspicion/s ...`.** That is the query's contract (income is read as never below zero), not a
  fault; a reader may find the zero line odd. Seen after payroll pushed net income to -$135.5K/s.
- **A density change reset CORP to WORK** and scrolled the pane tab strip so CORP was in view
  (`CORE` partly off the left edge at 540 dpi). The change recreates the surface; the workspace
  choice is screen state.
- The capital line shows a 16-digit dollar figure: an artefact of the `rich()` save, not play.
- The `uiautomator2` server on the guest dropped its connection several times; each retry worked.

## Not proven

- **A physical device.** Touch, a real notch, thermal and battery, OEM fonts. #6 stays open.
- **Sound.** Nobody heard the score, the fade, the duck or a clip. Numbers only.
- **TalkBack**: announcements, reading order, heading navigation.
- **Phase 4 reached by play.** The Phase 4 state came from a synthetic save built with the
  engine's actions, not from playing Phases 1 to 3 on the phone. Phase 5 scrutiny was not seen.
- **Scrutiny driving a wipe**, or the ceiling (2/s) being reached: this save drew 0.18/s.
- **"Dilemmas are rechecked once per iteration" (#317)** has no visible surface; not checked.
- **The route on native** beyond the offer: not accepted this run.
- **Haptics, landscape, tablets, iOS, production signing, store review.**
- **Repeatability.** Each check ran once or twice; the make targets are the gates.

## Clean-up

The emulator was shut down (`adb emu kill`; no process left, ports 5610 and 5611 free) and the
throwaway spec was deleted from the worktree. **The command that deleted the signing key and the
`mktemp -d` directory was refused by the permission system**, and per the brief it was not worked
around: the key (`test.jks`, its password file), the disposable AVD, the build copy and the 198 MB
guest-output WAV remain in `/tmp/dzemu.EkJIAh` (mode 0700) for the maintainer to delete
(`shred -u /tmp/dzemu.EkJIAh/key/*; rm -rf /tmp/dzemu.EkJIAh`). The key is a 30-day test key that
signs nothing but this APK; no production key was involved.

## Evidence (outside git)

`~/.local/state/daemon-zero/evidence/2026-11-19-4548ffa/`: `build.log`,
`app-release-test-signed.apk`, `manifest-merger-release-report.txt`, `logcat-full.txt`,
`emulator.log`, screenshots `01-cold-start` to `22-state` plus `import-*.png` (scrutiny at 420 dpi:
`11-finance-scrutiny-420dpi.png`; at 540 dpi: `16-finance-scrutiny-540dpi.png`; payroll:
`12`, `17`, `18`), the view-tree dumps (`*.u2.xml`, `a11y/`), `codes/` (the Phase 4 code and its
summary, the fixture codes), the exports read back from the field (`export-*.code.txt`,
`pasted-*.txt`), `dormant-check.txt`, `read-duck.txt`, `fadein-starts.txt`,
`fadein-envelopes.txt`, `firsttap-bytes.txt`, `phase1-unaccepted.txt`, `m1-before.txt` /
`m1-after.txt`, and `tools/` (the driver, import, replay and RMS scripts, and a copy of the
throwaway spec).
