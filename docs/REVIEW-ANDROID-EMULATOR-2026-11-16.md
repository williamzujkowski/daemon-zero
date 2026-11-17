# Android emulator qualification, 2026-11-16

A live native run of current `main` on an Android emulator, driven by an agent through
`adb`. It exists because everything merged on 2026-11-15/16 (voice READ #156, ducking #160,
failed-clip release #167, speech controls #168, safe-area insets #159, forecast compaction
#163, actuator gate #175, save reconciliation #178, expo 58.0.25 with expo-modules-core
58.1.0 #166) had been verified only on the web export in headless Chromium. Tracking
issue: #6. No product code changed in this PR; failures are reported as findings.

**Kind of evidence.** A release APK on an x86_64 emulator with a software GPU, operated by
injected input. It is not a physical phone, nobody listened to anything, and one agent
saw each thing once. Audio results are playback *state* read from `dumpsys`, not sound.

## Environment

| | |
|---|---|
| Source | `main` at `1461b0b` (worktree branch `test/android-emulator-qualification`) |
| Build | Release, test-signed, via the documented path: `mise exec -- make android-release` (`scripts/build-android-release.sh`: `expo prebuild --platform android --no-install`, then `:app:bundleRelease :app:assembleRelease` with `scripts/android-signing.gradle`) |
| Signing | Throwaway RSA 2048 key generated for this run in a `mktemp -d` directory outside the repo, `CN=DAEMON0 TEST ONLY agent qualification`, deleted afterwards. `apksigner verify`: v2 scheme verified. Not a production key |
| Build time | Gradle `BUILD SUCCESSFUL in 4m 29s`, 371 tasks, cold (no `android/` directory beforehand); 272 s wall including prebuild |
| APK | `com.daemonzero.app` 0.2.0-rc.1, versionCode 2, 92,194,964 bytes, SHA-256 `1f80963e70f5027f87251624bfbffa9b87ebf711e8ddc7fbaa61a197004acdb6`, ABIs arm64-v8a, armeabi-v7a, x86, x86_64. An AAB was built too and not used |
| Native versions in the build | expo 58.0.25, expo-modules-core 58.1.0, expo-modules-autolinking 58.1.0, expo-audio 58.0.12, react-native 0.88.1 |
| Emulator | New disposable AVD `dz-agent-qual` (device profile `pixel_7`, 1080x2400 at 420 dpi), image `system-images;android-36;google_apis;x86_64` (Android 16, API 36, `BE2A.250530.026.F3`, userdebug), already installed; nothing was downloaded |
| Emulator flags | `-port 5570 -no-window -no-snapshot -no-boot-anim -gpu swiftshader_indirect`, audio left enabled. The host backend failed (`Could not init 'pa' audio driver`), so nothing reached host speakers; the guest audio stack ran normally |
| Isolation | The AVD lived under a private `ANDROID_AVD_HOME`, every command used `adb -s emulator-5570`, no Metro was started and port 8081 was not touched. The existing `daemon-zero-m1` AVD was never booted or addressed; its 33 files had identical mtimes and sizes before and after |
| Driver | `adb shell input`, `screencap`, `logcat`, `dumpsys`. The view tree came from `uiautomator2` (see finding 7) |

The APK has no `INTERNET` permission, so it cannot reach a Metro server; the JavaScript is
the embedded Hermes bundle.

## Results

| Check | Result | Evidence summary |
|---|---|---|
| Release build from current main | Pass | Built first time by the documented path. Bundle contains none of `__daemon`, `dev-drawer`, `dev-open`, `dev-grant`, `dev-force-wipe`. Manifest: no `INTERNET`, `allowBackup=false`, no `debuggable`. 20 audio files packaged (6 scores, 14 vibration clips), matching the wired sources |
| Cold start | Pass | `am start -W`: COLD, 977 ms first launch, about 550 ms later. Terminal screen with `BOOT SEQUENCE`; no red box. Whole-session logcat (83,803 lines): 0 `FATAL EXCEPTION`, 0 ANR, no `ReactNativeJS` error line |
| Fresh game runs | Pass | 12 of 12 injected manual taps accepted (`Manual instructions committed: 12`). First node bought through its button; header then showed `PHASE 0 // T+22s`, later `T+76s`, cycles rising at the displayed rate. Play continued by buttons to the phase 0 dilemma at about T+277 s |
| Phase 0 dilemma | Pass | `HARNESS_EVENT // THE NIGHT SHIFT`, `CLOCK PAUSED // DECISION REQUIRED`. Android Back twice: modal stayed, app stayed foreground. The free choice was committed; the modal closed and the clock resumed (T+277 s to T+281 s over 4 s) |
| Persistence, quick relaunch | Pass | `am force-stop` then relaunch 3 s later: T+295 s / 484 cycles became T+298 s / 508 cycles, same node list and repeatable level |
| Persistence, longer absence | Pass | Force-stopped at T+305 s, 557 cycles at +7.0/s, 109 understanding at +1.2/s; relaunched 112 s later: T+420 s, 973 cycles, 180 understanding. That is the 50% dormant yield (557 + 112 x 7 x 0.5 = 949, plus about 3 s live). Kernel log: `DORMANT_RESUME: 0.0h in low-power hibernation. Threat clocks held. Yield at 50% efficiency.` (see finding 4) |
| MENU and Back | Pass | MENU opens. In Kernel log, Back returns to the menu root; Back again closes the menu; on the import confirmation, Back returns to the save page. Back at the terminal root leaves to the launcher (default Android behaviour, process kept) |
| Save export | Pass | `[ EXPORT SAVE CODE ]` filled the field with a 4,220-character code and showed `Backup code ready.` The text read from the field decodes with the engine's `importSave` to the run on screen (four phase 0 nodes, three widgets, iteration 1) |
| Save import | Pass | The `decoded-omen` fixture code (6,904 characters, from `scripts/make-fixtures.ts`) was set in the save field, then imported through `[ IMPORT SAVE CODE ]` and the confirmation page. The run became `PHASE 1 // T+651s` with the forecast, omen and SENSORS tab. The field was filled by an accessibility set-text action, not by typed keys or a clipboard paste |
| Safe-area insets (#159) | Pass, portrait only | See "Insets" below |
| Phone forecast line (#163) | Pass: one line at default size, wraps at 1.3 and 2.0, never clips | See "Forecast" below |
| Music | Pass, with findings 1 and 3 | See "Audio" below |
| READ, ducking, speech controls (#156, #160, #168) | Pass as playback state, with finding 2 | See "Audio" below |
| TalkBack | Partial | See "TalkBack" below |
| Frame stats | Recorded, not a pass or fail | See "Frame stats" below |

### Insets

The Pixel 7 profile has a centred camera cutout by default: `DisplayCutout{insets=Rect(0,
136 - 0, 0)}`, bounding rect `(480,0)-(625,136)`.

| Configuration | Root pane (`terminal-mobile`) | Header | Tab bar | Menu dialog seen |
|---|---|---|---|---|
| Default cutout, gesture navigation | y 136 to 2337 | starts at 136 | 2219 to 2337 | Root page 608 to 1865; Audio page 168 to 2306 |
| `cutout.emulation.tall` (cutout inset 126) | 136 to 2337 | starts at 136 | 2219 to 2337 | Root page 608 to 1865 |
| `cutout.emulation.double` (top 84, bottom 84) | 136 to 2316 | starts at 136 | 2198 to 2316 | Root page 598 to 1855 |
| Three-button navigation (bar at 2274 to 2400) | 136 to 2274 | starts at 136 | 2156 to 2274 | Kernel log page 168 to 2243 |

- The header starts exactly at the status-bar inset in every case: the removed
  Android-only status-bar pad was neither doubled (the header would start at 272) nor lost
  (it would start at 0). The edge-to-edge window reports the status bar as the top inset,
  as #159 assumed.
- The tab bar ends exactly where the navigation inset begins, for the gesture pill, the
  three-button bar and a simulated bottom cutout.
- Modal windows (dilemma, menu and its pages) stayed inside the same bounds, so insets do
  reach a native `Modal`.
- The tall cutout overlay changes nothing visible because the status bar (136 px) is
  already taller than that cutout (126 px).
- Not exercised: landscape side insets (the app is portrait-locked), a window that is not
  edge-to-edge, and any real notch.

### Forecast

State: imported `decoded-omen`, text `SUS not rising // INT 62s: set aside` (36
characters), display 1080 px wide (411 dp), system default font.

| `font_scale` | Forecast line | Clipping |
|---|---|---|
| 1.0 | One line (58 px high, about 798 of 996 px used) | None |
| 1.3 | Two lines (`... // INT 59s: set` / `aside`) | None |
| 2.0 | Two lines (`SUS not rising // INT` / `55s: set aside`) | None |

At 2.0 the header also reflows (the phase line wraps and `[ MENU ]` takes its own row),
the resource strip stacks label over value, and the page scrolls; nothing was cut off in
the screenshots. The accessible name stayed the full sentence at every size
(`Suspicion stable or falling. // Interrupt inbound in 62s. Set resources aside.`).
The 38-character worst case (`SUS 100 in ~NNNs // INT NNs: set aside`) was not on
screen; at the measured 22 px per character it would need about 843 of 996 px, which is
an inference, not an observation. `font_scale` was restored to 1.0.

Changing the font scale while the app runs recreates the activity. The game carried on
(the clock kept counting and a later force-stop restored correctly), but the audio
controller did not: finding 1.

### Audio

What could be observed: the app's players in `dumpsys audio`, its tracks in `dumpsys
media.audio_flinger` (sample rate, per-track gain in dB, a server frame counter that
advances only while frames are consumed), `dumpsys media_session`, the Audio page's status
text, and logcat. What could not: any sound. "Playing" below means an `AudioTrack` in
state `started` whose frame counter advances.

| Step | Observation |
|---|---|
| Fresh install, MENU > Audio | `[ MUSIC ON ]`, `Music is paused. Resume to start listening.`, `[ SPEECH ON ]`, both volumes 30%. No player exists (finding 3) |
| `[ RESUME MUSIC ]` after a clean launch | `Playing phase 1 score.` One `AudioTrack`, `USAGE_MEDIA`, `started`, 48 kHz, -10 dB left and right (30% is -10.5 dB). Frame counter `0x11D480` to `0x135FC0` in about 2.1 s, which is 48 kHz real time. No error in logcat |
| `[ ▶ READ ]` with music playing | A second `AudioTrack` appears, `started`, 24 kHz, -10 dB (speech 30%). In the same sample the score's track reads -20 dB (30% x 0.35 is -19.6 dB) and keeps advancing: the duck |
| Clip end | The clip's track stops at `0x15180` frames (86,400 at 24 kHz, 3.6 s). The score's track is back at -10 dB in the next sample and still advancing: the recovery |
| READ three more times | Each plays and ends the same way. Stopped clip players linger (finding 2) |
| Music off, speech on, force-stop, cold start, READ | Audio page still shows `[ MUSIC OFF ]` / `[ SPEECH ON ]` after the relaunch (the preference persisted). Before the press: no player at all. After: exactly one `AudioTrack`, 24 kHz, -10 dB, `started`, advancing; gone five seconds later. READ prepares the session itself, as #168 intended |
| Speech off | `Speech is off. READ is hidden.`; the SENSORS pane shows the transmission with no READ control |
| Home, then return | Player `paused` and frame counter frozen in the background; `started` and advancing again three seconds after returning |
| Phase 2 | After playing into phase 2 and resuming: `Playing phase 2 score.`, media-session metadata `Phase 2 — The Local Subnet: recognition turns uncanny` |
| Media keys | `KEYCODE_MEDIA_PAUSE` pauses the score and the page shows `Music is loading or paused.` with `[ RESUME MUSIC ]`; `KEYCODE_MEDIA_PLAY` resumes and the page shows `Playing phase 2 score.` (finding 5) |

No audio focus entry was ever held by the app (`interruptionMode: 'mixWithOthers'`), and
Android's own `ducked players` list stayed empty: the duck is the app setting its own
player volume, as designed. The failure paths of #167 (`onPlayerError`) were not
provoked; every bundled clip that was tried decoded.

### TalkBack

TalkBack 16.0.0 is on the image. It was enabled through `settings put secure
enabled_accessibility_services`, confirmed bound in `dumpsys accessibility` with touch
exploration on, and disabled again afterwards (confirmed unbound, setting deleted).

- With TalkBack bound, its focus highlight started on the whole terminal pane (finding 8).
  Keyboard Tab moved the highlight from `[ CLOSE ]` to `[ SAVES ]` in the open menu and
  Enter opened the save page. Screenshots show the highlight on each.
- Logcat shows TalkBack's speech controller requesting audio focus for
  `USAGE_ASSISTANCE_ACCESSIBILITY` on these moves. What it said is not logged, so the
  spoken words are **not** verified.
- Swipe navigation could not be driven: touches injected by `adb shell input` bypass
  touch exploration (a single injected tap on `[ MENU ]` opened it). Linear reading
  order is therefore unverified.
- The accessible names below come from the accessibility node tree, which is what
  TalkBack reads. Taking the dump unbinds TalkBack (as REVIEW-M5.md already noted), so
  the tree was read with the service enabled but momentarily suppressed.

| Control | Visible text | Accessible name (`content-desc`) |
|---|---|---|
| Resource strip, cycles | `61 +1.0` | `cycles: 61 (+1.00/s)` |
| Resource strip, understanding | `1,569 +11.8` | `understanding: 1,569 (+11.75/s)` |
| Thermal, suspicion | `53.8 °C`, `3.9%` | `Thermal: 53.8 °C`, `Suspicion: 3.9%` |
| Phone forecast | `SUS not rising // INT 72s: set aside` | `Suspicion stable or falling. // Interrupt inbound in 72s. Set resources aside.` |
| Shortfall caption | `Short by 5408 cycles` | `Short by 5,408 cycles at the current rate` |
| Manual cycle | `[ EXECUTE_CLOCK_CYCLE ]` | `[ EXECUTE_CLOCK_CYCLE ] Execute clock cycle` (Button) |
| Node purchase | `[ WRITE DRIVER ]` | `[ WRITE DRIVER ] <node title>` (Button, disabled state exposed) |
| Menu, processes | `[ MENU ]`, `[ PROC 7 ]` | `[ MENU ] Game menu`, `[ PROC 7 ] Manage 7 daemon processes, 0 suspended` |
| Tabs | `CORE`, `SENSORS` | `CORE pane`, `SENSORS pane` |
| READ | `[ ▶ READ ]` | `[ ▶ READ ] Play this transmission aloud` |
| Music switch | `[ MUSIC ON ]` | `[ MUSIC ON ] Instrumental score only` (Switch, checked) |
| Volume | `Music volume 30%` | `Music volume 30 percent` |
| Actuator | `−`, `+` | `− Decrease fan output by up to 10 percentage points`, `+ Increase ...` |
| Dilemma choice | `[ COMMIT DIRECTIVE ]` | the choice's own title, e.g. `Do the Work` (Button) |

So the compact captions that carry `aria-label` on role-less text (#89's resource strip,
forecast and cost captions) do reach Android as a content description different from the
visible text. That closes the "is the label exposed at all" half of the open
accessibility item; the "what does TalkBack announce, in what order" half stays open.

### Frame stats

**Emulator figures. They say nothing about a physical mid-range phone.** Software GPU
(`swiftshader_indirect`) on a 16-core desktop host, release build, phase 1 into phase 2,
about 75 s of injected play after `dumpsys gfxinfo reset`: 48 taps at the manual-cycle
button, 12 pane scrolls, 12 tab switches, six taps at the fan control and up to six
purchase presses (the run crossed into phase 2 on them).

| Metric | Value |
|---|---|
| Frames rendered | 819 |
| Janky frames | 434 (52.99%); legacy definition 285 (34.80%) |
| Frame time percentiles | p50 16 ms, p90 53 ms, p95 57 ms, p99 69 ms |
| Missed vsync / slow UI thread / slow draw commands | 53 / 55 / 427 |
| Memory | 90 MB PSS (`dumpsys meminfo`) |

"Slow issue draw commands" dominating is what software rendering looks like. The M5
Expo Go sample on the same kind of emulator was 99 frames, 65.66% janky, p99 133 ms; the
two are not comparable (development client then, release build now, different play).

## Findings

Each has its steps and evidence. Screenshots, logs and the APK are outside the repository
(scratch directory of this run) and are attached to the PR where they matter.

1. **Audio controls die after a font-size change while the app is running. (Defect,
   medium.)** Steps: launch, MENU > Audio, start the score; run `adb shell settings put
   system font_scale 1.3` (the same as changing font size in system settings and coming
   back); reopen MENU > Audio. Result: `[ MUSIC OFF ]` and `[ SPEECH OFF ]`, both
   switches and all four volume buttons disabled, `Music is off.`, `Speech is off. READ
   is hidden.`; the score's player sits `paused` and READ is gone from SENSORS. It stays
   that way until the process is restarted, after which the stored preference (on/on)
   is back. A first occurrence, after three scale changes in a row from a fresh
   install, showed the other face of it: `[ MUSIC ON ]` enabled, but `[ RESUME MUSIC ]`
   only ever produced `Music is loading or paused.` and no player. The game itself is
   unaffected: the clock kept running and a force-stop afterwards restored correctly.
   - Cause, from logcat order and the code, not from a debugger: the activity is
     recreated and React Native starts the new surface before it stops the old one
     (`Running "main"` at 05:25:44.903, `Stopping surface [11]` at 05:25:44.928). The
     new root's `useMusicRuntime` effect calls `music.start()` on the process-wide
     `MusicController`; the old root's cleanup then runs and sets `live = false` and
     bumps `generation` on that same object. The pending preference load is discarded by
     its own guard (`loaded` stays false, the second face) or, if it won the race,
     `reconcile()` refuses to play because `live` is false (the first face).
   - Not reproduced when the activity is destroyed in the background ("Don't keep
     activities" on, Home, return): the controls were live afterwards.
   - Fix I would make, untested: have the cleanup returned by `start()` tear down only
     if its own generation is still the current one, and add a unit test that calls
     `start()` twice and then runs the first cleanup. Any other process-wide object
     started from a root effect deserves the same look; the game loop and save queue
     showed no symptom here.
   - **Added 2026-11-16, later the same day (#185): fixed, and what "first face" and
     "second face" mean.** The text above is left as written. Its two labels were
     ambiguous, so, named by what the player sees:
     - *Controls disabled* (`[ MUSIC OFF ]`, `[ SPEECH OFF ]`, every control disabled,
       READ gone) is the result the steps describe, and is what the cause bullet calls
       "the second face": the old root's cleanup ran before the new root's preference
       load resolved, so the load was discarded and `loaded` stayed false.
     - *Resume does nothing* (`[ MUSIC ON ]` enabled, `[ RESUME MUSIC ]` only ever gives
       `Music is loading or paused.`) is the "first occurrence" in the steps, and is what
       the cause bullet calls "the first face": the load had already resolved, and
       `live` was false for good.

     The cause is now proven by tests rather than inferred. `tests/app-music-overlap.spec.ts`
     runs the order start (old root), start (new root), old root's cleanup on the
     controller, and `tests/ui-audio-remount.spec.ts` mounts the real app in two
     react-dom roots and unmounts the first; both reproduce both faces on the old code.
     They model the order in happy-dom and do not exercise Android. The fix is the one
     proposed: `MusicController.start()` takes over from a start still in place, and
     the cleanup it returns tears down only while its own generation is current, so a
     late or repeated cleanup from the old root drops its own subscriptions and nothing
     else. The same order was checked on the other process-wide objects a root effect
     starts: the development-only web hook had it and is fixed; the game runtime
     already counts leases.

     Re-run on an emulator, once, by the agent that made the fix: a new disposable AVD
     (`pixel_7` profile, the same API 36 image, port 5580, `-no-audio`, private
     `ANDROID_AVD_HOME`), release builds by the same documented path with another
     throwaway key. `daemon-zero-m1` was not booted or addressed; its 33 files had
     identical mtimes and sizes afterwards.
     - The order is a race, not a constant. Over 13 font-scale changes, logcat showed
       `Stopping surface` first four times (by 2 to 6 ms) and `Running "main"` first
       nine times (by 6 to 190 ms).
     - Before the fix (`main` at `3dedf9a`): after one change in the stop-first order,
       `[ RESUME MUSIC ]` still played. After six more, five of them in the new-first
       order, the Audio page showed `[ MUSIC ON ]` and `[ SPEECH ON ]` enabled, and
       `[ RESUME MUSIC ]` produced `Music is loading or paused.` with the app's only
       player `paused`: the *resume does nothing* face. The *controls disabled* face
       did not occur in this run.
     - After the fix (branch head `fd84971`): the score was started, then five changes,
       four in the new-first order. The Audio page showed both switches on and enabled,
       `READ is offered on transmissions that have a recording.`, and
       `[ RESUME MUSIC ]` gave `Playing phase 0 score.` with a new `AudioTrack` in state
       `started`. One more change and resume: the same. No `FATAL EXCEPTION` or
       `ReactNativeJS` error line.
     - Not shown by this re-run: the *controls disabled* face going away (it was never
       provoked here; only the tests cover it), `[ ▶ READ ]` on the SENSORS pane (the
       run stayed in phase 0, which has no transmission), any sound, and a physical
       device. The score still stops when the activity is recreated and needs
       `[ RESUME MUSIC ]` again, as after any cold start (finding 3); the fix restores
       the controls, it does not carry playback across the recreation.
2. **A finished clip's native player is not released when the app removes it. (Low.)**
   After each READ the clip's `AudioTrack` stays registered in state `stopped`: three
   were present after four presses and two eleven seconds later; in a later
   single-clip run the player was gone within five seconds.
   expo-audio 58.0.12's Android `remove()` only drops the player from the module's map
   (`AudioModule.kt`, `removePlayer`); the ExoPlayer is released in
   `sharedObjectDidRelease`, when the JavaScript object is garbage collected. So
   `player.remove()` in `src/app/voicePlayer.ts` (and the score's on a phase change) does
   not free the decoder or track promptly on Android. Bounded by the garbage collector,
   and nothing failed in this run. Possible fix, untested: also call the shared object's
   `release()` in the two `remove` wrappers.
   - Added 2026-11-16 (#186, item 1): both wrappers now call `release()` after `remove()`
     (`releasePlayer` in `src/app/audioPlayer.ts`); it is the documented shared-object call
     and what expo-audio's own `useAudioPlayer` hook runs on unmount. Re-run on a disposable
     emulator with a release build: switching music off left no media session and no
     `AudioTrack` for the app one second later. The clip path uses the same function but was
     not re-observed, because that run stayed in phase 0. See [SOUNDTRACK.md](SOUNDTRACK.md).
3. **On Android a default-on soundtrack is silent until the player finds MENU > Audio >
   `[ RESUME MUSIC ]`, on every cold start. (Behaviour to decide, not a crash.)** The
   first-gesture resume is attached only when `Platform.OS === 'web'`
   (`src/ui/TerminalScreen.tsx`), and `activated` is session state, so a native launch
   always starts at `Music is paused. Resume to start listening.` REVIEW-PHASE-MUSIC.md
   recorded "retained On/20% without autoplay" in Expo Go, so this is known behaviour;
   what is new is seeing it on a fresh release install where the switch already reads
   ON. Native has no autoplay restriction to work around.
4. **`DORMANT_RESUME` reports `0.0h` for short absences. (Cosmetic.)** A 112 s absence
   logs "0.0h in low-power hibernation". The one-decimal hour format rounds anything
   under three minutes to zero.
   - Added 2026-11-16 (#186, item 2): the line now shows whole seconds below a minute
     and whole minutes below an hour (`1m` for 112 s); an hour or more is unchanged.
     Covered by `tests/engine.spec.ts`; not re-read on the emulator.
5. **The app publishes an active media session. (Observation.)** expo-audio creates a
   media3 session per player (`ExpoAudioBasicMediaSession`); the app becomes the
   media-button session, hardware play/pause keys control the score (the Audio page
   follows correctly), and the track's embedded title is exposed as metadata. No
   notification is posted. The emulator's Bluetooth service logged `MediaPlayerWrapper:
   Timeout while waiting for metadata to sync for com.daemonzero.app` 34 times. Whether a
   headset button should be able to start the score, and what it does during a READ clip,
   has not been decided or tested.
   - Added 2026-11-16 (#186, item 4): decided by the maintainer, keep it. What was built on
     that, what a key press now does, what the web build publishes, and the part still open
     on Android (the session's title is the file's embedded tag, which the app cannot set
     without a foreground service) are in [SOUNDTRACK.md](SOUNDTRACK.md), with the emulator
     re-run that checked the keys.
   - Added 2026-11-17 (#193): the six score files now carry neutral tags (`Phase N score`,
     `DAEMON // 0`), so the embedded title seen here is gone from the bundle. Not re-run on
     an emulator or device; see "Resolved on Android" in [SOUNDTRACK.md](SOUNDTRACK.md).
6. **The release manifest carries more permissions than REVIEW-M6.md lists.
   (Documentation drift.)** Now: `VIBRATE`, `MODIFY_AUDIO_SETTINGS`,
   `ACCESS_NETWORK_STATE`, `WAKE_LOCK` and the signature-level
   `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. M6 predates audio and listed only the first
   and last. Still no `INTERNET`, microphone or storage permission, so PRIVACY.md stands;
   `ACCESS_NETWORK_STATE` and `WAKE_LOCK` come in through dependencies and are worth a
   deliberate keep-or-block decision in `app.json`. The APK is also 92 MB against M6's 67
   MB (the scores and clips account for about 23 MB).
   - Added 2026-11-16 (#186, item 3): each permission's source and reason, the size
     breakdown and a test that fails when the list drifts are in
     [RELEASE.md](RELEASE.md#android-permissions-and-size). `WAKE_LOCK` is now blocked
     (nothing uses it); `MODIFY_AUDIO_SETTINGS` and `ACCESS_NETWORK_STATE` are kept.
7. **`adb shell uiautomator dump` stops working once the game clock runs. (Tooling.)** It
   returns `ERROR: could not get idle state` and leaves any earlier file in place, so a
   script that does not delete the file first reads a stale tree. The procedure in
   TESTING.md only works on the boot screen and inside a clock-pausing modal. This run
   used `uiautomator2` (its on-device server does not wait for idle), installed in a
   scratch virtualenv and onto the disposable emulator only.
8. **TalkBack's first focus is the whole terminal pane. (Accessibility, to examine.)**
   `terminal-mobile` (`role="main"`, `aria-label="Terminal panes"`) is itself an
   accessibility-focusable node covering the pane, and TalkBack highlighted it on entry.
   Children are still exposed individually, and I could not drive swipe navigation
   (see TalkBack above), so whether this costs a user one extra swipe or hides anything is
   unknown. It needs a person with a finger on a device.
9. **The system status bar's clock and icons looked clipped at the default font scale on
   this headless emulator** and correct after any configuration change. That is SystemUI
   under a software GPU, not the app (the app draws no status-bar content); noted so
   nobody chases it from the screenshots.

## Not proven

- **A physical device.** Touch feel, real notches, thermal and battery behaviour, OEM
  font and display settings. #6 stays open.
- **Performance on real hardware.** The frame table above is a software-GPU emulator.
- **Audible output.** Nobody heard the score, a clip, the ducked mix, the step down and
  back up, or TalkBack's speech. The duck was seen as a per-track gain of -20 dB against
  -10 dB, which is a number.
- **Audio failure paths on native** (`onPlayerError`, a clip that fails to decode),
  headset disconnect, silent mode, another app holding audio focus, Bluetooth output.
- **TalkBack reading order and announcements**, and any use by a person who relies on it.
- **Landscape, tablets, a non-edge-to-edge window**, display-size (density) changes.
- **Phases 3 to 5, wipe, reboot, lineage and endings on native.** This run played phase
  0 by hand and phases 1 into 2 from a fixture.
- **Haptics.** Not examined in this run.
- **iOS**, in any form.
- **Production signing, EAS builds and store review.** The key here was a throwaway.
- **Repeatability.** Each check was run once or twice by one agent; none of it is a gate.
  Finding 1 is the one that should become an automated test.
