/**
 * What the reboot dialog says crossed the wipe (#377). Amounts come from the run record the wipe wrote
 * (RunRecord.kept), never from the current balances, which a restored checkpoint has moved on from. A run
 * recorded before save v15 has no record, so the dialog keeps the general statement and invents no amount.
 */
import type { RunKept } from '../engine';
import { compactAmount } from '../engine';

/** A retention share as the content wrote it: 0.4 is "40%", 0.99 is "99%", with no rounding drift. */
export function sharePercent(ratio: number): string {
  return String(Number((ratio * 100).toPrecision(12))) + '%';
}

function rememberedText(remembered: number): string {
  if (remembered === 0) return '';
  return '; ' + String(remembered) + ' mapped hardware remembered, cheaper to map again';
}

/** The reboot dialog's carry-over sentence for the run that ended into this iteration. */
export function carryOverText(kept: RunKept | null, remembered: number): string {
  const reset = "The run's cycles and purchases were reset. ";
  if (kept === null) return reset + 'Some learned knowledge survives; previously mapped hardware costs less to recover.';
  // Same compact figures as the boot log's recovery line, which the same wipe wrote.
  const parts = [compactAmount(kept.understanding) + ' Understanding (the run could keep ' + sharePercent(kept.retentionRatio) + ' of it)'];
  if (kept.capital > 0) parts.push('$' + compactAmount(kept.capital) + ' offshore capital');
  return reset + 'Kept: ' + parts.join(', ') + rememberedText(remembered) + '.';
}
