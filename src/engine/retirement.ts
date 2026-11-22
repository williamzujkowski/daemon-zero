/**
 * The one kernel-log line that marks windows retiring (vote-1795366695204-4nslts1). Retirement itself is the
 * retiredWidgets query; this writes the line in the transition that crossed the gate, so it is written once and a
 * reload, which runs no transition, never writes it again.
 */
import type { ContentRegistry } from '../content/registry';
import { retiredWidgets } from './query';
import type { GameState } from './state';
import { fmt, pushLog } from './util';

/** Logs the windows `d` retires that `before` had not, in one line. Integrity keeps the gates to purchases. */
export function logRetirements(before: GameState, d: GameState, reg: ContentRegistry): void {
  const was = new Set(retiredWidgets(before, reg));
  const titles = retiredWidgets(d, reg).filter((id) => !was.has(id)).map((id) => reg.widgets.get(id)?.title ?? id);
  if (titles.length > 0) pushLog(d, reg, fmt(reg.narrative.widgetsRetired, { titles: titles.join(', ') }), 'SYS');
}
