/**
 * The width policy is pure, so its boundaries are proven here rather than only
 * through the browser matrix (#103 gaps 4-6).
 */
import { describe, expect, it } from 'vitest';
import { COLUMN_MIN_WIDTH, COMPACT_CAPTION_MAX_WIDTH, CONTENT_MAX_WIDTH, MOBILE_MAX_WIDTH, NARROW_CHROME_MAX_WIDTH, SHORT_VIEWPORT_MAX_HEIGHT, SIDE_COLUMN_MIN_WIDTH, THREE_COLUMN_MIN_WIDTH, VERY_NARROW_CHROME_MAX_WIDTH, isCompactViewport, isNarrowChrome, isShortViewport, isVeryNarrowChrome, layoutFor } from '../src/ui/layout';

describe('layoutFor', () => {
  it('keeps a phone in the single-scroll layout', () => {
    expect(layoutFor(390, 844).mode).toBe('mobile');
    expect(layoutFor(320, 568).mode).toBe('mobile');
    expect(layoutFor(MOBILE_MAX_WIDTH, 1024).mode).toBe('mobile');
  });

  it('gives the 768-899 band its own two-column tier', () => {
    expect(layoutFor(COLUMN_MIN_WIDTH, 1024)).toEqual({
      mode: 'tablet',
      threeColumns: false,
      sideMinWidth: SIDE_COLUMN_MIN_WIDTH,
      contentMaxWidth: CONTENT_MAX_WIDTH,
    });
    expect(layoutFor(844, 1200).mode).toBe('tablet');
    expect(layoutFor(THREE_COLUMN_MIN_WIDTH - 1, 1200).mode).toBe('tablet');
  });

  it('opens the third column at the three-column boundary', () => {
    expect(layoutFor(THREE_COLUMN_MIN_WIDTH, 900)).toMatchObject({ mode: 'desktop', threeColumns: true });
    expect(layoutFor(2560, 1440)).toMatchObject({ mode: 'desktop', threeColumns: true });
  });

  it('holds a short viewport at the single scroll even when it is wide', () => {
    expect(layoutFor(844, 390).mode).toBe('mobile');
    expect(layoutFor(1440, SHORT_VIEWPORT_MAX_HEIGHT).mode).toBe('mobile');
    expect(layoutFor(1440, SHORT_VIEWPORT_MAX_HEIGHT + 1).mode).toBe('desktop');
  });

  it('does not read an unmeasured height as a short viewport', () => {
    expect(layoutFor(1440, 0).mode).toBe('desktop');
    expect(layoutFor(768, 0).mode).toBe('tablet');
  });

  it('compacts captions below the compaction boundary and nowhere above it', () => {
    expect(isCompactViewport(COMPACT_CAPTION_MAX_WIDTH - 1)).toBe(true);
    expect(isCompactViewport(320)).toBe(true);
    expect(isCompactViewport(COMPACT_CAPTION_MAX_WIDTH)).toBe(false);
    expect(isCompactViewport(2560)).toBe(false);
  });

  it('caps the reading measure at every width', () => {
    for (const width of [320, 768, 900, 1440, 1920, 2560]) {
      expect(layoutFor(width, 1080).contentMaxWidth).toBe(CONTENT_MAX_WIDTH);
    }
  });

  it('never asks for a three-column split it cannot fill', () => {
    for (const width of [320, 390, 768, 899]) {
      expect(layoutFor(width, 1080).threeColumns).toBe(false);
    }
  });
});
describe('narrow chrome boundary (#108)', () => {
  it('tightens the header below 400 and never at or above it', () => {
    expect(isNarrowChrome(320)).toBe(true);
    expect(isNarrowChrome(NARROW_CHROME_MAX_WIDTH - 1)).toBe(true);
    expect(isNarrowChrome(NARROW_CHROME_MAX_WIDTH)).toBe(false);
    expect(isNarrowChrome(360)).toBe(true);
    // The header band is a separate boundary on purpose: 360-399 fits one row with
    // tighter padding, and only below 360 does the status line take its own row.
    expect(isVeryNarrowChrome(320)).toBe(true);
    expect(isVeryNarrowChrome(VERY_NARROW_CHROME_MAX_WIDTH - 1)).toBe(true);
    expect(isVeryNarrowChrome(VERY_NARROW_CHROME_MAX_WIDTH)).toBe(false);
    expect(isVeryNarrowChrome(360)).toBe(false);
    expect(VERY_NARROW_CHROME_MAX_WIDTH).toBeLessThan(NARROW_CHROME_MAX_WIDTH);
    expect(isNarrowChrome(390)).toBe(true);
    expect(isNarrowChrome(414)).toBe(false);
  });

  it('is a different boundary from the caption one, on purpose', () => {
    // Captions compact from 900; chrome only has to tighten below 400. Collapsing
    // them would make a 900-wide viewport use the phone header.
    expect(NARROW_CHROME_MAX_WIDTH).toBeLessThan(COMPACT_CAPTION_MAX_WIDTH);
    expect(isCompactViewport(500)).toBe(true);
    expect(isNarrowChrome(500)).toBe(false);
  });
});

describe('short viewport boundary (#108)', () => {
  it('treats a landscape phone as short and a tall phone as not', () => {
    expect(isShortViewport(390)).toBe(true);
    expect(isShortViewport(SHORT_VIEWPORT_MAX_HEIGHT)).toBe(true);
    expect(isShortViewport(SHORT_VIEWPORT_MAX_HEIGHT + 1)).toBe(false);
    expect(isShortViewport(844)).toBe(false);
  });

  it('is not evidence of a short viewport when the height is unmeasured', () => {
    // happy-dom reports 0 before layout; classifying that as short put 12 column
    // tests into the mobile tier once already.
    expect(isShortViewport(0)).toBe(false);
  });
});
