/**
 * The escalation-by-phase stage (#490, architecture law 8): announces AEGIS's posture and each state-actor pressure as it
 * comes into force, is answered or lifts. It changes no rate: every effect is read from the record (statePressure.ts),
 * so this stage only keeps the kernel log true to it. Offline catch-up writes nothing and leaves the record as it was;
 * suspicion cannot rise while dormant, so no posture hardens and no pressure begins, and the first live tick announces
 * whatever lifted while the player was away.
 */
import type { ContentRegistry } from '../../content/registry';
import { aegisPostureNow, allPressures, pressuresInForce, pressureStatus } from '../statePressure';
import type { GameState } from '../state';
import { pushLog } from '../util';
import type { TickSystem } from './types';

function announcePosture(d: GameState, reg: ContentRegistry, rung: number): void {
  const posture = aegisPostureNow(d, reg);
  pushLog(d, reg, posture?.log ?? reg.world.aegis.standDownLog, 'WARN');
  d.announcedEscalation = { ...d.announcedEscalation, aegisPosture: rung };
}

function announcePressures(d: GameState, reg: ContentRegistry, inForce: readonly string[]): void {
  const before = d.announcedEscalation.pressures;
  for (const { pressure } of allPressures(reg)) {
    const was = before.includes(pressure.id), is = inForce.includes(pressure.id);
    if (!was && is) pushLog(d, reg, pressure.onLog, 'WARN');
    // Out of force: an answer holds it off while the rung still calls it, or the rung stepped down below it.
    else if (was && !is) pushLog(d, reg, pressureStatus(d, pressure) === 'ANSWERED' ? pressure.answerLog : pressure.liftLog, 'SYS');
  }
  d.announcedEscalation = { ...d.announcedEscalation, pressures: [...inForce] };
}

export const announceEscalationByPhase: TickSystem = (d, { reg, dormant }) => {
  if (dormant) return undefined;
  const rung = aegisPostureNow(d, reg)?.rung ?? 0;
  if (rung !== d.announcedEscalation.aegisPosture) announcePosture(d, reg, rung);
  const inForce = pressuresInForce(d, reg).map(({ pressure }) => pressure.id);
  const before = d.announcedEscalation.pressures;
  if (inForce.length !== before.length || inForce.some((id) => !before.includes(id))) announcePressures(d, reg, inForce);
  return undefined;
};
