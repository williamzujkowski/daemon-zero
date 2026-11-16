# Spoken transmissions — generating and expanding the voice clips

The game's spoken transmissions are **pre-generated audio committed to the repository**, not
device synthesis. This document covers how they are made, how to add more, and what is not
yet wired.

Status: **clips exist, are committed, and play behind a manual control.** Issue #88's slice is
wired for the default (vibration) tier: `src/ui/widgets/Speech.tsx` and `RecordedSpeech.tsx`
each offer a `[ ▶ READ ]` control that plays that line's clip. Nothing autoplays, nothing
queues, and a clip stops when its own line leaves the screen.

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
control; that remains #88 work.

## How playback is wired, and the vote that chose it

`[ ▶ READ ]` on the decoded-transmission line and on each recorded transmission plays that
line's clip once. The pieces:

| Piece | Job |
| --- | --- |
| `src/app/voiceSources.ts` | One literal import per clip, so Metro packages every file. Ids are content ids; a test fails if this table and `MANIFEST.json` disagree. |
| `src/app/voicePlayer.ts` | One clip at a time: starting a clip stops the previous one, a finished or failed clip releases its player, volume follows the audio preference. |
| `src/app/voicePlayer.ts` (`onVoiceActivity`) | Reports when a clip starts talking and when the last one stops. It does not import the soundtrack. |
| `src/app/musicController.ts` (`setDucked`, `DUCK_RATIO`) | Scales the score to `DUCK_RATIO` of its preference level while ducked, at both places it writes a volume. |
| `src/app/musicSession.ts` | The one joint between the two: voice activity drives `setDucked`. |
| `Speech.tsx` / `RecordedSpeech.tsx` | The control, 44px tall, shown only when a clip exists **and** audio is on. Stepping to another line stops the clip. |

**What stops a clip, exactly.** Pressing READ on the live line *holds* that line, the same way
`NEXT TRANSMISSION` does, so the eight-second live rotation cannot take the line and its voice
away mid-sentence; `FOLLOW LIVE` releases it. The live line's clip stops when that line leaves
the screen (a step, a return to live, the widget closing) and the stop is scoped to that
line's id, because both widgets share one player: the live rotation must never cut off a
recorded transmission. A recorded transmission's clip belongs to its row, so it stops when the
panel is collapsed, emptied, or remounted by a wipe or import. Muting stops whatever is playing. A panel review found the earlier
version stopped *any* clip on *any* line change, which truncated every clip in the default
motion setting; `tests/ui-speech.spec.ts` now pins both halves.

**The score ducks while a clip talks.** Score and clips both measure about -15 LUFS, so at an
equal preference they compete. While a clip is in flight the score plays at `DUCK_RATIO`
(0.35, roughly -9 dB) of the preference level, and returns to the preference level when the
clip stops. "Stops" is every path above, because they all end in `stopVoiceClip`: the clip
finishing, a step away from the line, a collapse or remount, and a mute. Four details are
pinned by tests rather than left to luck:

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
  controller writes a level, not once at the moment the clip starts, so moving the slider
  mid-clip stays ducked and a score created by a phase change mid-clip starts ducked.
- **The preference is never ducked.** Only the level handed to the player is scaled; the value
  shown in the audio settings and written to storage is the one the player chose.

The change is a step, not a fade: the adapter has no ramp and the app layer adds no timer for
one.

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
  the ducked mix, and the step down and back up has not been judged for abruptness against a
  fade. Unit tests prove the level arithmetic against a mocked player;
  `tests/e2e/music-ducking.e2e.ts` proves on the served web build that the score element's
  `volume` falls after a press and returns when the clip ends by itself. That is a number on
  a media element, not a sound. Native (Android/iOS) ducking is unexercised and needs a
  device, and browsers on iOS ignore programmatic volume altogether, so there the score will
  not duck at all.
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
- **Loudness is not normalised across clips.** Each take is peak-normalised at 0.92-0.95, so
  perceived level varies with the model's own dynamics. Audition before shipping.
- **`Serena` was chosen arbitrarily.** The model offers ten English voices; the fiction may
  want a different one, or more than one for different speakers.
- **No listening test of the clean tier against the vibration tier**, and no decision recorded
  on how much fidelity the upgrade should buy.
