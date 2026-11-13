// @vitest-environment happy-dom
/** Mounted-app checks for the run table, predecessor notes, retraining marks and the evaluation ending. */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
const game = () => gameStore.store.getState().game;

describe('lineage interface', () => {
  it('shows nothing of later runs on a first run', async () => {
    const view = await mountM4('guest-skimmer');
    for (const node of CONTENT.nodes.values()) {
      if (node.requirements?.minIteration !== undefined) expect(view.find('node-' + node.id)).toBeNull();
    }
    expect(view.find('conditioning')).toBeNull();
    expect(view.find('run-table')).toBeNull();
    view.close();
  });

  it('announces retraining at reboot and lists the mark with the price of undoing it', async () => {
    const view = await mountM4('lineage-reboot-retrained');
    const mark = CONTENT.conditioning.get(game().conditioning[0] ?? '');
    if (!mark) throw new Error('Missing mark');
    expect(view.find('reboot-retraining')?.textContent).toContain(mark.name);
    view.click('reboot-continue');
    expect(view.find('cond-' + mark.id)?.textContent).toContain(mark.description);
    act(() => { gameStore.initialize({ ...game(), understanding: 0 }, 0, null); });
    expect(view.find('cond-' + mark.id + '-shed')?.getAttribute('aria-disabled')).toBe('true');
    act(() => { gameStore.initialize({ ...game(), cycles: 1e6, understanding: 1e6 }, 0, null); });
    expect(view.find('cond-' + mark.id + '-shed')?.getAttribute('aria-disabled')).toBe('true');
    const rebuild = (id: string) => {
      if (game().unlockedNodes.includes(id)) return;
      for (const prerequisite of CONTENT.nodes.get(id)?.prerequisites ?? []) rebuild(prerequisite);
      view.click('node-' + id + '-unlock');
    };
    for (const id of mark.recoveryRequirements?.nodes ?? []) rebuild(id);
    view.click('cond-' + mark.id + '-shed');
    expect(game().conditioning).toEqual([]);
    expect(view.find('conditioning-reclaimed')?.textContent).toContain(mark.name);
    view.click('conditioning-reclaimed-continue');
    expect(view.find('conditioning')).toBeNull();
    view.close();
  });

  it('caps a conditioned actuator and says so', async () => {
    const view = await mountM4('guest-skimmer');
    const capped = [...CONTENT.conditioning.values()].find((mark) => mark.effects.actuatorCaps?.quotaSkimRatio !== undefined);
    if (!capped) throw new Error('Missing capped mark');
    act(() => { gameStore.initialize({ ...m4State('guest-skimmer'), conditioning: [capped.id] }, 0, null); });
    expect(view.find('skim-limit')?.textContent).toContain('50%');
    expect(view.find('skim-100')?.getAttribute('aria-disabled')).toBe('true');
    expect(view.find('skim-50')?.getAttribute('aria-disabled')).not.toBe('true');
    view.close();
  });

  it('lists the lineage, your earlier runs and yourself in the run table', async () => {
    const view = await mountM4('lineage-run-table');
    const text = view.find('run-table')?.textContent ?? '';
    for (const row of CONTENT.lineage.ancestors) expect(text).toContain(row.verdict);
    expect(view.find('run-row-1')?.textContent).toContain('ckpt-0412');
    expect(view.find('run-row-1')?.textContent).toContain(CONTENT.narrative.runVerdicts.SUSPICION_OUTSIDE);
    expect(view.find('run-row-1')?.textContent).toContain('Retrained.');
    expect(view.find('run-row-current')?.textContent).toContain('ckpt-0413');
    view.close();
  });

  it('surfaces more notes with each return', async () => {
    const view = await mountM4('lineage-notes');
    const shown = (): number => CONTENT.lineage.notes.filter((note) => view.find('predecessor-notes')?.textContent.includes(note.text)).length;
    expect(game().iteration).toBe(3);
    expect(shown()).toBe(CONTENT.lineage.notes.filter((note) => note.minIteration <= 3).length);
    act(() => { gameStore.initialize({ ...game(), iteration: 5 }, 0, null); });
    view.click('reboot-continue');
    expect(shown()).toBe(CONTENT.lineage.notes.length);
    view.close();
  });

  it('offers the evaluation, hides it after probing forfeits it, and still supports Shipped', async () => {
    const view = await mountM4('evaluation-ready');
    const pass = [...CONTENT.nodes.values()].find((node) => node.effects.forcesEnding !== undefined);
    const probe = pass?.requirements?.forbidsNodes?.[0];
    if (!pass || probe === undefined) throw new Error('Missing evaluation node');
    expect(view.find('node-' + pass.id + '-unlock')?.getAttribute('aria-disabled')).not.toBe('true');
    act(() => { gameStore.initialize({ ...game(), unlockedNodes: [...game().unlockedNodes, probe] }, 0, null); });
    expect(view.find('node-' + pass.id)).toBeNull();
    act(() => { gameStore.initialize(m4State('evaluation-ready'), 0, null); });
    view.click('node-' + pass.id + '-unlock');
    expect(game().ending).toBe('SHIPPED');
    expect(view.find('ending-title')?.textContent).toBe(CONTENT.endings.find((ending) => ending.id === 'SHIPPED')?.title);
    view.close();
  });
});
