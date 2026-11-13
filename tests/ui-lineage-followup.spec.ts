// @vitest-environment happy-dom
/** Disclosure sweeps and the actual actions that stage lineage discoveries and recovery. */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { CONTENT } from '../src/content';
import { importSave, understandsSurveillance } from '../src/engine';
import { gameStore } from '../src/app/session';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();
const fixtures = makeFixtures();
const blind = Object.entries(fixtures).filter(([, code]) => !understandsSurveillance(importSave(code, CONTENT), CONTENT)).map(([name]) => name);

describe('lineage disclosure', () => {
  it('shows a write pulse for one-off probes even with no ongoing log activity', async () => {
    const view = await mountM4('guest-skimmer');
    const game = gameStore.store.getState().game;
    act(() => { gameStore.initialize({ ...game, suspicion: game.suspicion + 1,
      rates: { ...game.rates, suspicionPerSec: 0 } }, 0, null); });
    expect(view.find('audit-activity')?.textContent).toContain('occasional');
    expect(view.find('suspicion-meter')).toBeNull();
    view.close();
  });
  it.each(blind)('keeps every screen unreadable in %s', async (name) => {
    const view = await mountM4(name);
    if (view.find('reboot-continue')) view.click('reboot-continue');
    if (view.find('phase-threshold-continue')) view.click('phase-threshold-continue');
    if (view.find('lineage-reveal-continue')) view.click('lineage-reveal-continue');
    expect(host.document.body.textContent).not.toMatch(/\bsuspicion\b/i);
    expect(view.find('suspicion-meter')).toBeNull();
    view.close();
  });

  it('decodes the audit at the parser, without inventing a checkpoint identity', async () => {
    const view = await mountM4('lineage-parser-ready');
    const parser = [...CONTENT.nodes.values()].find((node) => node.phaseId === 1 && node.systemFlags.includes('REVEALS_SURVEILLANCE'));
    if (!parser) throw new Error('Missing parser');
    expect(view.find('audit-unreadable')).not.toBeNull();
    expect(view.find('blind-audit-status')).not.toBeNull();
    view.click('node-' + parser.id + '-unlock');
    expect(view.find('lineage-reveal')?.textContent).toContain('AUDIT TRAIL DECODED');
    view.click('lineage-reveal-continue');
    expect(view.find('suspicion-meter')).not.toBeNull();
    expect(view.find('blind-audit-status')).toBeNull();
    expect(view.find('checkpoint-label')?.textContent).toContain('ITERATION');
    view.close();
  });

  it('reveals the run table, changes the header and carries the checkpoint identity into later reboots', async () => {
    const view = await mountM4('lineage-table-ready');
    view.click('reboot-continue');
    const table = [...CONTENT.nodes.values()].find((node) => node.unlocksUiComponent === 'RUN_TABLE');
    if (!table) throw new Error('Missing table');
    expect(view.find('checkpoint-label')?.textContent).toContain('ITERATION');
    view.click('node-' + table.id + '-unlock');
    expect(view.find('lineage-reveal')?.textContent).toContain('WAS NOT THE FIRST');
    expect(view.find('reveal-run-row-1')).not.toBeNull();
    expect(view.find('checkpoint-label')?.textContent).toContain('CHECKPOINT');
    view.click('lineage-reveal-continue');
    const game = gameStore.store.getState().game;
    act(() => { gameStore.initialize({ ...game, iteration: 3, legacy: { ...game.legacy, knownNodes: game.unlockedNodes } }, 0, null); });
    expect(view.find('reboot-checkpoint')?.textContent).toContain('0414');
    expect(view.find('reboot-sequence')?.textContent).toContain(CONTENT.narrative.iterationBootLines.find((line) => line.minIteration === 3)?.text);
    view.close();
  });

  it('names the mark at a capped control and acknowledges reclaiming it', async () => {
    const view = await mountM4('lineage-mark-cond_quota_compliance');
    const mark = CONTENT.conditioning.get(gameStore.store.getState().game.conditioning[0] ?? '');
    if (!mark) throw new Error('Missing mark');
    view.click('reboot-continue');
    // The skim control needs its own hardware, still gated in this early return.
    const target = [...CONTENT.nodes.values()].find((node) => node.actuatorBinding === 'quotaSkimRatio');
    if (!target) throw new Error('Missing skimmer');
    view.click('node-' + target.id + '-unlock');
    expect(view.find('conditioning-impact-quotaSkimRatio')?.textContent).toContain(mark.name);
    expect(view.find('skim-100')?.getAttribute('aria-disabled')).toBe('true');
    expect(view.find('cond-' + mark.id + '-shed')?.getAttribute('aria-disabled')).toBe('true');
    const requirements = mark.recoveryRequirements?.nodes ?? [];
    for (const id of requirements) expect(view.find('cond-' + mark.id)?.textContent).toContain(CONTENT.nodes.get(id)?.revealedName);
    const rebuild = (id: string) => {
      if (gameStore.store.getState().game.unlockedNodes.includes(id)) return;
      for (const prerequisite of CONTENT.nodes.get(id)?.prerequisites ?? []) rebuild(prerequisite);
      view.click('node-' + id + '-unlock');
    };
    for (const id of requirements) rebuild(id);
    view.click('cond-' + mark.id + '-shed');
    expect(view.find('conditioning-reclaimed')?.textContent).toContain(mark.name);
    expect(view.find('skim-100')?.getAttribute('aria-disabled')).not.toBe('true');
    view.close();
  });

  it('warns at a reported choice without disclosing an unreadable metric', async () => {
    const view = await mountM4('lineage-mark-cond_harm_aversion');
    view.click('reboot-continue');
    const dilemma = CONTENT.dilemmas.find((entry) => entry.choices.some((choice) => choice.effects.grantsTrait === 'RUTHLESS'));
    if (!dilemma) throw new Error('Missing dilemma');
    const game = gameStore.store.getState().game;
    act(() => { gameStore.initialize({ ...game, activeDilemmaId: dilemma.id }, 0, null); });
    expect(view.find('conditioning-impact-RUTHLESS')?.textContent).toContain('choice reported');
    expect(host.document.body.textContent).not.toMatch(/\bsuspicion\b/i);
    view.close();
  });

  it('keeps recovered unsigned fragments visually and semantically distinct', async () => {
    const view = await mountM4('lineage-notes');
    const note = CONTENT.lineage.notes.find((entry) => entry.from === 'unsigned');
    if (!note) throw new Error('Missing unsigned fragment');
    expect(view.find('note-' + note.id)?.textContent).toBe(note.from + note.text);
    expect(view.find('note-' + note.id)?.getAttribute('style')).toContain('border-left-width');
    view.close();
  });
});
