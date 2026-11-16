# Spoken transmissions — generating and expanding the voice clips

The game's spoken transmissions are **pre-generated audio committed to the repository**, not
device synthesis. This document covers how they are made, how to add more, and what is not
yet wired.

Status: **clips exist, are committed, and play behind a manual control.** Issue #88's slice is
wired for the default (vibration) tier: `src/ui/widgets/Speech.tsx` and `RecordedSpeech.tsx`
each offer a `[ ▶ READ ]` control that plays that line's clip. Nothing autoplays, nothing
queues, and a clip stops when its own line leaves the screen. Speech has its own switch and
level in MENU > Audio, separate from the soundtrack's (see "Separate speech controls" below).

## Why generated assets

Issue #88 gates the slice on *"prove offline voice availability per platform before choosing
system TTS"*. Probed on the served build in a secure context: `window.speechSynthesis`
**exists with zero voices**, and Android/iOS availability cannot be proven without a device.
A nexus panel then rejected a `localService`-gated device-TTS control, because its happy path
could not be exercised in any environment the repository can run — so it would have shipped
unverified.

Clips generated here are offline **by construction**, make no network call at runtime, and
their bytes are testable. That is the same argument the phase scores rest on. See
`assets/audio/voice/PROVENANCE.md` for the model, licence and per-file digests.

## Toolchain

The generator is a build tool, not a runtime dependency: nothing under `src/` imports it.

```bash
python3 -m venv /tmp/voice
/tmp/voice/bin/pip install -r scripts/voice/requirements.txt
/tmp/voice/bin/python scripts/voice/generate-clips.py            # everything, both tiers
/tmp/voice/bin/python scripts/voice/generate-clips.py --only ambient_03
/tmp/voice/bin/python scripts/voice/generate-clips.py --check    # verify committed bytes
```

CPU only. 4.5 s of speech generates in about 0.4 s warm; the first call fetches the model
from Hugging Face, which is why this runs at build time and the game does not.

`--check` compares every committed file against `MANIFEST.json` and exits non-zero on any
mismatch. Use it when reviewing an asset change.

## Two tiers, and the upgrade they imply

| Tier | Directory | Sound | When the player hears it |
| --- | --- | --- | --- |
| Default | `vibration/` | band-limited, crushed, hum, dropouts | out of the box |
| Upgraded | `clean/` | the model's own output | after buying the acoustic upgrade |

The fiction is that transmissions arrive through **drive vibration** rather than a speaker, so
the degraded take is the honest default: the AI is hearing hardware, not a recording studio.
Both tiers are generated so the upgrade becomes a content flag rather than a new asset pass.
**The upgrade itself is not wired** — the clean tier has no source entry, no flag and no
control.

**Deferred by vote.** A nexus option vote chose `defer-keep-assets-document` (7 of 7 seats
selecting, record `vote-1794810906233-m6hxos1`). The clean clips stay in the repository
unbundled: nothing imports them, so they cost no app bytes. Wiring an "acoustic upgrade" needs
two things first, in this order: a design beat in `docs/DESIGN.md` that says what the upgrade
is in the fiction and what it costs, and a human listening comparison of the two tiers. Until
both exist there is no flag, node or source table for the clean tier, by decision rather than
by omission.

## How playback is wired, and the vote that chose it

`[ ▶ READ ]` on the decoded-transmission line and on each recorded transmission plays that
line's clip once. The pieces:

| Piece | Job |
| --- | --- |
| `src/app/voiceSources.ts` | One literal import per clip, so Metro packages every file. Ids are content ids; a test fails if this table and `MANIFEST.json` disagree. |
| `src/app/voicePlayer.ts` | One clip at a time: starting a clip stops the previous one, a finished or failed clip releases its player, volume follows the speech preference. |
| `src/app/voicePlayer.ts` (`onVoiceActivity`) | Reports when a clip starts talking and when the last one stops. It does not import the soundtrack. |
| `src/app/musicController.ts` (`setDucked`, `DUCK_RATIO`) | Scales the score to `DUCK_RATIO` of its preference level while ducked, in the one function (`level()`) every level it aims at comes from. |
| `src/app/volumeRamp.ts` | The only writer of a score player's level: linear ramps that can be retargeted, cancelled, and closed when the player is released. |
| `src/app/musicSession.ts` | The one joint between the two: voice activity drives `setDucked`. `useSpeechPreference()` hands the widgets the speech switch and level only. |
| `src/app/audioPreferences.ts` | The stored preference, version 2: music `enabled`/`volume` and `speechEnabled`/`speechVolume`, with the version 1 migration. |
| `Speech.tsx` / `RecordedSpeech.tsx` | The control, 44px tall, shown only when a clip exists **and** speech is on. Stepping to another line stops the clip. |

