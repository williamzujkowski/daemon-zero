"""The fidelity ladder (#462): one acoustic chain per feed source, cleaner as the AI's senses grow.

The host's vibration chain lives in generate-clips.py and is untouched, so the original clips
stay byte-identical. Every chain here starts from the model's take and ends at the same
loudness, so a phase change moves the sound, not the level:

  phone      office, Phase 2   a conference-phone tap: 300-3400 Hz, 8 kHz mu-law, lost packets
  stream     netsec, Phase 3   a low-bitrate internet stream: to 7 kHz, spectral codec holes
  broadcast  wire, Phase 4     broadcast: the full band, a broadcast processor, carrier hiss
  direct     world, Phase 5    the clean take: nothing between the AI and the speaker
  peer       world, Phase 5    AI-to-AI traffic: the clean take with a faint ring modulation

Everything after the model is deterministic: fixed seeds, no clock, numpy only. The model is
not (see PROVENANCE.md), which is why the committed bytes are the take and `--check` guards them.
"""
import numpy as np

# Every new clip ends at the vibration tier's median whole-file RMS (-14.75 dBFS, measured on
# the 14 committed clips), so speech keeps the same distance above the ducked score whichever
# phase is speaking. A soft limiter then holds peaks under the bundled-speech ceiling with room
# for the mp3 encoder's overshoot (SPEECH_PEAK_CEILING 0.92 in src/app/outputLevel.ts).
TARGET_RMS_DB = -14.75
LIMIT = 0.84
KNEE = 0.66

# Edges: the model pads each take with up to half a second of near-silence, and a bundled
# clip holds the score's duck for as long as it plays. Trim to the voice, keep a short pad.
TRIM_FLOOR_DB = -45.0
TRIM_FRAME_S = 0.01
TRIM_LEAD_S = 0.04
TRIM_TAIL_S = 0.08
EDGE_FADE_S = 0.01

PHONE_LOW_HZ, PHONE_HIGH_HZ = 300.0, 3400.0
PHONE_RATE_HZ = 8000
PHONE_FRAME = 160  # 20 ms at 8 kHz, one G.711 packet
PHONE_LOSS = 0.03
PHONE_SEED = 20261122
MU = 255.0

STREAM_LOW_HZ, STREAM_HIGH_HZ = 70.0, 7000.0
STREAM_FFT = 512
STREAM_BAND_BINS = 12
STREAM_KEEP = 0.2  # a bin under this share of its band's loudest is not coded at all
STREAM_STEP_DB = 2.0

BROADCAST_LOW_HZ, BROADCAST_HIGH_HZ = 50.0, 15000.0
BROADCAST_WINDOW_S = 0.01
BROADCAST_THRESHOLD_DB = -30.0
BROADCAST_RATIO = 5.0
BROADCAST_HISS_DB = -66.0
BROADCAST_SEED = 20261123

PEER_CARRIER_HZ = 96.0
PEER_MIX = 0.22

# The edge each chain's band ends at, for the measurement in PROVENANCE.md. None: full band.
BAND_EDGE_HZ = {'vibration': 3000.0, 'phone': PHONE_HIGH_HZ, 'stream': STREAM_HIGH_HZ,
                'broadcast': BROADCAST_HIGH_HZ, 'direct': None, 'peer': None, 'clean': None}


def band(audio: np.ndarray, rate: float, low: float, high: float) -> np.ndarray:
    """An FFT mask: everything outside [low, high] is removed outright."""
    spectrum = np.fft.rfft(audio)
    freqs = np.fft.rfftfreq(len(audio), 1.0 / rate)
    spectrum[(freqs < low) | (freqs > high)] = 0.0
    return np.fft.irfft(spectrum, n=len(audio))


def trim(audio: np.ndarray, rate: float) -> np.ndarray:
    """Cut the take to its voice, with a short pad and a raised-cosine fade at each end."""
    frame = max(1, int(TRIM_FRAME_S * rate))
    count = len(audio) // frame
    levels = np.sqrt(np.mean(audio[:count * frame].reshape(count, frame) ** 2, axis=1) + 1e-20)
    voiced = np.nonzero(20 * np.log10(levels / (np.max(levels) or 1.0)) > TRIM_FLOOR_DB)[0]
    if len(voiced) == 0:
        return audio
    start = max(0, voiced[0] * frame - int(TRIM_LEAD_S * rate))
    end = min(len(audio), (voiced[-1] + 1) * frame + int(TRIM_TAIL_S * rate))
    out = np.array(audio[start:end], dtype=np.float64)
    fade = int(EDGE_FADE_S * rate)
    ramp = 0.5 - 0.5 * np.cos(np.pi * (np.arange(fade) + 1) / (fade + 1))
    out[:fade] *= ramp
    out[-fade:] *= ramp[::-1]
    return out


