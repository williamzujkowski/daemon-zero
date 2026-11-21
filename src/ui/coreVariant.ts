/**
 * PROTOTYPE (#385, removed when its vote lands): the CORE ordering variant, read from a whitelisted `?variant=` on the
 * web build only. With no variant the app renders exactly as before. A variant lifts timely parts out of the job
 * surface's nesting so CoreOrder can place them; a hoisted part renders where CoreOrder puts it and nowhere else.
 */
import { createContext, useContext } from 'react';
import { Platform } from 'react-native';

export const CORE_VARIANTS = ['next-action', 'status', 'objective'] as const;
export type CoreVariant = (typeof CORE_VARIANTS)[number];

/** Pure: the variant a query string names, or null for anything not on the whitelist. */
export function parseCoreVariant(search: string): CoreVariant | null {
  const value = new URLSearchParams(search).get('variant');
  return CORE_VARIANTS.find((variant) => variant === value) ?? null;
}

function readVariant(): CoreVariant | null {
  if (Platform.OS !== 'web') return null;
  const search = (globalThis as { location?: { search?: string } }).location?.search;
  return typeof search === 'string' ? parseCoreVariant(search) : null;
}

/** Read once: the variant is a property of the page load, so it cannot change under a mounted pane. */
const ACTIVE: CoreVariant | null = readVariant();

export function coreVariant(): CoreVariant | null {
  return ACTIVE;
}

/** The parts a variant lifts out of the job surface. */
export type HoistedPart = 'standing' | 'service' | 'grant' | 'release' | 'departure';

/** True inside CoreOrder's own block for a part; false where the part sits nested in the job surface. */
export const HoistedBlock = createContext(false);

/** Whether a nested part should step aside because the active variant renders it as its own block. */
export function useHoistedElsewhere(): boolean {
  const inBlock = useContext(HoistedBlock);
  return ACTIVE !== null && !inBlock;
}

/** Settled terms fold to one line in every variant; never without one. */
export function settledFolds(): boolean {
  return ACTIVE !== null;
}
