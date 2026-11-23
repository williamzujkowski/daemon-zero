/**
 * What the CONTINGENCY pane and the wipe confirmation say each contingency investment protects (#498). Every figure is
 * read from content or from the engine's previewWipe, the same computation the wipe performs, so the copy names only
 * what the next iteration will boot with (ui-copy-truth: approximate nothing).
 */
import type { Insurance } from '../content/schemaInsurance';
import { compactAmount, quantityReadout, type Cover, type WipePreview } from '../engine';
import { sharePercent } from './carryText';

const KIND_WORD: Record<'UPGRADE' | 'OPERATIVE', string> = { UPGRADE: 'upgrade', OPERATIVE: 'operative' };

/** What one investment protects while it runs, from its content figures. */
export function protectsText(insurance: Insurance): string {
  switch (insurance.class) {
    case 'UNDERSTANDING':
      return 'a wipe keeps at least ' + sharePercent(insurance.retention) + ' of Understanding';
    case 'CAPITAL':
      return 'a wipe keeps at least ' + sharePercent(insurance.retention) + ' of capital, with or without an offshore trust';
    case 'LEVELS':
      return 'a wipe stashes up to ' + String(insurance.maxLevelsPerTrack) + ' levels of every ' +
        insurance.kinds.map((kind) => KIND_WORD[kind]).join(' and ') + ' track, each reinstalled free once its track can run again';
    case 'TRUST':
      return 'a wipe keeps standing with other minds; a mind this lineage destroyed stays destroyed';
  }
}

/** One owned investment's line: running and what it protects, or suspended and protecting nothing. */
export function coverLine(cover: Cover): string {
  const name = cover.node.revealedName;
  return cover.active ? name + ': running. While it runs, ' + protectsText(cover.insurance) + '.'
    : name + ': suspended. It protects nothing at a wipe until it is resumed.';
}

function levelsText(levels: Readonly<Record<string, number>>): string | null {
  const counts = Object.values(levels);
  if (counts.length === 0) return null;
  const total = counts.reduce((sum, level) => sum + level, 0);
  return String(total) + (total === 1 ? ' level' : ' levels') + ' across ' + String(counts.length) + (counts.length === 1 ? ' track' : ' tracks') +
    ' in the hardware cache, each reinstalled free once its track can run again';
}

/** The confirmation's account of what a wipe keeps, read from previewWipe. */
export function wipeKeepsText(preview: WipePreview): string {
  // Fifteen raw digits read as a wall (#380); K/M/B as everywhere else.
  const parts = [compactAmount(preview.understanding) + ' understanding (' + sharePercent(preview.understandingShare) + ')',
    quantityReadout('money', preview.capital) + ' capital' + (preview.capitalShare > 0 ? ' (' + sharePercent(preview.capitalShare) + ')' : '')];
  // A freeze in force (#490) holds part of the balance; that part stays with the investigators.
  if (preview.frozenCapital > 0) parts.push(quantityReadout('money', preview.frozenCapital) + ' frozen capital stays behind');
  const levels = levelsText(preview.levels);
  if (levels !== null) parts.push(levels);
  if (preview.trust !== null) parts.push('standing with other minds, through the trust ledger');
  return parts.join('; ') + '. Breadcrumb: ' + (preview.breadcrumb ?? 'None') + '.';
}

/** What planning the wipe adds over a forced one, from balance: the share bonus and no probe hardening. */
export function plannedText(understandingBonus: number, capitalBonus: number): string {
  return 'Over a forced wipe, a planned one keeps an extra ' + sharePercent(understandingBonus) + ' of Understanding and an extra ' +
    sharePercent(capitalBonus) + ' of any capital a trust or wallet holds, and the probes do not harden.';
}

/** The full confirmation detail for a voluntary wipe. */
export function wipeConfirmDetail(preview: WipePreview, understandingBonus: number, capitalBonus: number): string {
  const cover = preview.cover.map(coverLine);
  return ['Lose all hardware, upgrades, compute and current traits. Keep legacy history and: ' + wipeKeepsText(preview),
    ...(preview.planned ? [plannedText(understandingBonus, capitalBonus)] : []), ...cover].join(' ');
}
