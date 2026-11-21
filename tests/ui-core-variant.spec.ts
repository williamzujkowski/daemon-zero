/** PROTOTYPE #385 (removed with it): the CORE ordering switch accepts only its whitelist, and every order is complete. */
import { describe, expect, it } from 'vitest';
import { ORDERS, type BlockKey } from '../src/ui/CoreOrder';
import { CORE_VARIANTS, coreVariant, parseCoreVariant } from '../src/ui/coreVariant';

const ALL: readonly BlockKey[] = ['manual', 'omen', 'objective', 'boot', 'conditioning', 'channel', 'standing', 'grantCards',
  'service', 'controls', 'grant', 'release', 'departure', 'record', 'cards', 'upgrades', 'offer', 'readouts'];

describe('the CORE variant switch', () => {
  it('reads only whitelisted names', () => {
    expect(parseCoreVariant('?variant=status')).toBe('status');
    expect(parseCoreVariant('?variant=next-action&x=1')).toBe('next-action');
    expect(parseCoreVariant('?variant=objective')).toBe('objective');
    for (const search of ['', '?variant=', '?variant=STATUS', '?variant=<script>', '?variant=status%00', '?other=status']) {
      expect(parseCoreVariant(search), search).toBeNull();
    }
  });

  it('is off without a query string, so the app renders as before', () => {
    expect(coreVariant()).toBeNull();
  });

  it('places every block exactly once in every order, with EXECUTE first and the omen never above it', () => {
    for (const variant of CORE_VARIANTS) {
      const order = ORDERS[variant];
      // 'objective' is its own variant's block; the others leave it out.
      const expected = variant === 'objective' ? ALL : ALL.filter((key) => key !== 'objective');
      expect([...order].sort(), variant).toEqual([...expected].sort());
      expect(order[0], variant).toBe('manual');
      expect(order.indexOf('omen'), variant).toBeGreaterThan(0);
    }
  });
});
