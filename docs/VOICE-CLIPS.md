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
| `src/app/voicePlayer.ts` | One clip at a time: starting a clip stops the previous one, a finished clip releases its player, volume follows the audio preference. |
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
