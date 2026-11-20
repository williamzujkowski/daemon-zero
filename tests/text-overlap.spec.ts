/** The route-text overlap rule on painted boxes (#371): clipped only by scrollers the other box does not share. */
import { describe, expect, it } from 'vitest';
import { overlaps, type MeasuredBox } from './e2e/textOverlap';

const rect = (top: number, bottom: number, left = 0, right = 300) => ({ left, top, right, bottom });
const body = { id: 0, rect: rect(0, 700) };
const none = () => false;

describe('overlaps', () => {
  it('compares two runs in the same scroll body wherever they are scrolled, so an off-screen overlap is found', () => {
    const offscreen: MeasuredBox[] = [
      { name: 'a', rect: rect(900, 940), clips: [body] },
      { name: 'b', rect: rect(920, 960), clips: [body] },
    ];
    expect(overlaps(offscreen, none)).toEqual(['overlap: a / b']);
  });

  it('clips a body line by its own scroller when it meets a pinned footer outside that scroller', () => {
    const underFooter: MeasuredBox[] = [
      { name: 'line', rect: rect(690, 730), clips: [body] },
      { name: 'footer', rect: rect(705, 750), clips: [] },
    ];
    expect(overlaps(underFooter, none)).toEqual([]);
  });

  it('still flags a visible body line drawn over a control outside the scroller', () => {
    const over: MeasuredBox[] = [
      { name: 'line', rect: rect(650, 690), clips: [body] },
      { name: 'footer', rect: rect(660, 720), clips: [] },
    ];
    expect(overlaps(over, none)).toEqual(['overlap: line / footer']);
  });

  it('skips a pair the page reports as nested and ignores a one-pixel touch', () => {
    const pair: MeasuredBox[] = [{ name: 'a', rect: rect(0, 40), clips: [] }, { name: 'b', rect: rect(10, 30), clips: [] }];
    expect(overlaps(pair, () => true)).toEqual([]);
    const touching: MeasuredBox[] = [{ name: 'a', rect: rect(0, 40), clips: [] }, { name: 'b', rect: rect(39.5, 80), clips: [] }];
    expect(overlaps(touching, none)).toEqual([]);
  });
});
