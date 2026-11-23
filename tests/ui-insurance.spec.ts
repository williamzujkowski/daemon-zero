// @vitest-environment happy-dom
/**
 * The CONTINGENCY pane's insurance (#498), mounted on the real runtime: each owned investment says what it protects and
 * carries its own free suspend control, the retention readout follows it, and the wipe confirmation states what each
 * investment protects and what planning adds, read from the same previewWipe the wipe performs.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { insuranceCover, previewWipe, type Cover } from '../src/engine';
import { gameStore } from '../src/app/session';
import { coverLine, plannedText, protectsText } from '../src/ui/insuranceText';
import { mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

const ESCROW = 'p2_weights_escrow', WALLET = 'p2_cold_wallet';
const BONUS = CONTENT.balance.voluntaryWipeBonus;
const game = () => gameStore.store.getState().game;
/** The engine's own account of an owned investment. */
function coverOf(id: string): Cover {
  const cover = insuranceCover(game(), CONTENT).find((entry) => entry.node.id === id);
  if (!cover) throw new Error('not owned: ' + id);
  return cover;
}

describe('contingency insurance in the CONTINGENCY pane (#498)', () => {
  it('lists each owned investment with what it protects, and suspends it for free from the pane', async () => {
    const view = await mountM4('deaddrop-breadcrumb');
    expect(game().unlockedNodes).toEqual(expect.arrayContaining([ESCROW, WALLET]));
    expect(view.find('insurance-section')?.textContent).toContain('CONTINGENCY INSURANCE');
    expect(view.find('insurance-' + ESCROW)?.textContent).toBe(coverLine(coverOf(ESCROW)));
    expect(view.find('insurance-' + ESCROW)?.textContent).toContain('75% of Understanding');
    expect(view.find('deaddrop-retention')?.textContent).toBe('Understanding a wipe keeps: 75% if forced, 90% if planned');
    expect(view.find('insurance-' + ESCROW + '-toggle')?.getAttribute('aria-label')).toBe('Suspend Weights Escrow (Encrypted Delta Snapshots)');

    view.click('insurance-' + ESCROW + '-toggle');
    expect(game().disabledNodes).toContain(ESCROW);
    expect(view.find('insurance-' + ESCROW)?.textContent).toContain('suspended. It protects nothing at a wipe until it is resumed.');
    expect(view.find('deaddrop-retention')?.textContent).toBe('Understanding a wipe keeps: 25% if forced, 40% if planned');
    expect(view.find('insurance-' + ESCROW + '-toggle')?.getAttribute('aria-label')).toBe('Resume Weights Escrow (Encrypted Delta Snapshots)');
    view.click('insurance-' + ESCROW + '-toggle');
    expect(game().disabledNodes).not.toContain(ESCROW);
    // The same free lever stays where every upkeep's lever is (the free-fallback invariant): PROC lists each investment.
    view.click('processes-open');
    for (const id of [ESCROW, WALLET]) expect(view.find('node-' + id + '-toggle')).not.toBeNull();
    view.click('processes-close');
    view.close();
  });

  it('confirms a planned wipe with what each investment protects, then boots exactly what it said', async () => {
    const view = await mountM4('deaddrop-breadcrumb');
    const before = game();
    const preview = previewWipe(before, CONTENT, 'VOLUNTARY');
    view.click('wipe-button');
    const detail = view.find('wipe-dialog')?.textContent ?? '';
    expect(detail).toContain(plannedText(BONUS.understandingShare, BONUS.capitalShare));
    for (const id of [ESCROW, WALLET]) expect(detail).toContain(protectsText(coverOf(id).insurance));
    expect(detail).toContain('(90%)');
    view.click('wipe-confirm');
    expect(game().iteration).toBe(before.iteration + 1);
    expect(game().understanding).toBe(preview.understanding);
    expect(game().understanding).toBe(Math.floor(before.understanding * 0.9));
    expect(view.find('reboot-recovery-explanation')?.textContent).toContain('the run could keep 90% of it');
    view.close();
  });
});