**What stops a clip, exactly.** Pressing READ on the live line *holds* that line, the same way
`NEXT TRANSMISSION` does, so the eight-second live rotation cannot take the line and its voice
away mid-sentence; `FOLLOW LIVE` releases it. The live line's clip stops when that line leaves
the screen (a step, a return to live, the widget closing) and the stop is scoped to that
line's id, because both widgets share one player: the live rotation must never cut off a
recorded transmission. A recorded transmission's clip belongs to its row, so it stops when the
panel is collapsed, emptied, or remounted by a wipe or import. Turning speech off stops
whatever is playing; turning music off does not. A panel review found the earlier
version stopped *any* clip on *any* line change, which truncated every clip in the default
motion setting; `tests/ui-speech.spec.ts` now pins both halves.

**The score ducks while a clip talks.** Score and clips both measure about -15 LUFS, so at an
equal preference they compete. While a clip is in flight the score plays at `DUCK_RATIO`
(0.35, roughly -9 dB) of the music preference level, and returns to that level when the
clip stops. It gets there and back by a short ramp (`DUCK_RAMP_MS`, see "Ramps" below), so
the clip's first 200 ms play over a score that is still on its way down. The speech level plays no part in the duck. With music off there is no score
player, so the signal is remembered and nothing else happens. "Stops" is every path above,
because they all end in `stopVoiceClip`: the clip finishing or failing, a step away from the
line, a collapse or remount, and speech being turned off. Four details are pinned by tests
rather than left to luck:

- **A failed clip gives the score back.** A clip whose media cannot load or play never reports
  an ending, so waiting for `didJustFinish` alone left the score ducked under silence. The
  player now releases the clip on any status whose `error` is set, the same field the
  soundtrack reads for its own failures, and on a `play()` or player creation that throws; a
  clip that never started is never reported as talking. The exception still propagates, as
  it did before for a failed creation. No timer is involved: see the stall limit below.

- **A replacement does not bounce.** Pressing READ on a second line while the first is talking
  is reported as one stretch of speech, so the score stays down instead of jumping up for an
  instant between the two.
- **A duck survives a volume change and a phase change.** The ratio is applied where the
  controller aims a level, not once at the moment the clip starts, so moving the slider
  mid-clip stays ducked and a score created by a phase change mid-clip fades in to the ducked
  level and never above it.
- **The preference is never ducked.** Only the level handed to the player is scaled; the value
  shown in the audio settings and written to storage is the one the player chose.

## Ramps, and the vote that chose them

The score used to change level in steps: straight to the ducked level and back, and a hard
stop and start on a phase change, a wipe or import, the ending, and the music switch. It now
ramps, on **one player at a time**. There is no crossfade and never a second score element.

| Constant (`musicController.ts`) | Value | Ramp |
| --- | ---: | --- |
| `DUCK_RAMP_MS` | 200 ms | Down to the ducked level when a clip starts, and back up when it stops. |
| `FADE_OUT_MS` | 500 ms | A score that nothing replaces, before its player is released: the ending, and music switched off. |
| `FADE_IN_MS` | 500 ms | Every start of a player from silence: a new phase score, a restart after a wipe or import, the first start, a return from the background. |

**A phase change, wipe or import is a cut followed by a fade-in, not a fade-out followed by a
fade-in.** That is less than the vote chose, and it is deliberate: see "Why the outgoing score
is cut on a phase change" below.

**These durations are unheard defaults.** Each is the middle of the range the vote named.
Nobody has listened to a single ramp; they are meant to be retuned by ear.

**The vote.** A nexus option vote chose `build-short-ramps-single-player`: 4 of 7 seats
selecting, `thresholdMet` true, record `vote-1794823777700-jgjjamp`. Two dissents are recorded,
not dropped:

