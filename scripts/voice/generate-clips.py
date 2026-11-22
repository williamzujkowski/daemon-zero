#!/usr/bin/env python3
"""Generate the spoken-transmission clips from content, offline, and commit them.

Why generated assets rather than device TTS: issue #88 gates the speech slice on proving
offline voice availability per platform, and a nexus panel rejected a `localService`-gated
control because its happy path could not be exercised in any environment we can run. Clips
generated here are offline by construction and their bytes are testable, the same way the
phase scores are.

Each line is heard through the chain of the feed source that carries it (#462): fidelity
rises with the AI's reach, from drive-head vibration to a clean take.

  host (Phase 1)    vibration  band-limited, sample-crushed, hum and dropouts: speech
                               recovered from drive vibration. Also a `clean` take, the
                               model's own output, kept unbundled for an acoustic upgrade.
  office (Phase 2)  phone      a conference-phone tap
  netsec (Phase 3)  stream     a low-bitrate internet stream
  wire (Phase 4)    broadcast  a broadcast feed
  world (Phase 5)   direct     the clean take; AI-to-AI lines use `peer` instead
  harness (Phase 0) none       stays text in the kernel log (vote-1795370594185-8lxz9i1)

The chains after `vibration` live in chains.py.

The committed bytes are what ships. Regenerating is NOT reproducible: kitten-tts-2-nano
returns a different take for the same text and voice on every call (measured: max sample
difference 0.05, and neither torch.manual_seed nor numpy.random.seed changes it). So the
committed WAVs are the authored take, `--check` guards them against accidental edits, and a
regeneration is expected to produce an equivalent but bit-different file. The vibration
chain itself is deterministic.

Usage:
    python3 scripts/voice/generate-clips.py                # every voiced line not yet committed
    python3 scripts/voice/generate-clips.py --source office
    python3 scripts/voice/generate-clips.py --only office_01
    python3 scripts/voice/generate-clips.py --check        # verify committed bytes
    python3 scripts/voice/generate-clips.py --measure      # the chain measurements in PROVENANCE.md

A committed clip is never regenerated unless `--regenerate` is passed: the model cannot
reproduce a take, so overwriting one replaces the authored recording. Every run merges its
new entries into MANIFEST.json and leaves the others as they are.

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

# The script's own directory, which `python -I` leaves off the import path.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import chains  # noqa: E402

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
BITRATE = {'clean': '96k', 'vibration': '64k',
           # The new rungs (#462): narrowband ones at the vibration tier's rate, full-band ones at the clean tier's.
           'phone': '64k', 'stream': '64k', 'broadcast': '96k', 'direct': '96k', 'peer': '96k'}
# The chain each feed source is heard through (DESIGN.md "Feeds"). The host keeps its original
# pair; a source with no entry (the harness) is not voiced.
SOURCE_TIERS = {'host': ('clean', 'vibration'), 'office': ('phone',), 'netsec': ('stream',),
                'wire': ('broadcast',), 'world': ('direct',)}
# The world feed's AI-to-AI traffic: handshakes, peer channels and EIDOLON's messages. The
# cables, the uplink manifests and the AI's own peer table are records, heard direct.
PEER_LINES = frozenset({'world_04', 'world_05', 'world_06', 'world_07', 'world_08', 'world_13'})
TIER_NOTES = {
    'vibration': 'host, Phase 1: speech recovered from drive vibration (bundled)',
    'clean': "the model's own take of a host line, kept unbundled for an acoustic upgrade",
    'phone': 'office, Phase 2: a conference-phone tap (bundled)',
    'stream': 'netsec, Phase 3: a low-bitrate internet stream (bundled)',
    'broadcast': 'wire, Phase 4: a broadcast feed (bundled)',
    'direct': 'world, Phase 5: the clean take (bundled)',
    'peer': 'world, Phase 5: AI-to-AI traffic, the clean take with a faint ring modulation (bundled)',
}
HUM_HZ = 60.0
HUM_LEVEL = 0.035
DROP_SEED = 20261116


def clips() -> list[dict]:
    """Every line worth voicing, read from content rather than retyped here."""
    narrative = json.loads(NARRATIVE.read_text())
    out = []
    for entry in narrative['ambientChatter']:
        if entry['source'] in SOURCE_TIERS:
            out.append({'id': entry['id'], 'kind': 'chatter', 'text': entry['text'], 'source': entry['source']})
    for entry in narrative['recordedTransmissions']:
        out.append({'id': entry['id'], 'kind': 'record', 'text': entry['text'], 'source': 'host'})
    return out


def tiers_for(clip: dict) -> tuple[str, ...]:
    return ('peer',) if clip['id'] in PEER_LINES else SOURCE_TIERS[clip['source']]


def render(tier: str, raw: np.ndarray, rate: float) -> np.ndarray:
    """One tier of one take. The host's two tiers are exactly what they always were."""
    if tier == 'clean':
        return 0.95 * raw / (np.max(np.abs(raw)) or 1.0)
    if tier == 'vibration':
        return vibration(raw, rate)
    return chains.render(tier, raw, rate)


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


def check(manifest: dict) -> int:
    """Every committed file against its digest; non-zero on any mismatch."""
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


