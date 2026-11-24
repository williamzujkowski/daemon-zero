/**
 * The finale stage (#542, architecture law 8): while a protocol is open, logs each story beat its progress reaches, once
 * per iteration, so the long final wait carries story instead of silence. It changes no rate. Offline catch-up writes
 * nothing; the first live tick tells whatever beats the time away reached, in order.
 */
import { dueFinaleBeats } from '../finale';
import { pushLog } from '../util';
import type { TickSystem } from './types';

export const announceFinaleBeats: TickSystem = (d, { reg, dormant }) => {
  if (dormant || d.ending !== null) return undefined;
  const due = dueFinaleBeats(d, reg);
  if (due.length === 0) return undefined;
  for (const beat of due) pushLog(d, reg, beat.text, 'LORE');
  d.announcedFinale = [...d.announcedFinale, ...due.map((beat) => beat.id)];
  return undefined;
};
