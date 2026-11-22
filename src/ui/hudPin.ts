/**
 * When the phone's resource HUD sticks under the alert band (vote-1795328874247-003j4kk, 7 of 7, #384/#365): while the band
 * and the HUD together fit HUD_PIN_SHARE of the window. Over it (large text, a stack of alerts) the HUD scrolls in place
 * as the one-scroll rule always had it, so a pinned block can never hide the workspace. Pure, from measured heights, with
 * hysteresis, so a height that rocks at the edge cannot flip the layout back and forth (the #384 prototype's pin decision
 * raced layout; the panel asked for a deterministic one).
 */

/** The share of the window the band and the pinned HUD may take together. */
export const HUD_PIN_SHARE = 0.35;
/** A dropped (or never taken) pin needs this much room under the cap before it is taken. */
export const HUD_PIN_HYSTERESIS_PX = 8;

export interface HudHeights { band: number; hud: number }

/**
 * Whether the HUD sticks, given the measured heights, the window height and whether it sticks now. Until both heights are
 * measured it keeps its state: the HUD starts pinned (it fits on ordinary phones, about 15% of an 844 px window), because
 * moving it between the sticky block and the flow remounts it, and a remount re-announces the alerts inside it. A flip,
 * and so that re-announcement, happens only when the measurement disagrees: large text at load, or alerts past the cap.
 */
export function hudPinned({ band, hud }: HudHeights, windowHeight: number, pinnedNow: boolean): boolean {
  if (!(hud > 0) || !(windowHeight > 0)) return pinnedNow;
  const limit = windowHeight * HUD_PIN_SHARE;
  return band + hud <= (pinnedNow ? limit : limit - HUD_PIN_HYSTERESIS_PX);
}

/**
 * Whether the interrupt forecast joins the pinned HUD (vote-1795335412078-ubcj3e7, 7 of 7, #365): only while the HUD is
 * pinned and the band, the HUD and the forecast together still fit the same cap, with the same hysteresis. The HUD's
 * decision never looks at the forecast, so the forecast can never cost the HUD its pin (pinning both on one decision
 * measured worse: 53% of timely items kept against 64% for the HUD alone and 74% for this tier). The forecast holds no
 * live region, so moving it re-announces nothing.
 */
export function forecastPinned({ band, hud }: HudHeights, forecast: number, windowHeight: number, hudIsPinned: boolean, pinnedNow: boolean): boolean {
  if (!hudIsPinned || !(forecast > 0)) return false;
  return hudPinned({ band, hud: hud + forecast }, windowHeight, pinnedNow);
}
