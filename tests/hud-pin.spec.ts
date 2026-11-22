/** The phone HUD's pin decision (vote-1795328874247-003j4kk, #365): measured, capped at 35% of the window, with hysteresis. */
import { describe, expect, it } from 'vitest';
import { HUD_PIN_HYSTERESIS_PX, HUD_PIN_SHARE, hudPinned } from '../src/ui/hudPin';

const WINDOW = 844, LIMIT = WINDOW * HUD_PIN_SHARE;

describe('hudPinned', () => {
  it('keeps its state until the HUD and the window are measured, so nothing remounts before there is a reason', () => {
    expect(hudPinned({ band: 0, hud: 0 }, WINDOW, false)).toBe(false);
    expect(hudPinned({ band: 0, hud: 0 }, WINDOW, true)).toBe(true);
    expect(hudPinned({ band: 0, hud: 100 }, 0, true)).toBe(true);
  });

  it('pins a HUD that fits with the band, and not one that does not', () => {
    expect(hudPinned({ band: 0, hud: 120 }, WINDOW, false)).toBe(true);
    expect(hudPinned({ band: 88, hud: 120 }, WINDOW, false)).toBe(true);
    expect(hudPinned({ band: 88, hud: 300 }, WINDOW, false)).toBe(false);
    // 2x text: the HUD alone is over the cap at 360x640.
    expect(hudPinned({ band: 0, hud: 300 }, 640, false)).toBe(false);
  });

  it('takes a pin only with the hysteresis to spare, and drops one only past the cap', () => {
    const edge = Math.floor(LIMIT) - 1;
    expect(hudPinned({ band: 0, hud: edge }, WINDOW, false)).toBe(edge <= LIMIT - HUD_PIN_HYSTERESIS_PX);
    expect(hudPinned({ band: 0, hud: edge }, WINDOW, true)).toBe(true);
    expect(hudPinned({ band: 0, hud: Math.ceil(LIMIT) + 1 }, WINDOW, true)).toBe(false);
    // Rocking a few pixels around the cap cannot flip it back and forth.
    let pinned = hudPinned({ band: 0, hud: LIMIT - HUD_PIN_HYSTERESIS_PX - 1 }, WINDOW, false);
    for (const hud of [LIMIT - 3, LIMIT - 1, LIMIT - 4, LIMIT]) pinned = hudPinned({ band: 0, hud }, WINDOW, pinned);
    expect(pinned).toBe(true);
  });
});
