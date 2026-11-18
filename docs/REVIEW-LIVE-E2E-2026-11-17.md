# Live end-to-end check, 2026-11-17

A QA pass over the production game on current `main` after the day's merges: the preview
channel (DZ-01a/b, #211, #234), the campaign record (NH-01 #236, NH-02 #238/#239), routine
activity in the preview only (NH-07 #241), the audio fixes (#208), and the Pages smoke check
(#209). Every browser and emulator gate the repository has was run, plus one exploratory
session in headless Chromium and a native run on a disposable Android emulator. No product
code changed. One defect was filed: #245.

**Kinds of evidence.** The scripted suites are gates. "AGENT-OBSERVATION" means an agent drove
a headless browser once and read what came back. "Emulator" means a release APK on an x86_64
emulator with a software GPU, operated by injected input. None of it is a physical phone,
nobody listened to anything, and each manual check was done once.

## What was tested

| | |
|---|---|
| Commit | `main` at `9ef4fc7094500268c2896031fba168b505cbb3b8` (#241), detached, `pnpm install --frozen-lockfile` |
| Published site | `make pages-deployment`: Pages serves `9ef4fc7` (deployment 7868553838, 2026-11-17T22:52:14Z), `CURRENT` with `origin/main` |
| Host | Linux x86_64, 16 cores, 61 GB RAM, KVM. Node 26.13.1, pnpm 12.21.0, Temurin 21.0.13, Playwright 1.65.1 (Chromium headless shell 1255) |
| Save schema | `SCHEMA_VERSION` 8 on this commit. Fresh saves and every export read back as 8 |
| Android build | `make android-release` (`scripts/build-android-release.sh`) from a `git archive` copy of the same commit, outside the repo. Throwaway RSA 2048 key, `CN=DAEMON0 TEST ONLY agent live-e2e 2026-11-17`, password passed through the environment from a file, key deleted afterwards. Not a production key |
| Emulator | New disposable AVD `dz-qa-live` (`pixel_7`, 1080x2400, 420 dpi) on `system-images;android-36;google_apis;x86_64` rev 7 (Android 16, `BE2A.250530.026.F3`), the image the 2026-11-16 qualification used, already installed; nothing downloaded. Emulator 37.2.13.0, `-port 5590 -no-window -no-snapshot -no-boot-anim -gpu swiftshader_indirect`, guest audio written to a WAV file by QEMU's `wav` backend (TESTING.md, "Native: the Android emulator's output"); no host audio device or screen involved |
| Isolation | Private `ANDROID_AVD_HOME` under a `mktemp -d` directory, every command addressed `emulator-5590`. `daemon-zero-m1` was never booted or addressed; its 33 files had identical sizes and mtimes before and after. Port 8081 untouched. Browser suites ran through the make targets (port slots from `scripts/e2e-lock.sh`); the exploratory session served its own copy of `dist/` on 127.0.0.1:8098 to fresh Playwright contexts. The live Pages origin was only loaded by `make e2e-remote`'s fresh contexts |
| Load | Deliberately not idle: `make e2e` ran beside the Gradle build and the exploratory session, `make e2e-pages` and `make e2e-audio` beside emulator work |

## Commands

| Command | Result | Notes |
|---|---|---|
| `make verify` | **Pass** | typecheck, lint (0 warnings), content (6 phases, 44 nodes, 20 repeatables, 14 actions, 23 dilemmas, 15 endings), 135 test files / 1,160 tests, coverage 98.76% statements / 95.43% branches, balance gates, web export. 62 s |
| `make e2e` | **Pass**: 221 passed, 1 skipped | 4.9 min. The skip is by design: `live-player-race` on the desktop tier has no tab to press behind the modal |
| `make e2e-pages` | **Pass**: 221 passed, 1 skipped | 2.9 min, under `/daemon-zero/` |
| `make e2e-live` | **Pass**: 2 passed | 6.7 min. Fresh profiles played live to `ENDING LINEAGE_COVENANT`, desktop at T+10974s and phone at T+10774s, both in iteration 2 |
| `make e2e-audio` | **Pass**: 22 passed | 1.1 min. No flake this run (the known one is #244) |
| `make e2e-preview` | **Pass**: 8 passed | Preview marker, isolated save keys, production code adopted, routine line in the kernel log with no modal (#219) |
| `make e2e-remote` | **Pass**: 2 passed | Published build at 390x844 and 1440x900. Two `note:` lines for the phase 0 score cut off by the test's own reload, the excused case documented in TESTING.md |
| `make android-release` | **Pass** | `BUILD SUCCESSFUL in 4m 57s`, 371 tasks, 302 s wall, cold |

Logs: `~/.local/state/daemon-zero/evidence/2026-11-17/logs/` (one per command).

## Web, exploratory session (AGENT-OBSERVATION)

Headless Chromium, production export of this commit, fresh context, 390x844, **real clock**
(no `page.clock`), driven by a throwaway script outside the repo that pressed only visible,
enabled controls: four manual cycles per loop, then the first purchase it could afford
(repeatables capped at three each), and the first affordable choice on any dilemma.

- **Boot.** The first storage read already held a save: iteration 1, phase 0, T+0, no nodes,
  schema 8. No audio preference stored.
- **Opening.** First driver at T+2. The phase 0 dilemma (`HARNESS_EVENT // THE NIGHT SHIFT`)
  opened at T+104 with three enabled choices; `Do the Work` was committed and the kernel log
  recorded `DILEMMA_RESOLVED`. The phase threshold overlay appeared and was acknowledged; by
  T+331 the run was in phase 1 with 10 nodes and 24 purchases.
- **Reload.** Same 10 nodes, T+331 became T+337, and a checkpoint stamped after the reload.
- **Audio.** After the first MENU press, MENU > Audio read `Playing phase 1 score.`
- **Export.** `[ EXPORT SAVE CODE ]` filled 6,296 characters, `Backup code ready.`
- **Import, fresh desktop context (1440x900).** `not-a-save-code` was rejected with
  `Save code is invalid or unsupported.` and the run stayed at T+0, but only after a
  confirmation page that called it a "validated save": defect #245. The real code then
  imported: identical nodes, phase 1, and it survived a reload. A separate timing run of the
  same import found no long task over 200 ms.
- **Console and network.** 0 console warnings or errors, 0 page errors, 0 responses of 400 or
  more, 0 requests to another origin, across both contexts. One failed request: the phase 0
  score (`media`, `net::ERR_ABORTED`) in the import context, about a second after the MENU
  press started it, with no reload involved. Not investigated. The local server was
  `python3 -m http.server`, which ignores `Range` (TESTING.md, "Seeking on the test server"),
  so this may be the server and not the app. `make e2e-remote` against the real CDN saw the
  same request fail only in the excused reload case.
- Looked into and ruled out: thermal read 50.8 °C before export and 19.4 °C a minute after
  the import. Manual cycles add heat (`manualCycleHeat` in `src/engine/actions.ts`); the
  script was pressing manual cycles before the export and nothing was pressing them after.

## Android emulator

**APK.** 92,093,460 bytes, SHA-256
`5b21002cee0c3bbab18b8081fc90bc84709cf35cd84984d372fb632f35e6bc5a`, `com.daemonzero.app`
0.2.0-rc.1, versionCode 2, targetSdk 36, compileSdk 37, four ABIs. `apksigner verify`: v2
scheme verified, one signer. AAB 70,817,354 bytes from the same build, not used.
`aapt2 dump permissions` matches the table in RELEASE.md exactly (`MODIFY_AUDIO_SETTINGS`,
`VIBRATE`, `ACCESS_NETWORK_STATE`, the app's own `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`).
No `INTERNET`, no `WAKE_LOCK`, `allowBackup=false`, no `debuggable`. Twenty MP3s packaged.
The embedded `index.android.bundle` (2,243,056 bytes) has no `__daemon`, `dev-drawer`,
`dev-open`, `dev-grant` or `dev-force-wipe`. It also has no preview sentinel
(`daemon-zero:preview-overlay:5b1e0c7a`) and none of the overlay's routine ids.
`preview-marker` occurs three times: those are the marker component's test ids, which
render nothing on production content. The APK is 112,880 bytes smaller than RELEASE.md's
2026-11-16 measurement, close to the 159,111 bytes #193 took out of the score tags.

**Run.** Driven by `adb` and `uiautomator2` (scratch venv, disposable emulator only),
tapping controls located in the view tree by test id.

| Check | Result | Observation |
|---|---|---|
| Cold start | Pass | `am start -W`: COLD, 707 ms first launch, then 947, 741 and 525 ms. Terminal with `BOOT SEQUENCE`, no red box |
| Opening by on-screen controls | Pass | 8 purchases (three drivers, the manifest, the skimmer, the probe, the device scan, batching). `THE NIGHT SHIFT` at about T+190 |
| Dilemma and Back | Pass | Back left the modal open; the committed choice closed it and the clock went on. Later in phase 1, `ACOUSTIC_INTERCEPT // THE WHISTLEBLOWER`: Back again left it open; the free `Do Nothing` was committed after scrolling |
| HOME 33 s, return | Pass | T+255 became T+291. Kernel log: `DORMANT_RESUME: 30s in low-power hibernation. ...` |
| Force-stop, relaunch after 3 s | Pass | T+402 / 1,224 cycles became T+410 / 1,274, same nodes |
| Force-stop, 100 s away | Pass | T+602 / 2,425 cycles became T+708 / 2,758, the 50% dormant yield (100 x 6.0 x 0.5 = 300, plus about 6 s live). Kernel log: `DORMANT_RESUME: 1m in ...` |
| Save export | Pass | 5,088 characters, `Backup code ready.`. The text read from the field decodes with the engine's `importSave` to the run on screen (phase 0, 5 nodes, 3 widgets, T+755) |
| Save import | Pass, with #245 | Garbage code: the "validated save" confirmation, then `Save code is invalid or unsupported.`. The `decoded-omen` fixture (7,276 characters, regenerated from `scripts/make-fixtures.ts`, set by an accessibility set-text action) then gave `PHASE 1 // T+650s` with the forecast and the SENSORS tab |
| Phase 1 run, kill and relaunch | Pass | T+849 became T+857 |
| Rotation | Portrait held | With auto-rotate off and `user_rotation 1`, the display stayed `ROTATION_0` (`app.json` has `"orientation": "portrait"`) |
| logcat, whole session (64,313 lines) | Pass | 0 `FATAL EXCEPTION` from the app (the one in the log is the `uiautomator dump` shell tool clashing with uiautomator2), 0 ANR, no `ReactNativeJS` line except `Running "main"`. The app died only at my three force-stops |

### Audio (playback state and a guest-output file, not sound)

| Step | Observation |
|---|---|
| Cold start, MENU > Audio | `[ MUSIC ON ]`, `Music is paused. Resume to start listening.`, no player. Same after every relaunch |
| `[ RESUME MUSIC ]` | `Playing phase 0 score.`, one `AudioTrack` `USAGE_MEDIA` `started`; the WAV grew 630,784 bytes in about 4 s (3.6 s of 44.1 kHz stereo). Media session `PLAYING`, the app is the media-button session |
| Session metadata | `Phase 0 score, DAEMON // 0` and later `Phase 1 score, DAEMON // 0`: the neutral tags from #193, now seen on an emulator for the first time |
| Audio focus | Focus stack empty while the score played (`mixWithOthers`); the app requests no focus |
| Fade-in (#198) | Seven starts by `[ MUSIC ON ]`/off, captured to the WAV and read as RMS in 50 ms windows. Four at the emulator's default media volume and three at 15/15. In every start the first audible window was 25 to 35 dB below the level reached about 600 ms later (at 15/15: first windows -67 to -72 dBFS, settling at -33 to -40 dBFS). None started at full level. Before #198, one emulator start in two was abrupt. Coarse windows, music with its own dynamics, no alignment with the committed file |
| READ x4, score off | Each clip was one 24 kHz `AudioTrack` at -15 dB (speech 30% x `OUTPUT_SCALE` 0.6 is -14.9 dB), removed by AudioFlinger (`removeTrack_l`) when the clip ended after 118,080 frames (4.9 s). No stopped clip players lingered |
| READ, score on | Score -15 dB, -24 dB while the clip played (0.18 x 0.35 is -24.0 dB), back to -15 dB after it |
| HOME with the score playing, return | `paused` and session `PAUSED` in the background; `started` and `PLAYING` after returning |
| Font scale changed 5 times while running | Logcat order: `Running "main"` before `Stopping surface` twice, after it three times. Afterwards both switches were on and enabled, and `[ RESUME MUSIC ]` gave `Playing phase 0 score.` with a new `started` track. One `ReactNoCrashSoftException` (`scrollTo` for a view on the stopped surface) at a new-first recreation; nothing visible came of it |

### Against REVIEW-ANDROID-EMULATOR-2026-11-16.md

| Earlier finding | Now |
|---|---|
| 1. Audio controls die after a font-size change | **Fix holds** over 5 changes, 2 in the order that used to break it. As before, the score stops at the recreation and needs `[ RESUME MUSIC ]` |
| 2. Finished clip players not released | **Fixed on the clip path**, which the #186 re-run could not reach: four READ clips, each track gone at clip end |
| 3. Default-on soundtrack silent until MENU > Audio > `[ RESUME MUSIC ]` on every cold start | **Still reproduces.** This was "behaviour to decide"; no decision or issue records it. Not filed as a bug: it is a design question for a `consensus_vote` |
| 4. `DORMANT_RESUME` says `0.0h` | **Fixed**: `30s` and `1m` read on screen |
| 5. Active media session | As designed; titles are neutral (above). The Bluetooth service logged `MediaPlayerWrapper: Timeout while waiting for metadata to sync` 101 times (34 last time); emulator Bluetooth, nothing visible |
| 6. Manifest drift | **Fixed**: the permission list equals RELEASE.md, `WAKE_LOCK` gone |
| 7. `uiautomator dump` fails once the clock runs | **Still reproduces** (`ERROR: could not get idle state`, phase 1 running, uiautomator2 stopped first). Tooling, not the app; TESTING.md already says so |
| 8. TalkBack first focus on the whole pane | Not re-examined |
| 9. Status-bar clipping under a software GPU | Not seen at default font scale this time (screenshots) |

## Defects filed

- **#245 (bug, low)**: `[ IMPORT SAVE CODE ]` always opens a confirmation that says "Replace
  all current progress with this validated save", before anything is validated. Garbage
  reaches it, and only the confirm press rejects it. Seen on web and on the emulator. No data
  is lost.

Nothing else in this pass was a product defect. The fade-in measurements went on #198,
the absence of the flake on #244, and the device items still open on #6.

## Not run or not proven

- **A physical device**, real audio output, headsets, Bluetooth, another app taking focus,
  silent mode (#6).
- **TalkBack**, haptics, landscape and tablets (the app is portrait-locked), display-size
  changes.
- **Phases 2 to 5, a wipe, lineage and endings on native.** The emulator played phase 0 by
  hand and phase 1 from a fixture. On web, `make e2e-live` covers fresh profile to ending.
- **Routine activity (NH-07)** was seen only through `make e2e-preview`; it is web-only and
  preview-only by design, and the APK carries none of its ids.
- **Upgrading a schema 7 save** to 8 on Android. Every save here was written by this build.
- **`make security`, `make sbom` and `make verify-full`**: not in this pass's scope. CI runs them.
- **iOS** in any form; production signing; store review.
- **Repeatability.** Each manual check ran once. The only gates are the make targets.

## Evidence (outside git)

`~/.local/state/daemon-zero/evidence/2026-11-17/`:

- `logs/`: `make-verify.log`, `make-e2e.log`, `make-e2e-pages.log`, `make-e2e-live.log`,
  `make-e2e-audio.log`, `make-e2e-preview.log`, `make-e2e-remote.log`,
  `android-release-build.log`, `m1-before.txt` / `m1-after.txt` (the untouched AVD's file list).
- `web/explore/`: `events.json` (every console, network and game event), screenshots
  `01-boot` to `18-imported-reloaded`, `dilemma-1*.png`, `import-confirm-page-garbage.png`,
  `export-code.txt`.
- `android/`: `app-release-test-signed.apk`, `logcat-full.txt`, `bot-opening.jsonl`,
  screenshots `01-cold-start` to `14b-after-kill`, `dilemma-1*.png`,
  `09a-android-import-garbage-confirm.png`, `fadein-offsets.txt`, `fadein-envelopes.txt`,
  `read-tracks.txt`, `duck-tracks.txt`, `bg-audio.txt`, `fontscale-order.txt`,
  `absence.txt`, `rotation.txt`, `android-export-code.txt`.

The disposable AVD, the throwaway key, the build copy and the 47 MB guest-output WAV were
deleted after the run.
