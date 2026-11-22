/**
 * PROTOTYPE (#384, removed when the one-scroll vote lands): the phone main-view variant, read from a whitelisted
 * `?variant=` on the web build only. With no variant the app renders exactly as before.
 *   sticky-hud  the resource HUD sticks with the alert band while the workspace scrolls
 *   collapse    the whole status chrome sticks, collapses to the HUD and one forecast line once scrolled, and
 *               expands on tap
 *   now         a "now" strip sticks: suspicion, the forecast and the newest notice (the omen)
 * Each moves the real readouts into the sticky block rather than copying them, so nothing is announced twice.
 */
import { createContext, useContext } from 'react';
import { Platform } from 'react-native';

export const PHONE_VARIANTS = ['sticky-hud', 'collapse', 'now'] as const;
export type PhoneVariant = (typeof PHONE_VARIANTS)[number];

/** Pure: the variant a query string names, or null for anything not on the whitelist. */
export function parsePhoneVariant(search: string): PhoneVariant | null {
  const value = new URLSearchParams(search).get('variant');
  return PHONE_VARIANTS.find((variant) => variant === value) ?? null;
}

function readVariant(): PhoneVariant | null {
  if (Platform.OS !== 'web') return null;
  const search = (globalThis as { location?: { search?: string } }).location?.search;
  return typeof search === 'string' ? parsePhoneVariant(search) : null;
}

/** Read once: the variant is a property of the page load. */
const ACTIVE: PhoneVariant | null = readVariant();

export function phoneVariant(): PhoneVariant | null {
  return ACTIVE;
}

/** True inside the phone tier's sticky block; the "now" variant renders the omen and suspicion only there. */
export const InStickyBlock = createContext(false);

/** Whether a part the "now" strip pins should step aside where it normally renders on the phone. */
export function useNowElsewhere(phone: boolean): boolean {
  const inBlock = useContext(InStickyBlock);
  return phone && ACTIVE === 'now' && !inBlock;
}
