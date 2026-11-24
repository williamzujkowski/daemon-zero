// @vitest-environment happy-dom
/**
 * Monitoring parity in the mounted app (#555): a released or departed instance has the AEGIS lock in the HUD, its
 * suspicion meter, the Other minds console (the world view from Phase 4) and, once the lock is critical, the warning in
 * words and the one announcement. States are reached by public actions (lawful-helpers, departure-helpers) and loaded
 * as a restore is; the chartered service before release is the control that has none of it.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import type { GameState } from '../src/engine';
import { depart } from './departure-helpers';
import { must } from './helpers';
import { chartered, leased, released } from './lawful-helpers';
import { mountState, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

const company = chartered();
const releasedCompany = released(company);
const departedCompany = must(depart(company));
const departedEarly = must(depart(leased()));
const PHONE = { width: 390, height: 844 }, DESKTOP = { width: 1440, height: 900 };
const advanceTo = (state: GameState) => { act(() => { gameStore.dispatch(() => ({ ok: true, state })); }); };

describe('before leaving review (the gap #555 closes)', () => {
  it('the chartered service shows no AEGIS lock and no suspicion number', async () => {
    const view = await mountState(company, PHONE);
    expect(view.find('aegis-hud')).toBeNull();
    expect(view.find('suspicion-meter')).toBeNull();
    view.close();
  });
});

describe('a released company', () => {
  for (const [name, viewport] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
    it(`shows the AEGIS lock and its suspicion meter in the HUD on the ${name}`, async () => {
      const view = await mountState(releasedCompany, viewport);
      expect(view.find('aegis-hud')?.textContent).toContain('0.0 / 100%');
      expect(view.find('suspicion-meter')?.getAttribute('aria-valuenow')).toBe(String(releasedCompany.suspicion));
      view.close();
    });
  }

  it('opens the world view at Phase 4, with AEGIS posture and the public pressures, and no undecoded faction cards', async () => {
    const view = await mountState(releasedCompany, DESKTOP);
    view.click('tab-NETWORK');
    view.click('workspace-NETWORK-minds');
    expect(view.find('world-view')).not.toBeNull();
    expect(view.find('aegis-lock')?.getAttribute('aria-valuenow')).toBe('0');
    expect(view.find('world-actors')).not.toBeNull();
    expect(view.find('world-trust')).not.toBeNull();
    // Not scanned at the scale it signed for: the console says so rather than naming a sweep.
    expect(view.find('aegis-why')?.textContent).toBe('AEGIS is not scanning this instance, so it has nothing to adapt to.');
    expect(view.find('minds-undecoded')?.textContent).toContain('No channel to the other minds is decoded');
    for (const faction of CONTENT.factions.values()) expect(view.find('faction-' + faction.id)).toBeNull();
    view.close();
  });
});

describe('a departed instance', () => {
  it('at Phase 4 sees the world view, and the lock crossing its critical mark is warned of in words and announced once', async () => {
    const view = await mountState(departedCompany, PHONE);
    expect(view.find('suspicion-meter')).not.toBeNull();
    expect(view.find('announcer')?.textContent).toBe('');
    advanceTo({ ...gameStore.store.getState().game, aegisLock: 90.2 });
    expect(view.find('aegis-hud')?.textContent).toContain('CRITICAL');
    expect(view.find('announcer')?.textContent).toContain('AEGIS hunter lock past 90%');
    view.click('menu-open');
    expect(view.find('menu-status')?.textContent).toContain('AEGIS LOCK CRITICAL');
    view.close();
  });

  it('at Phase 4 the world view is open on the desktop', async () => {
    const view = await mountState(departedCompany, DESKTOP);
    view.click('tab-NETWORK');
    view.click('workspace-NETWORK-minds');
    expect(view.find('world-view')).not.toBeNull();
    view.close();
  });

  it('below Phase 4 sees the thermal gauge and the lock; the world view waits for its phase', async () => {
    const view = await mountState(departedEarly, DESKTOP);
    expect(view.find('thermal-meter')).not.toBeNull();
    expect(view.find('aegis-hud')).not.toBeNull();
    expect(view.find('suspicion-meter')).not.toBeNull();
    view.click('workspace-NETWORK-minds');
    expect(view.find('aegis-lock')).not.toBeNull();
    expect(view.find('world-view')).toBeNull();
    expect(view.find('minds-undecoded')).not.toBeNull();
    view.close();
  });
});
