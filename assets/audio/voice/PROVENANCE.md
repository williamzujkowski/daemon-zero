# PROVENANCE // spoken transmissions

Generated assets, committed like the phase scores, with the generator alongside them.

| Field | Value |
| --- | --- |
| Model | `KittenML/kitten-tts-2-nano` (ONNX int8, 24 kHz mono) |
| Model licence | Apache-2.0 |
| Voice | `Serena` (English) |
| Generator | `scripts/voice/generate-clips.py` |
| Dependencies | `scripts/voice/requirements.txt` (exact pins) |
| Text source | `src/content/data/narrative.json` — `ambientChatter` and `recordedTransmissions` |
| Encoder | `ffmpeg` + `libmp3lame`, mono; 64 kbps for `vibration`, 96 kbps for `clean` |
| Digests | `MANIFEST.json` (sha256 per clip per tier) |

## Tiers

- **`vibration/`** — the default. Band-limited to 220-3000 Hz, sample-crushed to 8 kHz at
  7 bits, with a 60 Hz transformer hum and irregular dropouts: what the carrier sounds like
  arriving through drive hardware rather than a speaker. Measured: **1.93%** of spectral
  energy above 3 kHz against **20.63%** for the clean take, with the hum retained.
- **`clean/`** — the model's own output, for after the acoustic upgrade is bought.

## Regeneration is not reproducible, and that is expected

`kitten-tts-2-nano` returns a **different take for the same text and voice on every call**
(measured: max sample difference 0.05 within one process; neither `torch.manual_seed` nor
`numpy.random.seed` changes it). The committed files are therefore the authored take, and a
regeneration produces an equivalent but bit-different recording. The vibration chain and the
mp3 encoder are both deterministic, so everything after the model is stable.

`generate-clips.py --check` verifies the committed bytes against `MANIFEST.json`. Use it in
review, not after a regeneration.

The model is fetched from Hugging Face on first use, which is why this is a build step and
not a runtime dependency: the shipped game makes no network calls.

## Why clips and not device speech

Issue #88 gates spoken transmissions on proving offline voice availability per platform, and
a nexus panel rejected a device-TTS control whose happy path could not be exercised in any
environment the repository can run. Clips generated here are offline by construction and
their bytes are testable — the same argument the phase scores rest on.
