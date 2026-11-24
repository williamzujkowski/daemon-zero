/**
 * The escalation-by-phase stage (#490, architecture law 8): announces AEGIS's posture and each state-actor pressure as it
 * comes into force, is answered or lifts. It changes no rate: every effect is read from the record (statePressure.ts),
 * so this stage only keeps the kernel log true to it. Offline catch-up writes nothing and leaves the record as it was;
 * suspicion cannot rise while dormant, so no posture hardens and no pressure begins, and the first live tick announces
 * whatever lifted while the player was away.
 */
import type { ContentRegistry } from '../../content/registry';
import { pressuresBind } from '../relevance';
import { aegisPostureNow, allPressures, pressuresInForce, pressureStatus, type ActorPressure } from '../statePressure';
import type { GameState } from '../state';
import { fmt, pushLog } from '../util';
import type { TickSystem } from './types';

function announcePosture(d: GameState, reg: ContentRegistry, rung: number): void {
  const posture = aegisPostureNow(d, reg);
  pushLog(d, reg, posture?.log ?? reg.world.aegis.standDownLog, 'WARN');
  d.announcedEscalation = { ...d.announcedEscalation, aegisPosture: rung };
}

/** Why a pressure left force: past the relevance threshold it still stands but no longer binds (#536), else answered or lifted. */
function outOfForceLog(d: GameState, reg: ContentRegistry, { actor, pressure }: ActorPressure, binding: boolean): string {
  const status = pressureStatus(d, pressure);
  if (!binding && status === 'IN_FORCE') return fmt(reg.world.relevance.unboundLog, { actor: actor.name });
  return status === 'ANSWERED' ? pressure.answerLog : pressure.liftLog;
}

function announcePressures(d: GameState, reg: ContentRegistry, inForce: readonly string[]): void {
  const before = d.announcedEscalation.pressures;
  const binding = pressuresBind(d, reg);
  for (const entry of allPressures(reg)) {
    const was = before.includes(entry.pressure.id), is = inForce.includes(entry.pressure.id);
    if (!was && is) pushLog(d, reg, entry.pressure.onLog, 'WARN');
    else if (was && !is) pushLog(d, reg, outOfForceLog(d, reg, entry, binding), 'SYS');
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
