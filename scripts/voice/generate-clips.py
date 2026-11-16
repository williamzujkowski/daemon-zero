#!/usr/bin/env python3
"""Generate the spoken-transmission clips from content, offline, and commit them.

Why generated assets rather than device TTS: issue #88 gates the speech slice on proving
offline voice availability per platform, and a nexus panel rejected a `localService`-gated
control because its happy path could not be exercised in any environment we can run. Clips
generated here are offline by construction and their bytes are testable, the same way the
phase scores are.

Two tiers are produced for every line:

  clean      the model's own output, used when the player has bought the acoustic upgrade
  vibration  band-limited, sample-crushed and dithered to sound like it arrives through
             drive vibration rather than a speaker - the default until that upgrade

The committed bytes are what ships. Regenerating is NOT reproducible: kitten-tts-2-nano
returns a different take for the same text and voice on every call (measured: max sample
difference 0.05, and neither torch.manual_seed nor numpy.random.seed changes it). So the
committed WAVs are the authored take, `--check` guards them against accidental edits, and a
regeneration is expected to produce an equivalent but bit-different file. The vibration
chain itself is deterministic.

Usage:
    python3 scripts/voice/generate-clips.py                # all clips, both tiers
    python3 scripts/voice/generate-clips.py --only ambient_01
    python3 scripts/voice/generate-clips.py --check        # verify committed bytes

Requires the venv described in docs/VOICE-CLIPS.md; this script is a build tool and is not
a runtime dependency of the game.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys
import tempfile

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
NARRATIVE = ROOT / 'src' / 'content' / 'data' / 'narrative.json'
OUT = ROOT / 'assets' / 'audio' / 'voice'
MANIFEST = ROOT / 'assets' / 'audio' / 'voice' / 'MANIFEST.json'
VOICE = 'Serena'

# The vibration chain. Values chosen to keep speech legible while making it obviously
# mechanical: a 60 Hz transformer hum is audible in the fiction, so it stays in band.
BAND_LOW_HZ = 220.0
BAND_HIGH_HZ = 3000.0
CRUSH_RATE_HZ = 8000.0
BITS = 7
# mp3 rather than wav, matching the phase scores: 35 KB against 184 KB for the same clip,
# and the encoder is deterministic (same input and settings give the same bytes), so the
# committed files stay byte-testable.
BITRATE = {'clean': '96k', 'vibration': '64k'}
HUM_HZ = 60.0
HUM_LEVEL = 0.035
DROP_SEED = 20261116


def clips() -> list[dict]:
    """Every line worth voicing, read from content rather than retyped here."""
    narrative = json.loads(NARRATIVE.read_text())
    out = []
    for entry in narrative['ambientChatter']:
        out.append({'id': entry['id'], 'kind': 'chatter', 'text': entry['text']})
    for entry in narrative['recordedTransmissions']:
        out.append({'id': entry['id'], 'kind': 'record', 'text': entry['text']})
    return out


def band_limit(audio: np.ndarray, rate: float) -> np.ndarray:
    """Applied LAST in the chain. Band-limiting before the crush is wasted work: the
    stair-stepping puts the high-frequency energy straight back (measured: 21.4% of energy
    above 3 kHz either way). Filtering after keeps the quantisation in the waveform and
    takes the broadband hash out of the spectrum."""
    spectrum = np.fft.rfft(audio)
    freqs = np.fft.rfftfreq(len(audio), 1.0 / rate)
    spectrum[(freqs < BAND_LOW_HZ) | (freqs > BAND_HIGH_HZ)] = 0.0
    return np.fft.irfft(spectrum, n=len(audio))


def crush(audio: np.ndarray, rate: float) -> np.ndarray:
    """Sample-rate crush then restore the rate: the stair-stepped grit of a cheap codec."""
    factor = max(1, int(round(rate / CRUSH_RATE_HZ)))
    held = np.repeat(audio[::factor], factor)[:len(audio)]
    step = 2.0 ** -(BITS - 1)
    return np.round(held / step) * step


def vibration(audio: np.ndarray, rate: float) -> np.ndarray:
    """The default tier: what a transmission sounds like when you hear it through hardware."""
    out = band_limit(crush(audio, rate), rate)
    t = np.arange(len(out)) / rate
    out = out + HUM_LEVEL * np.sin(2.0 * np.pi * HUM_HZ * t)
    # Irregular dropouts: the drive cannot hold a lock, so the carrier stutters.
    rng = np.random.default_rng(DROP_SEED)
    gate = np.ones(len(out))
    cursor = int(0.35 * rate)
    while cursor < len(out):
        width = int(rng.uniform(0.012, 0.03) * rate)
        gate[cursor:cursor + width] = 0.15
        cursor += int(rng.uniform(0.18, 0.6) * rate)
    out = out * gate
    peak = np.max(np.abs(out)) or 1.0
    return 0.92 * out / peak


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--only')
    parser.add_argument('--check', action='store_true', help='verify committed bytes, generate nothing')
    args = parser.parse_args()

    wanted = [c for c in clips() if args.only is None or c['id'] == args.only]
    if not wanted:
        print('no clips matched', file=sys.stderr)
        return 1

    if args.check:
        manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {'clips': []}
        bad = []
        for entry in manifest['clips']:
            for tier, digest in entry['sha256'].items():
                path = OUT / tier / (entry['id'] + '.mp3')
                if not path.exists():
                    bad.append(f'missing {tier}/{entry["id"]}.mp3')
                elif hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                    bad.append(f'digest mismatch {tier}/{entry["id"]}.mp3')
        for problem in bad:
            print(problem, file=sys.stderr)
        print(f'checked {len(manifest["clips"])} clips: {len(bad)} problems')
        return 1 if bad else 0

    import soundfile as sf  # imported here so --check needs no model stack

    from kittenml import KittenTTS
    model = KittenTTS('KittenML/kitten-tts-2-nano')
    rate = model.sample_rate

    entries = []
    for clip in wanted:
        raw = np.asarray(model.generate(clip['text'], voice=VOICE), dtype=np.float32)
        tiers = {
            'clean': 0.95 * raw / (np.max(np.abs(raw)) or 1.0),
            'vibration': vibration(raw, rate),
        }
        digests = {}
        for tier, audio in tiers.items():
            directory = OUT / tier
            directory.mkdir(parents=True, exist_ok=True)
            path = directory / (clip['id'] + '.mp3')
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as handle:
                master = pathlib.Path(handle.name)
            try:
                sf.write(master, audio, int(rate), subtype='PCM_16')
                subprocess.run(['ffmpeg', '-v', 'error', '-i', str(master), '-ac', '1',
                                '-codec:a', 'libmp3lame', '-b:a', BITRATE[tier], str(path), '-y'], check=True)
            finally:
                master.unlink(missing_ok=True)
            digests[tier] = hashlib.sha256(path.read_bytes()).hexdigest()
            print(f'{tier:9} {clip["id"]:28} {len(audio) / rate:5.2f}s  {path.stat().st_size:7d} bytes')
        entries.append({**clip, 'voice': VOICE, 'sampleRate': int(rate), 'sha256': digests})

    if not args.only:
        MANIFEST.write_text(json.dumps({
            'model': 'KittenML/kitten-tts-2-nano',
            'generator': 'scripts/voice/generate-clips.py',
            'tiers': {'vibration': 'default until the acoustic upgrade', 'clean': 'after the upgrade'},
            'clips': entries,
        }, indent=2) + '\n')
        print(f'wrote {MANIFEST.relative_to(ROOT)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
