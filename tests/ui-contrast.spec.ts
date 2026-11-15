// @vitest-environment happy-dom
/**
 * The palette's contrast bars, asserted instead of audited by hand (#111).
 *
 * UI-SPEC says phase shifts recolor structural accents while keeping contrast at
 * or above WCAG AA. That was a claim: nobody had measured the 1px structural
 * border, and it turned out to sit at 2.63:1 against the background — below the
 * 3:1 non-text bar the spec's own accessibility section implies. These tests are
 * the reason it cannot happen again.
 *
 * Bars: body text 4.5:1, non-text UI (borders, accent, warning, danger) 3:1.
 */
import { describe, expect, it } from 'vitest';
import { palette } from '../src/ui/theme';
import { PHASE_TOKENS } from '../src/ui/PhaseTheme';

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16), g = parseInt(value.slice(2, 4), 16), b = parseInt(value.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

const NON_TEXT = 3;
const BODY = 4.5;
// Panels sit on `surface`; `raised` is the lightest plate a border or label can
// land on, so a token that clears it clears every backdrop in the palette.
const BACKDROPS = ['background', 'surface', 'raised'] as const;
const round = (value: number): number => Math.round(value * 100) / 100;

function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}
function hue(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), span = max - min;
  if (span === 0) return 0;
  const raw = max === r ? ((g - b) / span) % 6 : max === g ? (b - r) / span + 2 : (r - g) / span + 4;
  return ((raw * 60) + 360) % 360;
}
function saturation(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
}
function hueDistance(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return Math.min(raw, 360 - raw);
}

describe('palette contrast bars (#111)', () => {
  it('states the bars it enforces', () => {
    expect(NON_TEXT).toBe(3);
    expect(BODY).toBe(4.5);
  });

  for (const backdrop of BACKDROPS) {
    const behind = palette[backdrop];

    it('clears 3:1 for text on ' + backdrop, () => {
      expect(round(contrast(palette.text, behind))).toBeGreaterThanOrEqual(BODY);
      expect(round(contrast(palette.muted, behind))).toBeGreaterThanOrEqual(BODY);
    });

    it('clears 3:1 for the structural border and each semantic colour on ' + backdrop, () => {
      for (const token of ['border', 'accent', 'warning', 'danger'] as const) {
        expect(round(contrast(palette[token], behind)), token + ' on ' + backdrop).toBeGreaterThanOrEqual(NON_TEXT);
      }
    });
  }

  it('keeps every phase border and accent above 3:1 on every backdrop', () => {
    expect(PHASE_TOKENS.length).toBeGreaterThan(1);
    for (const [index, tokens] of PHASE_TOKENS.entries()) {
      for (const backdrop of BACKDROPS) {
        const behind = palette[backdrop];
        expect(round(contrast(tokens.border, behind)), `phase ${String(index)} border on ${backdrop}`).toBeGreaterThanOrEqual(NON_TEXT);
        expect(round(contrast(tokens.accent, behind)), `phase ${String(index)} accent on ${backdrop}`).toBeGreaterThanOrEqual(NON_TEXT);
      }
    }
  });

  it('keeps the muted HUD label a clear step below the 14px value it labels', () => {
    // The design relies on the amount reading brighter than its label; equality
    // would flatten the HUD even while both passed their contrast bars.
    expect(contrast(palette.text, palette.surface)).toBeGreaterThan(contrast(palette.muted, palette.surface) * 1.3);
  });
});

describe('hue separation between semantic colours and phase accents (#124)', () => {
  // 30 degrees is the smallest separation at which two saturated colours still read
  // as different signals at 12px. Before this test, phases 2 and 4 sat 0 and 3
  // degrees from the warning colour and no measurement noticed.
  const MIN = 30;

  it('keeps warning and danger apart from each other and from the base accent', () => {
    expect(hueDistance(hue(palette.warning), hue(palette.danger))).toBeGreaterThanOrEqual(MIN);
    expect(hueDistance(hue(palette.accent), hue(palette.warning))).toBeGreaterThanOrEqual(MIN);
    expect(hueDistance(hue(palette.accent), hue(palette.danger))).toBeGreaterThanOrEqual(MIN);
  });

  it('gives every phase accent a hue of its own', () => {
    const accents = PHASE_TOKENS.map((token, index) => ({ index, hex: token.accent, hue: hue(token.accent), saturation: saturation(token.accent) }));
    for (const accent of accents) {
      // A near-neutral accent conveys state by brightness, not hue; there is nothing
      // for a hue bar to hold it to.
      if (accent.saturation < 0.2) continue;
      expect(hueDistance(accent.hue, hue(palette.warning)), `phase ${String(accent.index)} vs warning`).toBeGreaterThanOrEqual(MIN);
      expect(hueDistance(accent.hue, hue(palette.danger)), `phase ${String(accent.index)} vs danger`).toBeGreaterThanOrEqual(MIN);
    }
    const saturated = accents.filter((accent) => accent.saturation >= 0.2);
    for (const left of saturated) {
      for (const right of saturated) {
        // Phases 0 and 1 share the opening palette on purpose: that is one identity,
        // not two that need separating.
        if (left.index >= right.index || left.hex === right.hex) continue;
        expect(hueDistance(left.hue, right.hue), `phase ${String(left.index)} vs phase ${String(right.index)}`).toBeGreaterThanOrEqual(MIN);
      }
    }
  });
});
