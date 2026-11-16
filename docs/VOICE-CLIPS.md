# Spoken transmissions — generating and expanding the voice clips

The game's spoken transmissions are **pre-generated audio committed to the repository**, not
device synthesis. This document covers how they are made, how to add more, and what is not
yet wired.

Status: **clips exist and are committed; playback is not wired into the app.** Issue #88's
second slice still owns the manual `READ TRANSMISSION` / `STOP` contract, the cancellation
rules and the music ducking. What this document adds is the asset pipeline that slice was
blocked on.

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
Both tiers are generated now so the upgrade becomes a content flag rather than a new asset
pass. **The upgrade itself is not wired yet** — playback, the flag and the control are the
remaining #88 work.

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

- **Playback is unverified.** No clip has been heard through the app, on web or on the
  Android emulator. The spectral measurements above show the processing does what it claims;
  they say nothing about whether it sounds good. That needs ears.
- **Loudness is not normalised across clips.** Each take is peak-normalised at 0.92-0.95, so
  perceived level varies with the model's own dynamics. Audition before shipping.
- **`Serena` was chosen arbitrarily.** The model offers ten English voices; the fiction may
  want a different one, or more than one for different speakers.
- **No listening test of the clean tier against the vibration tier**, and no decision recorded
  on how much fidelity the upgrade should buy.