def match_level(audio: np.ndarray) -> np.ndarray:
    """Whole-file RMS to the target, then a soft knee so no peak passes LIMIT."""
    rms = np.sqrt(np.mean(audio ** 2)) or 1.0
    out = audio * (10 ** (TARGET_RMS_DB / 20) / rms)
    over = np.abs(out) > KNEE
    span = LIMIT - KNEE
    out[over] = np.sign(out[over]) * (KNEE + span * np.tanh((np.abs(out[over]) - KNEE) / span))
    return out


def mulaw(audio: np.ndarray) -> np.ndarray:
    """G.711 mu-law at 8 bits: compand, quantise to 256 levels, expand."""
    peak = np.max(np.abs(audio)) or 1.0
    x = audio / peak
    companded = np.sign(x) * np.log1p(MU * np.abs(x)) / np.log1p(MU)
    q = np.round(companded * 127.0) / 127.0
    return peak * np.sign(q) * np.expm1(np.abs(q) * np.log1p(MU)) / MU


def phone(audio: np.ndarray, rate: float) -> np.ndarray:
    """A conference-phone tap: the telephone band, 8 kHz G.711, and the odd lost packet."""
    factor = max(1, int(round(rate / PHONE_RATE_HZ)))
    narrow = band(audio, rate, PHONE_LOW_HZ, PHONE_HIGH_HZ)[::factor]  # band-limited first, so no alias
    # A lost packet is concealed by repeating the one before at half level, as a cheap
    # endpoint does: a short stutter, not a hole.
    rng = np.random.default_rng(PHONE_SEED)
    for start in range(PHONE_FRAME, len(narrow) - PHONE_FRAME, PHONE_FRAME):
        if rng.random() < PHONE_LOSS:
            narrow[start:start + PHONE_FRAME] = 0.5 * narrow[start - PHONE_FRAME:start]
    held = np.repeat(mulaw(narrow), factor)
    held = np.pad(held, (0, max(0, len(audio) - len(held))))[:len(audio)]
    # The band again, last: the sample-and-hold puts energy back above 3.4 kHz, the same
    # lesson the vibration chain measured.
    return band(held, rate, PHONE_LOW_HZ, PHONE_HIGH_HZ)


def stream(audio: np.ndarray, rate: float) -> np.ndarray:
    """A low-bitrate stream: to 7 kHz, coded per frame with the quiet bins thrown away."""
    x = band(audio, rate, STREAM_LOW_HZ, STREAM_HIGH_HZ)
    hop = STREAM_FFT // 2
    window = np.sqrt(np.hanning(STREAM_FFT + 1)[:-1])  # periodic sqrt-Hann: analysis x synthesis sums to one
    padded = np.pad(x, (STREAM_FFT, STREAM_FFT + hop))
    out = np.zeros(len(padded))
    for start in range(0, len(padded) - STREAM_FFT, hop):
        spectrum = np.fft.rfft(padded[start:start + STREAM_FFT] * window)
        out[start:start + STREAM_FFT] += np.fft.irfft(code_frame(spectrum), n=STREAM_FFT) * window
    return band(out[STREAM_FFT:STREAM_FFT + len(x)], rate, STREAM_LOW_HZ, STREAM_HIGH_HZ)


def code_frame(spectrum: np.ndarray) -> np.ndarray:
    """What a starved perceptual codec keeps of one frame: the loud bins of each band, coarsely."""
    magnitude = np.abs(spectrum)
    phase = np.angle(spectrum)
    kept = np.zeros_like(magnitude)
    for start in range(0, len(magnitude), STREAM_BAND_BINS):
        part = magnitude[start:start + STREAM_BAND_BINS]
        loudest = np.max(part)
        if loudest <= 0:
            continue
        keep = part >= STREAM_KEEP * loudest
        steps = np.round(20 * np.log10(np.maximum(part, 1e-12)) / STREAM_STEP_DB) * STREAM_STEP_DB
        kept[start:start + STREAM_BAND_BINS] = np.where(keep, 10 ** (steps / 20), 0.0)
    return kept * np.exp(1j * phase)


