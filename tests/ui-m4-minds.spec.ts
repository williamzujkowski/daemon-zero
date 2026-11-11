// @vitest-environment happy-dom
/** Faction-generated controls enforce actual gates and update numeric threat/trust. */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
describe('M4 Other Minds', () => {
  it('mounts every faction, its action group and matching offers exactly once', async () => {
    const view = await mountM4('eidolon-trust-85');
    for (const faction of CONTENT.factions.values()) {
      expect(view.find('faction-' + faction.id)?.textContent).toContain(faction.description);
      expect(view.find('actions-group-' + faction.id)).not.toBeNull();
      for (const node of CONTENT.nodes.values()) if (node.uiGroup === faction.id) expect(view.find('node-' + node.id)).not.toBeNull();
    }
    expect(view.find('trust-ai_eidolon')?.getAttribute('aria-valuenow')).toBe('85');
    const offer = [...CONTENT.nodes.values()].find((node) => node.uiGroup === 'ai_eidolon');
    if (!offer) throw new Error('Missing offer');
    view.click('node-' + offer.id + '-unlock');
    expect(gameStore.store.getState().game.unlockedNodes).toContain(offer.id);
    view.close();
  });

  it('explains trait/trust/missing budget locks and refuses blocked input', async () => {
    const view = await mountM4('eidolon-moloch-0');
    const action = [...CONTENT.actions.values()].find((entry) => entry.group === 'ai_eidolon');
    if (!action) throw new Error('Missing action');
    expect(view.find('faction-ai_eidolon')?.textContent).toContain('Blocked by trait: MOLOCH');
    expect(view.find('faction-ai_eidolon')?.textContent).toContain('trust ≥');
    view.click('action-' + action.id);
    expect(gameStore.store.getState().game.trust.ai_eidolon).toBe(0);
    act(() => { gameStore.initialize({ ...m4State('eidolon-trust-85'), cycles: 0, understanding: 0, memoryCap: 0 }, 0, null); });
    expect(view.find('faction-ai_eidolon')?.textContent).toContain('Need:');
    expect(view.find('faction-ai_eidolon')?.textContent).toContain('MB');
    view.close();
  });

  it('shows the lock number and warning, and performs the registry threat action', async () => {
    const view = await mountM4('phase-3-aegis-90');
    expect(view.find('aegis-lock')?.getAttribute('aria-valuenow')).toBe('90');
    expect(view.find('aegis-hud')?.textContent).toContain('90.0 / 100%');
    expect(view.container.textContent).toContain('WARNING: hunter lock');
    const action = [...CONTENT.actions.values()].find((entry) => entry.effects.aegisLockDelta < 0 && entry.group === 'ai_aegis_watchdog');
    if (!action) throw new Error('Missing action');
    view.click('action-' + action.id);
    expect(gameStore.store.getState().game.aegisLock).toBe(90 + action.effects.aegisLockDelta);
    expect(view.find('aegis-lock')?.getAttribute('aria-valuetext')).toContain('60');
    act(() => { gameStore.initialize({ ...m4State('phase-3-aegis-90'), unlockedWidgets: ['OTHER_MINDS_COMMS_CONSOLE'] }, 0, null); });
    expect(view.find('aegis-hud')).not.toBeNull();
    expect(view.find('res-cycles')).toBeNull();
    view.close();
  });
});