- **`defer-all-fades-until-listened`, 2 seats (Contrarian and Scope Steward).** Issue #88
  itself says to qualify fades through listening before implementing them. A panel can lift
  that requirement, but it supplies no evidence that unheard ramps improve these scores; and
  Web Audio or another library could do ramps, on web only. This objection is not answered by
  the build: the ramps below are exactly as unheard as it says.
- **`build-duck-ramp-only`, 1 seat.** Ramp the duck, and keep phase transitions as hard cuts
  until someone has listened to them. Also not answered: the phase fades were built unheard.

**How it works.** `src/app/volumeRamp.ts` is a small scheduler that owns the only path to one
player's level. It steps linearly every `RAMP_STEP_MS` (25 ms), counts steps rather than
reading a clock, and writes the target itself as its last step, so a ramp lands exactly on the
level and a throttled timer can stretch one but not bend it. The controller gives every player
its own ramp and aims it; the rules that matter:

- **A new target starts from the current level.** A clip that ends mid-duck turns the score
  round from where it had got to, not from the ducked level.
- **A start is never left to a timer.** A new player is created and `play()` is called in the
  same call that asked for it. A fade-out still in flight when a start arrives (music switched
  back on, a new run during the ending) is cut short and its player removed first, so there is
  still one player.
- **A fading player has no voice, and the status reports the setting, not the tail.** Its
  status callbacks are ignored from the moment the fade-out starts, under the same guard that
  already ignored removed players. `playing` is false from that moment, and MENU > Audio reads
  `Music is off.` (or `Music is stopped for this run.` at the ending) at once, while the
  element is audible for up to 500 ms more. The alternative, reporting "playing" for a score
  the player has just switched off, was judged the worse lie.
- **A fade-out in flight still hears the volume control, downwards only.** Volume 0 removes
  the fading player at once. A lower level clips it to that level at once and it carries on
  to silence on its original deadline. The cap is the preference itself, never the ducked
  level, so a volume change made while a clip is talking cannot duck it by the back door. A higher level writes nothing to it: nothing ever turns
  a fading player up. A duck or its release does not touch it either, since bending it down
  would be a step and letting it rise would be wrong. Switching music off during an ending's
  fade-out changes nothing: the fade-out in flight is the one switching off would have
  started.
- **A released player is never written to.** Its ramp is closed before the player is removed,
  and a closed ramp refuses every write, including one a timer had already queued.
- **The preference is never ramped.** Only the level handed to the player moves; the stored
  value and the number in the audio settings are untouched.
- **A volume change mid-ramp bends the ramp** to the new level, from where it is, over the
  steps it had left and on the timer it already has, so it still ends on its original
  deadline. The timer is not restarted: a held or dragged control changes the level faster
  than one step, and a ramp restarted each time would stand still until the input paused. At
  rest a change is immediate, as before. A change to 0 is always immediate.
- **Ducking and fades compose.** A duck during a fade-in carries on from the current level to
  the ducked one; a phase change while ducked fades out from the ducked level and the new
  score fades in to it.
- **Nothing is scheduled for silence.** With music off there is no player; at volume 0 the
  level is set, not ramped, and a silent or paused player is released at once.

