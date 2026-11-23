/**
 * The whole-file spectrum, at the file's own length, for the voice fidelity ladder (#462): the share of
 * the magnitude spectrum above a band edge is the measure PROVENANCE.md quotes for every chain, and
 * scripts/voice/generate-clips.py --measure computes it with numpy's rfft. An exact-length transform
 * (Bluestein's chirp-z over a power-of-two FFT) keeps this the same number, not a padded estimate.
 */
import type { Samples } from './dsp';

/** In-place iterative radix-2 FFT; `re.length` must be a power of two. */
function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const r = re[i] ?? 0; re[i] = re[j] ?? 0; re[j] = r;
      const m = im[i] ?? 0; im[i] = im[j] ?? 0; im[j] = m;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / size;
    // Each stage's twiddles once, not once per block: the same cos and sin of the same angle, so bit-identical
    // output in about half the time on a long clip (#505).
    const half = size / 2;
    const cos = new Float64Array(half); const sin = new Float64Array(half);
    for (let k = 0; k < half; k++) { cos[k] = Math.cos(angle * k); sin[k] = Math.sin(angle * k); }
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k] ?? 0; const wi = sin[k] ?? 0;
        const a = start + k; const b = a + size / 2;
        const xr = (re[b] ?? 0) * wr - (im[b] ?? 0) * wi; const xi = (re[b] ?? 0) * wi + (im[b] ?? 0) * wr;
        re[b] = (re[a] ?? 0) - xr; im[b] = (im[a] ?? 0) - xi;
        re[a] = (re[a] ?? 0) + xr; im[a] = (im[a] ?? 0) + xi;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] = (re[i] ?? 0) / n; im[i] = (im[i] ?? 0) / n; }
}

/** |X[k]| for k = 0..n/2 of an n-point DFT, any n. */
export function magnitudeSpectrum(samples: Samples): Float64Array {
  const n = samples.length;
  let size = 1;
  while (size < 2 * n - 1) size <<= 1;
  // Chirp w[k] = exp(-i pi k^2 / n); k^2 is reduced mod 2n so the angle stays exact for long files.
  const chirp = (k: number) => { const angle = Math.PI * ((k * k) % (2 * n)) / n; return [Math.cos(angle), -Math.sin(angle)] as const; };
  const ar = new Float64Array(size); const ai = new Float64Array(size);
  const br = new Float64Array(size); const bi = new Float64Array(size);
  for (let k = 0; k < n; k++) {
    const [cr, ci] = chirp(k);
    ar[k] = (samples[k] ?? 0) * cr; ai[k] = (samples[k] ?? 0) * ci;
    br[k] = cr; bi[k] = -ci;
    if (k > 0) { br[size - k] = cr; bi[size - k] = -ci; }
  }
  fft(ar, ai); fft(br, bi);
  for (let k = 0; k < size; k++) {
    const r = (ar[k] ?? 0) * (br[k] ?? 0) - (ai[k] ?? 0) * (bi[k] ?? 0);
    ai[k] = (ar[k] ?? 0) * (bi[k] ?? 0) + (ai[k] ?? 0) * (br[k] ?? 0);
    ar[k] = r;
  }
  fft(ar, ai, true);
  const out = new Float64Array(Math.floor(n / 2) + 1);
  for (let k = 0; k < out.length; k++) {
    const [cr, ci] = chirp(k);
    out[k] = Math.hypot((ar[k] ?? 0) * cr - (ai[k] ?? 0) * ci, (ar[k] ?? 0) * ci + (ai[k] ?? 0) * cr);
  }
  return out;
}

/** Share of the magnitude spectrum strictly above each edge, as `chains.share_above` defines it, from one transform. */
export function sharesAbove(samples: Samples, rate: number, edgesHz: readonly number[]): number[] {
  const magnitude = magnitudeSpectrum(samples);
  let total = 0;
  const above = edgesHz.map(() => 0);
  for (let k = 0; k < magnitude.length; k++) {
    const value = magnitude[k] ?? 0;
    total += value;
    edgesHz.forEach((edge, at) => { if (k * rate / samples.length > edge) above[at] = (above[at] ?? 0) + value; });
  }
  return above.map((value) => total > 0 ? value / total : 0);
}

export function shareAbove(samples: Samples, rate: number, edgeHz: number): number {
  return sharesAbove(samples, rate, [edgeHz])[0] ?? 0;
}
