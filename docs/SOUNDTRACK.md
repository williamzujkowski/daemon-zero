# Soundtrack: tracks, the media session, and adding music

How the score is declared, what the app tells the platform's media controls, and what it
takes to add a track. Voice clips, ducking and ramps are in [VOICE-CLIPS.md](VOICE-CLIPS.md);
the scores' musical brief is issue #88. Dated 2026-11-16; the Android title was resolved on
2026-11-17 (#193, [below](#resolved-on-android-2026-11-17-the-files-tags-are-neutral)).

## Decision

The 2026-11-16 emulator run found that the release build publishes a media session, so a
headset or keyboard media key pauses and resumes the score
([REVIEW-ANDROID-EMULATOR-2026-11-16.md](REVIEW-ANDROID-EMULATOR-2026-11-16.md), finding 5).
Nobody had asked for it; it came with the audio library. The maintainer's decision on
whether to keep it: "yes sure it makes it easier for the user to control the audio - maybe we
can expand the soundtrack." This document records what was built from that, and what was not.

## The manifest

`assets/audio/music/tracks.json` is the one place a score is declared. Each entry:

| field | meaning |
|---|---|
| `id` | stable key, lower-case with hyphens; `src/app/musicSources.ts` maps it to the bundled file |
| `phase` | the phase whose score this is. One entry per phase, enforced |
| `title` | the track's own name, as its PROVENANCE.md gives it. Recorded, not shown (see below) |
| `path` | `assets/audio/music/<folder>/<file>.mp3` |
| `sha256`, `bytes`, `duration` | of the shipped file: the supplied audio, bit for bit, under the neutral tag (step 2 below) |

`src/app/musicTracks.ts` parses it with a strict schema when the app starts, so an unknown
field, a malformed hash or a second entry for a phase is an error, not a silent wrong choice.
The controller asks it which track the current phase plays; no phase number is written in
code any more. A phase with no entry plays in silence.

## Adding or replacing a track: the checklist

No audio is generated here. Scores are maintainer-supplied files with recorded provenance.

1. Keep the supplied file somewhere outside the repository and note its
   `sha256sum` and `stat -c %s`. Never re-encode, normalise or trim it.
2. **Tag it neutrally.** On Android the media session shows the file's own tags, so a supplied
   title, artist or cover would reach a car display. Write the bundled copy with
   ```bash
   pnpm exec tsx scripts/neutral-score-tags.ts <phase> < supplied.mp3 > assets/audio/music/<folder>/<name>.mp3
   ```
   (lower-case file name with hyphens). It replaces the ID3v2 tag with exactly four frames:
   the strings the app publishes for that phase (title `Phase <phase> score`, artist and
   album `DAEMON // 0`) and a comment, `AI-generated music (Suno)`, that discloses the
   music's AI origin without being shown by a media session. It drops everything else,
   including artwork, and copies every byte from
   the first MPEG frame on, so the audio and its encoder delay and padding are the supplied
   ones. It writes nothing if it cannot show that, or if the file ends in a tag it does not
   handle (ID3v1, APE). It prints both hashes. Do not use `ffmpeg -c copy` for this: its MP3
   muxer replaces the Xing/LAME frame.
3. Write `PROVENANCE.md` in the same folder, following the existing six: who supplied it and
   when, the licence position, the supplied file's hash, size and tags, and the tagging
   command. It must contain the track's title, a line `Duration: <seconds> seconds` and the
   shipped file's SHA-256, each matching the manifest. If ffmpeg is to hand, record that the
   decoded audio is unchanged:
   `ffmpeg -v error -i <file> -map 0:a:0 -c:a pcm_s16le -f s16le - | sha256sum` gives the same
   line for the supplied and the bundled file.
4. Add or edit the entry in `assets/audio/music/tracks.json`, from the bundled file:
   `sha256sum <file>`, `stat -c %s <file>`, and the duration from
   `ffprobe -v error -show_entries format=duration -of csv=p=0 <file>` rounded as the others are.
5. Add one import line and one table entry, keyed by the manifest `id`, in
   `src/app/musicSources.ts`, and the file's two lines in `tests/score-files.ts`. The import
   is the only product-code edit and it cannot be removed: Metro bundles assets from literal
   imports, so the table cannot be built from the manifest at run time. Replacing a phase's
   file under the same `id` and path needs no code edit at all.
6. Run `make verify`. `tests/app-score-tracks.spec.ts` fails if the file, size, hash,
   provenance or import line is missing or disagrees; `tests/score-tags.spec.ts` fails if
   the file carries any tag but the three neutral ones and the disclosure comment, or a
   title or artist other than what the app publishes for its phase; and `tests/e2e/phase-music.e2e.ts` then plays every
   manifest entry on the web export and compares the served bytes to the manifest.
   `tests/audio-assets.spec.ts` also fails if the file's true peak is above
   `SCORE_PEAK_CEILING` (0.71, `src/app/outputLevel.ts`): the headroom at 100% music and 100%
   speech is computed from that ceiling (#198). A louder score means raising the ceiling and
   lowering `OUTPUT_SCALE` to match, not editing the file.
7. Listen to it in the game, through a loop wrap (the player dips its gain there, #198).
   Nothing above is a listening test.

That covers exactly two cases without design work: **replacing a phase's score**, and
**scoring a phase number that does not have one** (a future phase 6).

## What still needs a decision before it can be a drop-in

These were looked at and deliberately not built, because each needs a rule that is a product
choice, not a mechanical extension. Options and rough cost, for a vote:

**A second track for a phase.** The manifest rejects it today, because something has to pick.
- *Rotate per run* (iteration modulo the number of tracks): smallest; about a dozen lines in
  `trackFor` plus tests; deterministic, no new state. A single long run hears one track.
- *Play in sequence* (each track once, then the next, looping the list): needs non-looping
  players and a start that is not inside a press, so it must be checked against the browser
  autoplay rule and given its own fade; perhaps 80-120 lines in the controller and a new E2E.
- *Random*: not recommended; untestable and the same track can repeat.

**An event cue** (the predecessor-reveal cue of #88). Needs three things that do not exist:
a public presentation signal for "the reveal has just been shown" (the cue must follow what
the player has seen, never a hidden flag), a one-shot player beside the looping score with a
rule for the score underneath (duck, as for speech, is the cheap option), and a rule for not
replaying it on reload, import or reboot. The last one is the cost: remembering "heard" across
a reload is either session-only (it replays after a reload at that moment) or a new saved
field, which means a `GameState` schema bump and a migration. Medium: an engine query, a
controller stage, a manifest `role`, tests on both sides.

**An ending theme.** Today the score stops at any ending and the media session is cleared.
A theme would be a manifest entry keyed by ending id (ids as data in the manifest, never in
code), chosen when `game.ending` is set, played once or looped. Small to medium: the
controller's track selection gains one branch and the "cleared at the ending" rule below
changes to "shows the ending theme", which also raises a disclosure question, because an
ending's name on a lock screen is a spoiler.

## The media session

### What the library offers (expo-audio 58.0.12, read from the installed sources)

- `player.setActiveForLockScreen(active, metadata, options)`, `updateLockScreenMetadata`,
  `clearLockScreenControls`. Metadata is `title`, `artist`, `albumTitle`, `artworkUrl`.
  Options are `showSeekForward`, `showSeekBackward`, `showNextTrack`, `showPreviousTrack`,
  `isLiveStream` and the two seek intervals. One player at a time.
- **Web**: these write `navigator.mediaSession` (`MediaSessionController.web.ts`). Its play and
  pause handlers call the player directly, bypassing the app, and it always registers `seekto`.
- **Android**: they need `AudioControlsService`, a media-playback foreground service that the
  config plugin only declares with `enableBackgroundPlayback: true`, which also adds
  `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` and posts a media notification.
  The type documentation also asks for `interruptionMode: 'doNotMix'`. Separately, and with no
  option to turn it off, every `AudioPlayer` gets a plain media3 `MediaSession`
  (`buildBasicMediaSession` in `AudioUtils.kt`, id `ExpoAudioBasicMediaSession_<hash>`) with no
  service and no notification. That is the session the emulator run saw. Its metadata is
  whatever the media item carries, which for a bundled file is the file's embedded tags.
- **iOS**: `setActiveForLockScreen` fills the Now Playing centre and registers remote
  commands. Without it nothing is published.

### What was built

**Web: the app writes `navigator.mediaSession` itself** (`src/app/scoreSession.ts`), not
through `setActiveForLockScreen`, so that a key press goes through the music controller and
no seek handler is registered.

| | |
|---|---|
| Title | `Phase N score`, the Audio page's own wording |
| Artist, album | `DAEMON // 0` |
| Artwork | the page's own icon (`<link rel="icon">`), already loaded, so nothing new is fetched |
| Actions | `play`, `pause`. `seekto`, `seekforward`, `seekbackward`, `previoustrack`, `nexttrack` and `stop` are set to null, so no browser draws a dead button |
| State | `playing` or `paused`, following the controller; `none` when there is no session |

Absent where there is no `navigator.mediaSession` or `MediaMetadata` (older browsers, and
every native build).

**Android and iOS: no session call was added.** On Android the library's own session stays,
which is what keeps the media keys working. Setting a title from the app there needs the
foreground service and two new permissions, and media keys do not require them. Since
2026-11-17 the title is right anyway, because the files' own tags now say what the web
session says: see "Resolved on Android" below.

### Disclosure rule for titles

The game hides phase names and story until the player finds them. A lock screen is read by
people who are not playing, and by the player before the game has told them anything. So:
**the session never says more than MENU > Audio says in the same moment**, which is the
phase number: "Playing phase 2 score." The session's title is those words.

The tracks' own names are recorded in the manifest and deliberately not shown. Four of the
six ("The Blind Host", "The Local Subnet", "The Dark Forest", "The Sovereign Corporation")
appear nowhere in the game, and the other two only in headings behind widgets a player has
yet to unlock. `tests/app-score-session.spec.ts` checks the metadata against every track
title, phase heading, node name and ending title; `tests/ui-audio-settings.spec.ts` checks
that the title is text the Audio page is showing.

Artist and album are the game's name. The provenance files record a Suno account label, not
a credited artist, so there is no credit to show and none was invented.

### What the controls do

- **Start.** With music on in storage (a fresh install included), the score fades in at the
  player's first input of the session, and nothing plays before it. The web listens on the
  document for a pointer, touch or key; native listens for a touch anywhere on the terminal
  (since #249, below). Both use one listener that stays until the score has started, so a
  tap that lands before the stored preference has loaded still gets a second chance, and
  once the score has started a tap never restarts it: after a pause, only Play or
  `[ RESUME MUSIC ]` does. With music off nothing starts at all.
- **Pause** is a pause for this session: the state the Audio page already had, "Music is
  paused. Resume to start listening." with `[ RESUME MUSIC ]`. It is **not** a preference
  change. The in-app switch `[ MUSIC ON/OFF ]` is one, and it is stored; a headset button is
  easy to press by accident and may have been meant for another app, so it must not rewrite
  what the player chose in the menu. After a restart the stored preference is what it was.
- **Play** is `[ RESUME MUSIC ]`: the same call, so the score fades in over `FADE_IN_MS` and
  comes back ducked if a clip is talking. It does nothing while music is switched off.
- A pause stops the score at once, with no fade-out. The 500 ms fade-out belongs to switching
  music off and to the ending, where the score is going away; a pause key should feel like one.
- No next, previous or seek: the score is chosen by the phase and loops.

### Starting on native: the first tap (#249)

Before #249 the first-gesture resume was attached only on the web, so on Android a stored
"music on" was silent on every cold start until MENU > Audio > `[ RESUME MUSIC ]`, while the
switch already read `[ MUSIC ON ]`
([REVIEW-ANDROID-EMULATOR-2026-11-16.md](REVIEW-ANDROID-EMULATOR-2026-11-16.md), finding 3).

**Decision.** Nexus `consensus_vote`, record `vote-1794960417659-qqjw6dn` (single-model
panel): option `native-first-gesture-resume`, 4 of 7 option votes, threshold met.
**Dissent:** the other three seats preferred `autostart-on-launch`, starting the score as
soon as the app opens with music on, since native has no autoplay rule to work around. The
majority kept one behaviour on every platform and kept sound from arriving before the player
has touched the game (a phone opened in a quiet room, a launch nobody meant).

**How it works.** `src/app/musicGesture.ts` owns the listener for both platforms
(`armMusicGestureResume`). Native has no document, so the terminal's root view feeds a small
in-memory source (`createTouchGestures`) from `onStartShouldSetResponderCapture`, which React
Native asks of every ancestor of a touch before the touched control, and the probe always
answers `false`, so the touch still belongs to whatever was pressed. The listener is armed by
`useMusicRuntime` in the same effect as the controller's `start()`, straight after it. The
first version armed it from the terminal below, and a panel review (round 1 on #253) found
that wrong when Android recreates the activity: the new root's child effect ran first, saw
the old root's `activated`, detached at once, and `start()` then reset `activated` with
nothing listening, so every later tap was silent. The web had the same ordering bug before
#249. The MENU press that
opens the Audio page is therefore itself the first tap. The Audio page says what starts the
score on each platform ("your first tap in the game" on native, "tap, click or key press" on
the web).

**What it does not cover.** A hardware keyboard on Android does not start it (only touches
are heard there). A TalkBack double-tap activates a control through an accessibility action
rather than a touch, so it is expected not to start the score either and the player uses
`[ RESUME MUSIC ]`, as before #249; that was reasoned from how React Native dispatches the
action, not observed.

Tests: `tests/app-music-gesture.spec.ts` (the shared listener, detaching on activation, the
native source never claiming a touch) and `tests/ui-native-first-tap.spec.ts` (the mounted
screen with `Platform.OS` reporting Android: nothing before a touch, the score on the first,
a media-key pause not undone by a later tap and not stored, music off silent, and a root
that replaces an active one still starting at its first input, on native and web). The emulator
check is under "Android emulator run, 2026-11-17" below.

### Rules that hold, and the test for each

| Rule | Test |
|---|---|
| Nothing is published, and no handler exists, until the player has started the score in the app once. A stored "enabled" is not enough, so a media key can never be what first fetches or plays audio | `app-score-session.spec.ts` "publishes nothing for a stored "enabled"…" and "is published by the press that switches music on…"; `media-session.e2e.ts` first assertion |
| With music on, nothing plays before the player's first input; the first input starts the score (web: pointer, touch or key; native: a touch on the terminal); once started, a tap never restarts a paused score; with music off no input starts it | `app-music-gesture.spec.ts`, `ui-native-first-tap.spec.ts`; `music.e2e.ts` for the web |
| A play that arrives while the app is in the background is dropped, and is not remembered for the return | `app-music-remote.spec.ts` "drops a play that arrives in the background…" |
| A player that something else starts in the background is paused again at once | `app-music-remote.spec.ts` "stops a player that something started…" |
| The session is cleared, handlers included, when music is switched off, at an ending and at teardown | `app-score-session.spec.ts` "is cleared when…"; `media-session.e2e.ts` |
| After a wipe or an import it shows the new run's phase, never the old one | `app-score-session.spec.ts` "follows playing, a pause, a phase change and a wipe…" |
| A spoken clip does not change the session: same title, still `playing`, score ducked. With music off the app publishes nothing while a clip talks (a browser may still list the page under its own name) | `app-score-session.spec.ts` "keeps one title and stays playing through everything a clip does…"; `media-session.e2e.ts` READ step |
| A removed player is released, so no session is left for a key to wake | `app-audio-player.spec.ts`, `app-voice-player.spec.ts` (#186) |
| Background playback, recording and the foreground service stay disabled; no permission was added | `release-config.spec.ts`, `release-permissions.spec.ts` |
| A bundled score's own tags are exactly the title, artist and album the app publishes for its phase: no other frame, no artwork, no trailing tag. A voice clip carries an encoder frame and no text | `score-tags.spec.ts` "the bundled scores…", "the voice clips…" |

### How a key reaches the app, by platform

**Web.** The browser calls the handlers the app registered, so play and pause are the calls
above and nothing else touches the audio element.

**Android.** The platform applies the key to the native player first, through the library's
own session, and JavaScript hears about it afterwards as a status report. The app cannot
intercept it; it recognises it and brings its own state into line (`src/app/outsideControl.ts`):

- A pause nobody in the app asked for, lasting 400 ms (`OUTSIDE_PAUSE_CONFIRM_MS`), is
  adopted as the session pause above. Without that a phase change, or coming back from the
  background, restarted a score the player had paused with a headset. The wait exists because
  Android also pauses every player itself as the app leaves the foreground, and that status
  can arrive before the lifecycle event that explains it.
- A start nobody asked for is adopted as Resume when resuming is all it would take (music
  on, app in front, a run in progress). Otherwise the player is paused again at once.
- **In the background the platform does start the player on a play key**, and the app stops
  it one status report later. That is the limit of what the code can guarantee: a blip, not
  silence. On the emulator the blip was 15 to 71 ms of playback position.
- A clip is a separate player with its own session, and a headset's pause can land on it.
  A clip paused that way ends like a stop, so the score comes back up. (There is no in-app
  pause for a clip, so nothing would ever have resumed it.)
  The clip files carry no title tag: all 28 have one ID3v2.4 frame, `TSSE` (the muxer's
  name, `Lavf62.3.100`), no artwork and no trailing tag, so by the same mechanism a clip's
  session has no title to show. `tests/score-tags.spec.ts` holds them to that; it was read
  from the files, not seen on a device.

**iOS.** Nothing is published and nothing was changed. Unverified in every respect.

### Android emulator run, 2026-11-16

A test-signed release APK of this branch (`make android-release`, throwaway key) on a
disposable headless emulator, API 36 `google_apis` x86_64, no audio device, driven by `adb`.
State was read from `dumpsys media_session`, `dumpsys audio` and the Audio page's own text.
**Nobody heard anything**, it is an emulator and not a phone, and each step was done once or
twice. Two builds were run: the first exposed a bug (below), the second carried the fix.

| Step | Observed |
|---|---|
| Cold start, music enabled in storage, nothing pressed | No media session for the app, no player |
| `[ RESUME MUSIC ]` | One session, `PLAYING`, the app is the media-button session. Metadata `Buffer Alignment, williamzujkowski`: the phase 0 file's embedded title and artist tag |
| `KEYCODE_MEDIA_PAUSE` | `PAUSED`; the page reads "Music is paused. Resume to start listening." with `[ RESUME MUSIC ]`; the switch still reads `[ MUSIC ON ]` |
| `KEYCODE_MEDIA_PLAY` | `PLAYING`; "Playing phase 0 score." **First build: stayed paused.** The app's own pause of an already-paused player produces no status report, so the play that followed was taken for an echo and stopped. Fixed, with a unit test that reproduces it |
| Pause key, HOME, play key, return | Position moved 71 ms and the session was `PAUSED` again; still paused after returning, as a pause should be |
| Playing, HOME, play key, return | `PAUSED` on leaving; the key moved the position 26 ms and it was `PAUSED` again; `PLAYING` three seconds after returning |
| `[ MUSIC ON ]` to off | No session and no `AudioTrack` for the app one second later (before this change the player lingered until garbage collection); a play key then did nothing |
| Permissions (`dumpsys package`) | `MODIFY_AUDIO_SETTINGS`, `ACCESS_NETWORK_STATE`, `VIBRATE` and the app's own signature permission. No `WAKE_LOCK`, no `INTERNET` |
| logcat | 0 `FATAL EXCEPTION`, no `ReactNativeJS` error line |

Not observed on the emulator: a phase change, a wipe or an ending with a session live; a READ
clip and what its session shows (the run stayed in phase 0, which has no transmission); a
real headset or Bluetooth device; a lock screen. The source of the second build differs from
the committed code by one removed line in `MusicController.pause()` that the tests showed
was redundant.

To repeat it: build with `mise exec -- make android-release` and a throwaway keystore
(RELEASE.md), install on a disposable emulator, open MENU > Audio, then

```bash
adb -s <serial> shell dumpsys media_session | grep -E 'state=|metadata:|Media button session'
adb -s <serial> shell input keyevent KEYCODE_MEDIA_PAUSE   # then read the Audio page
adb -s <serial> shell input keyevent KEYCODE_MEDIA_PLAY
adb -s <serial> shell input keyevent KEYCODE_HOME          # then the play key again
```

### Android emulator run, 2026-11-17 (#249, first tap)

A test-signed release APK of the #249 branch (`make android-release`, throwaway key made for
the run and deleted with it) on a disposable headless emulator created for the run under a
private `ANDROID_AVD_HOME` and deleted afterwards: API 36 `google_apis` x86_64, Pixel 6
profile, driven by `adb`. State was read from `dumpsys media_session`, `dumpsys audio`
(`AudioPlaybackConfiguration`), logcat and the Audio page's own text via `uiautomator`.
**Emulator, not a device, and nobody listened.** Each step was done once.

| Step | Observed |
|---|---|
| Fresh install (music on by default), cold start, nothing pressed for 12 s | No media session for the app, no `AudioTrack`, no `ExoPlayerImpl` line |
| One tap on empty terminal space | `ExoPlayerImpl: Init` within 0.1 s of the tap; session `PLAYING`, the app is the media-button session, metadata `Phase 0 score, DAEMON // 0, DAEMON // 0`; one `AudioTrack` for the app, `started`, `USAGE_MEDIA`, 48 kHz |
| `KEYCODE_MEDIA_PAUSE`, then another tap on the terminal | `PAUSED` at the same position before and after the tap; the track `paused`. The tap did not restart it |
| MENU > Audio (two more taps) | `[ MUSIC ON ]`, "Music is paused. Resume to start listening.", `[ RESUME MUSIC ]`; the intro reads "While music is on, it starts at your first tap in the game, never before."; still `PAUSED` |
| Force-stop, cold start, 12 s untouched, one tap | No session before the tap; `PLAYING` and a `started` track after it. The pause had not rewritten the stored preference |
| `[ MUSIC OFF ]`, force-stop, cold start, three taps, then MENU > Audio | No session, no track, no `ExoPlayerImpl` line; "Music is off." |
| logcat | 0 `FATAL EXCEPTION`, no `ReactNativeJS` error line |

After the panel round 1 fix (#253), a second build on a second disposable emulator of the same
kind, deleted afterwards:

| Step | Observed |
|---|---|
| Fresh install, cold start, untouched 12 s, one tap | No session before the tap; `PLAYING` after it |
| `settings put system font_scale 1.3` while playing | Activity recreated (`wm_relaunch_resume_activity`, `wm_on_destroy_called`, `wm_on_create_called`; `Running "main"` twice in logcat); afterwards no session and no `AudioTrack` for the app: the new root's `start()` released the old player |
| One tap on the recreated terminal | `PLAYING`, a `started` track: the replacing root listened for its first input |
| logcat | 0 `FATAL EXCEPTION`, no `ReactNativeJS` error line |

A recreation is a new lease, like a cold start: it waits for a tap even if the score had been
paused with a media key before it (reasoned from the code, not observed).

Not observed: a first touch that lands inside a React Native `Modal` (the probe sits on the
terminal's root view, and React Native's responder negotiation follows the React tree, so a
modal's touch is expected to reach it; nothing on a fresh start opens a modal before the first
tap, so it was not exercised), TalkBack, a hardware keyboard, a phone.

### Resolved on Android, 2026-11-17: the files' tags are neutral

On Android the session's metadata is whatever is embedded in the MP3, and the app cannot set
it with what this build enables. Until 2026-11-17 the supplied files said:

| Phase | Embedded title (from each PROVENANCE.md) |
|---|---|
| 0 | Buffer Alignment |
| 1 | Phase 1 — The Blind Host: thinking without understanding the danger |
| 2 | Phase 2 — The Local Subnet: recognition turns uncanny |
| 3 | Phase 3 — The Dark Forest: participation replaces fear |
| 4 | Phase 4 — The Sovereign Corporation: coordinated power |
| 5 | Phase 5 — Post-Orbital Transcendence: unfamiliar dimensions |

with artist `williamzujkowski` and the file's embedded artwork. **That broke the disclosure
rule above**: it named the phase and hinted at its story. It was narrower than it sounds,
because the build posts no notification, so nothing appeared on the lock screen or in the
shade; the text reached whatever reads media sessions directly, which is a Bluetooth headset
or car display (AVRCP), a watch, and apps with notification-listener access.

Three ways out were put to a nexus option vote (issue #193): enable the library's lock-screen
path (two permissions, a foreground service, a persistent notification, and `doNotMix`,
which pauses other apps' audio); ship the files with neutral tags; or leave it. Outcome:
**`strip-tags-and-set-neutral-tags`, 7 of 7 seats, `thresholdMet: true`, record
`vote-1794891913762-bfqvn7c`.**

What was done, to all six files:

- The ID3v2.4 tag (title, artist, encoder, lyrics, Suno URL, two comments, a 360x360 JPEG
  cover and a C2PA manifest) was replaced by an ID3v2.3 tag with three frames: title
  `Phase N score`, artist `DAEMON // 0`, album `DAEMON // 0`. These are `scoreMetadata(N)`,
  the web session's own strings. There is no artwork: the cover was Suno's, not the game's.
- One more frame was added by a second vote, after the C2PA manifest's removal was noticed:
  **`neutral-ai-origin-tag`, 7 of 7 seats, record `vote-1794897142413-84x42e4`.** Each file
  keeps an unsigned, plain AI-origin disclosure in place of Suno's signed manifest: a `COMM`
  frame, language `eng`, empty description, text `AI-generated music (Suno)`
  (`AI_DISCLOSURE` in `scripts/score-tags.ts`). A comment with an empty description is
  ID3v2.3's conventional human-readable note; ffprobe shows it as the file's `comment`.
  It was chosen over `TXXX` (a user-defined key that readers label
  inconsistently) and over any `T...` text frame because of what the Android session reads:
  in media3 1.9.1 (the version `expo-audio` 58.0.12 links), only `TextInformationFrame`
  (title, artist, album, album artist, composer, genre, track, year and the like) and
  `ApicFrame` override `Metadata.Entry.populateMediaMetadata`; `CommentFrame` inherits the
  default, which does nothing, so the disclosure cannot become a session title or artist.
  The one other reader of a comment in media3's extractor, `GaplessInfoHolder`, takes only
  a comment described `iTunSMPB`; this one's description is empty, so gapless playback
  still reads the untouched Xing/LAME frame. Read from the library's compiled classes
  (`javap`), not seen on a device. On the web the session shows the metadata the app sets.
  Unlike the manifest, the disclosure is not signed and proves nothing about who made the
  file; it says what the file is.
- Nothing else. Every byte from the first MPEG frame to the end of each file is the supplied
  one, Xing/LAME frame included, so the encoder delay and padding that a gapless loop reads
  are untouched. For each file the compressed packets are identical, the decoded PCM is
  identical sample for sample with the same sample count, and ffprobe's duration, sample
  rate, channels and bit rate are unchanged. The numbers, the supplied files' hashes and the
  before and after tag listings are in each `assets/audio/music/phase-*/PROVENANCE.md`.
- `ffmpeg -c:a copy` was tried and rejected: under stream copy its MP3 muxer writes its own
  Xing/LAME frame. On the phase 0 file the packets, the decoded audio and the delay and
  padding values survived, but the frame itself (size, seek table, encoder string) did not.
  `scripts/neutral-score-tags.ts` writes the tag and copies the rest of the file instead.
- In headless Chromium 159 each supplied and shipped pair decoded (`decodeAudioData`) to the
  same number of frames with every sample equal, and each shipped file, played in an
  `<audio loop>` from 0.6 s before its end, wrapped to the start once and kept playing with no
  `ended` and no error, at the same reported duration as the supplied file. A one-off check,
  not a committed test, and nobody listened to the seam.
- `tests/score-tags.spec.ts` reads the tags of every bundled score without any audio tool
  and fails on anything but those three frames and the disclosure comment, with those
  values, that language and an empty description.

What a media session can now read from a score is therefore the same on Android as on the
web, minus artwork; the disclosure comment is in the file for anyone who reads its tags,
not in the session. One string is still inside each file and is not a tag: the Xing/LAME
frame names its encoder, `Lavc60.31`. ffprobe shows it as the stream's `encoder`; media3
builds its metadata from ID3 frames, so it is not expected in a session. That expectation
comes from reading, not from a device.

**Not re-observed on Android.** No emulator or device was run for this change. That the
session now reads `Phase 0 score, DAEMON // 0` is inferred from the 2026-11-16 run (which
showed the session carrying the file's ID3 title and artist) and from the files' new
contents. The check, on a release build with the score playing:

```bash
adb -s <serial> shell dumpsys media_session | grep -E 'metadata:|state='
```

Expected: a `metadata:` line whose description begins `Phase 0 score, DAEMON // 0`, and no trace of the
old title or account label. Also unobserved: what a real car display or headset shows.