**Why the outgoing score is cut on a phase change (panel round 1 on PR #183).** The first
version faded the old score out for 500 ms and only then created the next player, from the
ramp's last timer tick. A reviewer pointed out what that costs on WebKit. Traced through the
code: a purchase is `Pressable.onPress` -> `gameRuntime.dispatch` -> the store's synchronous
`setState` -> the controller's subscription -> `createMusicPlayer` -> `player.play()` ->
`HTMLMediaElement.play()`, all in the call stack of the click. Deferring that `play()` to a
timer takes it out of the gesture. If a browser refuses a `play()` made outside a gesture,
expo-audio's web player reports the rejection as a status with `error` set, which the
controller turns into `Playback unavailable` - after every phase change. Whether Safari would
in fact refuse is **not known and could not be tested here**; the design below simply does not
depend on the answer. The options weighed:

- *Create and start the next player silently inside the gesture, fade it in after the old one
  has faded out.* Rejected: two score elements would be playing for 500 ms, which is the one
  thing this feature may not do, and on iOS browsers, where volume is ignored, the "silent"
  one would be at full level over the old one.
- *Keep the fade-out and defer only the fade-in.* The same thing: the `play()` either waits
  for the timer or overlaps.
- *Cut the old score, start the new one in the same call, fade it in.* **Chosen.** `play()`
  stays exactly where it was before ramps existed, there is one element at every instant, and
  what is lost is the 500 ms fade-out on a phase change, wipe or import. This is also what the
  `build-duck-ramp-only` dissent asked for on phase changes, for a different reason.

The fade-out is kept where no `play()` follows it: the ending and the music switch.

**A fading player's release never throws.** Its last step runs from a timer, where nothing
could catch a `pause()` or `remove()` that threw; and a start, a volume change or
backgrounding that releases it early must not be stopped by the clean-up of a player nobody
is listening for. The player is removed and forgotten and the error is dropped. It is not
shown as `Playback unavailable`: that message says the score the player asked for is not
playing and offers Resume, and at this point no score was asked for. The cost is that such a
failure leaves no trace. The live player's own release still throws to its caller, as it did
before ramps.

**Timers.** The ramp takes its interval from `src/app/clock.ts` (`systemClock.every`), the
app layer's one owner of real timers, and tests can hand it another clock.

**Paths that stay immediate, and why.**

- **The outgoing score on a phase change, wipe or import.** Cut, so the new player's `play()`
  stays in the call that caused it (above). The new score still fades in.
- **Backgrounding.** The score is paused at once and any ramp is cancelled; a fade-out in
  flight is cut short and its player released there and then. A suspended app may never run
  the timer that would finish a ramp, and a score that kept playing in the background while
  it waited would break the no-background-playback rule. The return to the foreground fades
  in.
- **Teardown** (the terminal unmounting). Every timer is cleared and every player released at
  once: nothing may outlive the controller.
- **A playback failure.** The player is paused where it is; there is nothing to fade.
- **The voice clips.** They start and stop as before and are not ramped.

**Reduced motion is not consulted.** `useReducedMotion` is read only by visual widgets
(`Speech`, `Sensory`, `Readouts`, `PurchaseButton`, `DilemmaModal`, `useDecryptText`); nothing
in the repository treats audio as motion, so the ramps do not depend on that setting.

**Platforms.** Browsers on iOS ignore programmatic volume, so no ramp happens there: the
score neither ducks nor fades. A phase change behaves as it did before ramps. The one
difference is that switching music off, or reaching the ending, leaves the score playing at
full level for 500 ms before it stops. Native (Android/iOS) ramps are unexercised.

**The manual contract won an option vote, but the vote did not ratify.** Two runs of the same
question on the nexus gateway arm:

    run 1 ... 5 of 7 seats voted, manual 3 / defer 1 .. no_quorum (3 of 5 inspected the artifact)
    run 2 ... 7 of 7 seats voted, manual 4 / autoplay 2 .. no_quorum (3 of 5 inspected the artifact)

`no_quorum` is not an approval, and the tally is not a ratification — the manual option leads
in both runs, which is why it was built, but the blocking reason was mechanical: seats answer
the proposal without reading the artifact, so an option vote on this arm cannot pass. Filed as
nexus #7756.

**The dissent is real and is recorded, not dropped.** The Contrarian approved on the argument
that these clips are unheard and any wiring ships an unverifiable feature; the Scope Steward
rejected outright with `SCOPE_CREEP` and `YAGNI`, on the same grounds. The manual contract is
partly an answer to them — it cannot startle a player, it costs one extra press, and it can be
removed without touching the assets — but it does not answer the core of their objection, which
is that nobody has confirmed the audio plays at all. See the limits below.

The autoplay option was not built. It carried two hazards the manual one removes: a gesture
rule that can silently swallow the first clip, and two lines talking over each other.

## Separate speech controls, and the vote that chose them

One stored preference used to gate both the soundtrack and READ, behind a switch labelled
"Music enabled": a player who muted the score lost the transmissions too, and could not set
one level against the other. A nexus option vote chose `split-speech-controls` (7 of 7 seats
selecting, `thresholdMet` true, record `vote-1794810900116-du48mwo`).

MENU > Audio now carries both sets on the one page, built from the same switch and level
components at the same 10-point step:

| Control | Gates |
| --- | --- |
| `[ MUSIC ON/OFF ]`, `Music volume N%` | The phase score only. |
| `[ SPEECH ON/OFF ]`, `Speech volume N%` | Whether READ is offered, and the level a clip plays at. |

- READ shows when **speech** is on and a clip exists, whether or not music is on.
- Turning speech off stops a clip in flight; a speech level change reaches a clip in flight.
- Music on/off and the music level neither hide READ nor touch a clip.
- With music off and speech on, READ prepares the shared audio session itself
  (`ensureAudioMode`); the soundtrack backend is never loaded.
- The header `[♪ ON]` switch at wide widths is still the music switch and nothing else.

**The stored value and its migration.** The preference is version 2 in the same storage slot
(`daemon-zero.audio.v1`; the slot name is not the schema version):
`{ version: 2, enabled, volume, speechEnabled, speechVolume }`, where `enabled`/`volume` are
the music pair. It is not part of `GameState` and no game save changes.

- A stored version 1 value `{ version: 1, enabled, volume }` is read as
  `speechEnabled = enabled`, `speechVolume = volume`: speech inherits exactly what used to
  gate it, so nobody's audible behaviour changes on upgrade.
- Reading does not rewrite the slot. The first change the player makes writes version 2.
- Only an exact version 1 or an exact version 2 is accepted. Anything else (unknown version,
  extra or missing key, out-of-range or fractional level, over 256 characters, not JSON) is
  silence for both music and speech, as it was for music before.
- An empty slot is a fresh install: music on at 30 (the earlier default-on vote), speech on at 30.

A build from before the split that reads a version 2 value treats it as malformed and falls
back to silence; there is no downgrade path, and none is planned.

## The vibration chain, and one measured lesson

Applied in this order, in `vibration()`:

1. **Sample-rate crush** to 8 kHz at 7 bits — the stair-stepped grit of a cheap codec.
2. **Band-limit** to 220-3000 Hz with an FFT mask — the bandwidth of a signal travelling
   through a chassis.
3. **60 Hz hum** at 3.5% — the transformer the fiction keeps mentioning.
4. **Irregular dropouts** (fixed seed) — the carrier cannot hold a lock, so it stutters.

**Order matters, and getting it wrong was silent.** Band-limiting *before* the crush looks
correct and does nothing: the stair-stepping puts the high-frequency energy straight back.
Measured on `ambient_01`, energy above 3 kHz came out **21.4%** with the filter first —
indistinguishable from the clean take's 20.63%. With the filter last it is **1.93%**. If you
touch this chain, measure the spectrum; the ear on a laptop speaker will not tell you.

## Adding more chatter

1. Add the line to `src/content/data/narrative.json` — `ambientChatter` for short overheard
   radio traffic, `recordedTransmissions` for decoded records (which need a decoder widget
   and requirements, so they gate themselves).
2. Regenerate: `python scripts/voice/generate-clips.py` (or `--only <id>` while iterating).
3. Commit the new files under `assets/audio/voice/<tier>/` plus the updated `MANIFEST.json`.
4. Note in the PR that **regeneration is not reproducible** — the model returns a different
   take each call, so a regeneration rewrites files that already existed. Regenerating only
   the new id keeps the diff honest; `--only` exists for that.

## Limits, stated rather than implied

- **Playback is wired but unheard.** Unit tests run against a mocked player, which proves which
  clip is handed over and that a second press cancels the first. On web,
  `tests/e2e/voice-playback.e2e.ts` drives the real adapter in the served build and proves the
  bundled clip is requested after a press, without failure, and not before. Neither proves
  sound comes out: no clip has been heard through the app, and native (Android/iOS) playback
  is unexercised and needs a device. This is the Scope Steward's objection, and it stands for
  native.
- **The duck depth is unheard.** `DUCK_RATIO` is 0.35 on reasoning (two sources at about the
  same loudness, a conventional music-under-speech gap), not on listening: nobody has heard
  the ducked mix. Unit tests prove the level arithmetic against a mocked player;
  `tests/e2e/music-ducking.e2e.ts` proves on the served web build that the score element's
  `volume` falls after a press and returns when the clip ends by itself. That is a number on
  a media element, not a sound. Native (Android/iOS) ducking is unexercised and needs a
  device, and browsers on iOS ignore programmatic volume altogether, so there the score will
  not duck at all.
- **The ramps are unheard, and so are their durations.** `DUCK_RAMP_MS` (200 ms),
  `FADE_OUT_MS` and `FADE_IN_MS` (500 ms each) are defaults nobody has listened to; whether a
  linear ramp of a media element's volume in 25 ms steps sounds smooth or audibly stepped is
  unknown. What is proven is numbers: `tests/app-volume-ramp.spec.ts`,
  `tests/app-music-ramps.spec.ts` and `tests/app-music-fadeout.spec.ts` on fake timers against
  mocked players, and on the served web build `tests/e2e/music-ducking.e2e.ts` and
  `tests/e2e/phase-music.e2e.ts` read the score element's `volume` one ramp step at a time,
  down and up, with exactly one score element throughout a phase change. The e2e suite's page
  clock is paused, so those two specs run it explicitly; the older soundtrack specs never do,
  which means their players sit at level 0 and exercise the silent, immediate path. On iOS
  browsers no ramp happens at all, and there switching music off costs a 500 ms delay with
  nothing audible to show for it. Native is unexercised and needs a device: in particular,
  nobody has confirmed that a 25 ms timer and a volume write per step are cheap enough there.
- **Safari is unverified, in both directions.** The phase-change `play()` was kept inside the
  press because a deferred one might be refused by WebKit's gesture policy; nobody has run
  this on Safari to learn whether it would have been, or to confirm that the in-gesture
  `play()` is accepted there (it is the same call the app made before ramps, and that was
  not qualified on Safari either). A wipe forced by the simulation rather than pressed has
  never had a gesture behind its `play()`, before or after this change.
- **The speech level is unheard too.** The split is proven on numbers: unit tests against a
  mocked player, and on the served web build a clip element whose `volume` equals the speech
  level while no music element exists. Nobody has listened to speech against the score at
  unequal levels, and the native (Android/iOS) path for speech with music off, including the
  session READ prepares for itself, is unexercised and needs a device.
- **A failed clip is released on web by test, on native by reading.** expo-audio 58.0.12
  reports a failure as a status with `error` set and no `didJustFinish`. On web that is the
  media element's `error` event and a rejected `play()` (`AudioPlayer.web.ts`), and
  `tests/e2e/music-ducking.e2e.ts` feeds the real player a 404 and watches the score return
  to the preference level. On Android it is `onPlayerError` (`AudioPlayer.kt`) and on iOS the
  item's `.failed` status (`AudioPlayer.swift`); both were read, neither was run. Android
  forwards the exception's message as the `error` value, so an exception with no message
  would arrive as a status this code cannot tell from a healthy one.
- **A stalled clip still holds the duck.** A clip that neither loads nor fails emits no status
  on any platform, so nothing releases it: the same e2e holds the clip request open and the
  score stays ducked for as long as it is held. The clips are bundled local files, so this
  needs a broken or very slow asset fetch on web and should not arise on native. Nothing was
  built for it, because the remedy is a timer in `src/app`. The smallest one would be a
  single timeout armed in `playVoiceClip` and cleared by the first status and by `release`,
  which stops the clip if no status has arrived at all.
- **Loudness is peak-normalised, not loudness-normalised, and the measured spread is small.**
  Each take is scaled to a 0.92 (vibration) or 0.95 (clean) sample peak, with no loudness
  target. Measured on the committed files with ffmpeg 8.0.1 (EBU R128, measurement only —
  nothing is rewritten):

  ```bash
  ffmpeg -hide_banner -nostats -i <file> -af loudnorm=print_format=json -f null -
  ```

  reading `input_i` (integrated loudness) and `input_tp` (true peak) from the JSON:

  | Set | Files | Integrated, quietest to loudest | Spread | True peak |
  | --- | ---: | --- | ---: | --- |
  | `voice/vibration/` | 14 | -15.50 to -14.08 LUFS | 1.42 LU | -1.17 to -1.09 dBTP |
  | `voice/clean/` | 14 | -15.13 to -13.51 LUFS | 1.62 LU | -0.93 to -0.73 dBTP |
  | `music/phase-*/` | 6 | -15.77 to -14.66 LUFS | 1.11 LU | -4.22 to -3.04 dBTP |

  So voice and music sit at about the same loudness as files: every one of the 34 is
  between -15.77 and -13.51 LUFS. That is a statement about the encoded files, before the
  player's volume setting, and about level only. Nobody has auditioned the clips, and a
  regenerated take will measure differently, so re-run the command when the assets change.
- **`Serena` was chosen arbitrarily.** The model offers ten English voices; the fiction may
  want a different one, or more than one for different speakers.
- **No listening test of the clean tier against the vibration tier**, and no decision recorded
  on how much fidelity the upgrade should buy.