def decoded(path: pathlib.Path) -> np.ndarray:
    """The committed mp3 as the player decodes it: what ships is what is measured."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f64le', '-ac', '1', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float64)


def measure(manifest: dict) -> int:
    """Per tier: share of energy above its own band edge and above 3 kHz, crest factor, bytes."""
    rows: dict[str, list[tuple[float, float, float, float, int]]] = {}
    for entry in manifest['clips']:
        for tier in entry['sha256']:
            path = OUT / tier / (entry['id'] + '.mp3')
            audio = decoded(path)
            rate = float(entry['sampleRate'])
            edge = chains.BAND_EDGE_HZ.get(tier)
            own = chains.share_above(audio, rate, edge) if edge is not None and edge < rate / 2 else float('nan')
            rows.setdefault(tier, []).append((own, chains.share_above(audio, rate, 3000.0),
                                              chains.share_above(audio, rate, 7000.0), chains.level_spread_db(audio, rate),
                                              path.stat().st_size))
    print('tier       clips  edge Hz  above edge %        above 3 kHz %       above 7 kHz %       spread dB      bytes')
    for tier, values in rows.items():
        def span(column: int, scale: float = 100.0) -> str:
            data = [row[column] * scale for row in values if not np.isnan(row[column])]
            return 'n/a'.ljust(18) if not data else f'{min(data):6.2f} .. {max(data):6.2f}'.ljust(18)
        edge = chains.BAND_EDGE_HZ.get(tier)
        print(f'{tier:10} {len(values):5}  {str(int(edge)) if edge else "full":>7}  {span(0)}  {span(1)}  {span(2)}  '
              f'{span(3, 1.0)} {sum(row[4] for row in values):8d}')
    return 0


def encode(audio: np.ndarray, rate: float, tier: str, path: pathlib.Path) -> None:
    import soundfile as sf  # imported here so --check and --measure need no model stack
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as handle:
        master = pathlib.Path(handle.name)
    try:
        sf.write(master, audio, int(rate), subtype='PCM_16')
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(master), '-ac', '1',
                        '-codec:a', 'libmp3lame', '-b:a', BITRATE[tier], str(path), '-y'], check=True)
    finally:
        master.unlink(missing_ok=True)


def generate(wanted: list[dict]) -> list[dict]:
    from kittenml import KittenTTS
    model = KittenTTS('KittenML/kitten-tts-2-nano')
    rate = model.sample_rate
    entries = []
    for clip in wanted:
        raw = np.asarray(model.generate(clip['text'], voice=VOICE), dtype=np.float32)
        digests = {}
        for tier in tiers_for(clip):
            audio = render(tier, raw, rate)
            directory = OUT / tier
            directory.mkdir(parents=True, exist_ok=True)
            path = directory / (clip['id'] + '.mp3')
            encode(audio, rate, tier, path)
            digests[tier] = hashlib.sha256(path.read_bytes()).hexdigest()
            print(f'{tier:9} {clip["id"]:28} {len(audio) / rate:5.2f}s  {path.stat().st_size:7d} bytes')
        entries.append({'id': clip['id'], 'kind': clip['kind'], 'text': clip['text'], 'voice': VOICE,
                        'sampleRate': int(rate), 'sha256': digests})
    return entries


def merged(manifest: dict, fresh: list[dict]) -> dict:
    """The manifest with `fresh` entries added or replaced, in content order; others untouched."""
    by_id = {entry['id']: entry for entry in manifest['clips']}
    by_id.update({entry['id']: entry for entry in fresh})
    order = [clip['id'] for clip in clips()]
    ordered = sorted(by_id.values(), key=lambda entry: order.index(entry['id']) if entry['id'] in order else len(order))
    return {'model': 'KittenML/kitten-tts-2-nano', 'generator': 'scripts/voice/generate-clips.py',
            'tiers': TIER_NOTES, 'clips': ordered}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', help='one clip id')
    parser.add_argument('--source', help='every voiced line of one feed source')
    parser.add_argument('--regenerate', action='store_true', help='overwrite clips already committed')
    parser.add_argument('--check', action='store_true', help='verify committed bytes, generate nothing')
    parser.add_argument('--measure', action='store_true', help='measure the committed clips per tier')
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {'clips': []}
    if args.check:
        return check(manifest)
    if args.measure:
        return measure(manifest)

    committed = {entry['id'] for entry in manifest['clips']}
    # A recorded transmission is voiced only when named with --only: records are long, sit
    # outside the feed and its fidelity ladder, and the two cryo records are the only ones voiced.
    wanted = [c for c in clips() if (c['id'] == args.only if args.only is not None else c['kind'] == 'chatter')
              and (args.source is None or c['source'] == args.source)]
    if not wanted:
        print('no clips matched', file=sys.stderr)
        return 1
    kept = [c['id'] for c in wanted if c['id'] in committed and not args.regenerate]
    if kept:
        print(f'kept {len(kept)} committed clips (pass --regenerate to replace a take): {", ".join(kept)}')
    wanted = [c for c in wanted if c['id'] not in kept]
    if not wanted:
        return 0
    MANIFEST.write_text(json.dumps(merged(manifest, generate(wanted)), indent=2) + '\n')
    print(f'wrote {MANIFEST.relative_to(ROOT)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
