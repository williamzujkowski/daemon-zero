/** The CORE pane's order (#385: status-first, vote-1795245515054-vgmv0a9; readouts after purchases, vote-1795246136374-t01m4ug). */
import { describe, expect, it } from 'vitest';
import { CORE_ORDER, type CoreBlock } from '../src/ui/CorePane';

const at = (block: CoreBlock) => CORE_ORDER.indexOf(block);

describe('the CORE order', () => {
  it('places every block exactly once', () => {
    expect(new Set(CORE_ORDER).size).toBe(CORE_ORDER.length);
    expect(CORE_ORDER).toHaveLength(17);
  });

  it('keeps EXECUTE first, the opening log under it, and the omen never above it (j2buva4)', () => {
    expect(CORE_ORDER[0]).toBe('manual');
    expect(at('boot')).toBe(1);
    expect(at('omen')).toBeGreaterThan(at('manual'));
  });

  it('leads with what can be non-nominal, ahead of everything the player acts on', () => {
    for (const status of ['omen', 'standing', 'conditioning'] as const) {
      for (const later of ['channel', 'grantCards', 'service', 'routeControls', 'grant', 'release', 'departure', 'record', 'cards'] as const) {
        expect(at(status), status + ' before ' + later).toBeLessThan(at(later));
      }
    }
  });

  it('puts the route work (#361) ahead of the purchases, and every other CORE widget after them, where main had it', () => {
    for (const work of ['channel', 'grantCards', 'service', 'routeControls', 'grant', 'release', 'departure'] as const) {
      expect(at(work), work).toBeLessThan(at('cards'));
    }
    expect(at('widgets')).toBeGreaterThan(at('cards'));
    expect(at('widgets')).toBeGreaterThan(at('upgrades'));
  });
});
