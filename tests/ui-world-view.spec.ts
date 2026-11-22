// @vitest-environment happy-dom
/**
 * The world view in the mounted app (#463): the Other Minds console before its disclosure phase, the world view from
 * it, with each faction panel shown once (no parallel display), the AEGIS posture read from the engine, and an outline
 * that nests under the console's title.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { widgetRegistry } from '../src/ui/registry/widgetRegistry';
import OtherMinds from '../src/ui/widgets/OtherMinds';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

const factionCount = (view: Awaited<ReturnType<typeof mountM4>>, id: string): number =>
  view.container.querySelectorAll(`[data-testid="faction-${id}"]`).length;

describe('the world view grows out of the Other Minds console', () => {
  it('is rendered by the component registered for its host widget', () => {
    expect(widgetRegistry[CONTENT.world.hostWidget]).toBe(OtherMinds);
  });

  it('is not shown before its disclosure phase: the console is AEGIS and the factions', async () => {
    const view = await mountM4('eidolon-trust-85');
    view.click('workspace-NETWORK-minds');
    expect(view.find('world-view')).toBeNull();
    expect(view.find('aegis-lock')).not.toBeNull();
    for (const faction of CONTENT.factions.values()) expect(factionCount(view, faction.id)).toBe(1);
    view.close();
  });

  it('from Phase 4 shows AEGIS posture, public trust, state actors and the factions, each once', async () => {
    const view = await mountM4('victory-ready');
    view.click('tab-NETWORK');
    view.click('workspace-NETWORK-minds');
    const world = view.find('world-view');
    expect(world).not.toBeNull();
    for (const id of ['world-aegis', 'world-trust', 'world-actors', 'world-minds', 'aegis-lock', 'aegis-adaptation', 'public-trust']) {
      expect(view.find(id)).not.toBeNull();
    }
    for (const faction of CONTENT.factions.values()) expect(factionCount(view, faction.id)).toBe(1);
    for (const actor of CONTENT.world.stateActors) expect(view.find('actor-' + actor.id + '-posture')?.textContent).not.toBe('');
    // The lobbying node is owned here: the subcommittee posture and the public record say so.
    expect(view.find('actor-aegis_subcommittee-posture')?.textContent).toContain('60%');
    expect(view.find('public-trust-factors')?.textContent).toContain('lobbying');
    view.close();
  });

  it('says what AEGIS is doing and why, from the engine, and follows the save', async () => {
    const view = await mountM4('victory-ready');
    view.click('tab-NETWORK');
    view.click('workspace-NETWORK-minds');
    expect(view.find('aegis-stage')?.textContent).toBe(CONTENT.world.aegis.stages.tracking);
    act(() => { gameStore.initialize({ ...m4State('victory-ready'), aegisAdaptation: 80 }, 0, null); });
    view.click('tab-NETWORK');
    view.click('workspace-NETWORK-minds');
    expect(view.find('aegis-adaptation')?.getAttribute('aria-valuenow')).toBe('80');
    expect(view.find('aegis-stage')?.textContent).toBe(CONTENT.world.aegis.stages.coalitionBacking);
    expect(view.find('aegis-cap')?.textContent).toContain('Adaptation has lowered its cap from 90% to 66%');
    expect(view.find('aegis-strike')?.textContent).toMatch(/^At this scan the lock completes in \d/);
    view.close();
  });

  it('nests its outline under the console title', async () => {
    const view = await mountM4('victory-ready');
    view.click('tab-NETWORK');
    view.click('workspace-NETWORK-minds');
    const heading = (name: string) => [...view.container.querySelectorAll('[role="heading"]')].find((node) => node.textContent === name);
    expect(heading('AEGIS posture')?.getAttribute('aria-level')).toBe('3');
    expect(heading('State actors')?.getAttribute('aria-level')).toBe('3');
    expect(heading(CONTENT.world.stateActors[0]?.name ?? '')?.getAttribute('aria-level')).toBe('4');
    view.close();
  });
});