def broadcast(audio: np.ndarray, rate: float) -> np.ndarray:
    """Broadcast: the band to 15 kHz, a broadcast processor's compression, and carrier hiss.

    FM pre-emphasis and the receiver's de-emphasis cancel, so they are not modelled. The source
    is 24 kHz, so its band already ends at 12 kHz: the 15 kHz edge removes nothing here, and what
    distinguishes this rung is the processing, not the bandwidth.
    """
    x = band(audio, rate, BROADCAST_LOW_HZ, min(BROADCAST_HIGH_HZ, rate / 2))
    x = x / (np.max(np.abs(x)) or 1.0)
    width = max(1, int(BROADCAST_WINDOW_S * rate))
    power = np.convolve(x ** 2, np.ones(width) / width, mode='same')
    level_db = 10 * np.log10(power + 1e-12)
    over = np.maximum(0.0, level_db - BROADCAST_THRESHOLD_DB)
    y = x * 10 ** (-over * (1 - 1 / BROADCAST_RATIO) / 20)
    y = y / (np.max(np.abs(y)) or 1.0)
    rng = np.random.default_rng(BROADCAST_SEED)
    hiss = band(rng.standard_normal(len(y)), rate, BROADCAST_LOW_HZ, min(BROADCAST_HIGH_HZ, rate / 2))
    hiss *= 10 ** (BROADCAST_HISS_DB / 20) / (np.sqrt(np.mean(hiss ** 2)) or 1.0)
    return y + hiss


def direct(audio: np.ndarray, rate: float) -> np.ndarray:
    """The clean take: nothing between the AI and the speaker."""
    del rate
    return np.array(audio, dtype=np.float64)


def peer(audio: np.ndarray, rate: float) -> np.ndarray:
    """AI-to-AI traffic: the clean take with a faint ring modulation, so a peer never sounds human."""
    t = np.arange(len(audio)) / rate
    return (1 - PEER_MIX) * audio + PEER_MIX * audio * np.cos(2 * np.pi * PEER_CARRIER_HZ * t)


CHAINS = {'phone': phone, 'stream': stream, 'broadcast': broadcast, 'direct': direct, 'peer': peer}


def render(chain: str, raw: np.ndarray, rate: float) -> np.ndarray:
    """The take through one rung of the ladder, edge-trimmed and at the shared level."""
    return match_level(CHAINS[chain](trim(np.asarray(raw, dtype=np.float64), rate), rate))


def share_above(audio: np.ndarray, rate: float, edge: float) -> float:
    """Share of the whole-file magnitude spectrum above `edge`: the measure behind PROVENANCE.md's
    original 20.63% (clean) and 1.93% (vibration) above 3 kHz. It sums |X|, not |X|^2, which is
    what reproduces those figures (20.53% and 1.87% on the committed ambient_01 mp3s)."""
    magnitude = np.abs(np.fft.rfft(audio))
    freqs = np.fft.rfftfreq(len(audio), 1.0 / rate)
    return float(np.sum(magnitude[freqs > edge]) / (np.sum(magnitude) or 1.0))


SPREAD_FRAME_S = 0.05
SPREAD_GATE_DB = 30.0


def level_spread_db(audio: np.ndarray, rate: float) -> float:
    """How far apart the loud and soft syllables sit: the 90th minus the 10th percentile of the
    voiced 50 ms frame levels (within 30 dB of the loudest), in dB. A broadcast processor exists to
    shrink this. Pauses are left out, or a take's silences would count as dynamics."""
    frame = max(1, int(SPREAD_FRAME_S * rate))
    count = len(audio) // frame
    levels = 20 * np.log10(np.sqrt(np.mean(audio[:count * frame].reshape(count, frame) ** 2, axis=1)) + 1e-12)
    voiced = levels[levels > np.max(levels) - SPREAD_GATE_DB]
    return float(np.percentile(voiced, 90) - np.percentile(voiced, 10))
