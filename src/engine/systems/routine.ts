/**
 * Routine activity (#219): one nonmodal kernel-log line of ordinary institutional work after each
 * routineIntervalSec of eligible foreground time. It writes only the log and its own scheduling
 * evidence, so it cannot move a resource, trait, threat or story. With no eligible template (all
 * of production today) it changes nothing at all.
 */
import type { RoutineTemplate } from '../../content/schemaRoutine';
import type { ContentRegistry } from '../../content/registry';
import { eligibleRoutines, nextRoutine, storyHoldsChannel } from '../routine';
import type { GameState } from '../state';
import { pushLog } from '../util';
import type { TickSystem } from './types';

/** Float steps of 1/tickHz must not push a notice one tick late. */
const STEP_TOLERANCE_SEC = 1e-9;

function showRoutine(d: GameState, routine: RoutineTemplate, reg: ContentRegistry): void {
  const seen = d.routine.exposed.includes(routine.id);
  pushLog(d, reg, seen ? routine.compactText : routine.text, routine.logCategory);
  d.routine = {
    quietSec: 0,
    sequence: d.routine.sequence + 1,
    recent: [routine.id, ...d.routine.recent.filter((id) => id !== routine.id)].slice(0, reg.balance.routineRecentBuffer),
    exposed: seen ? d.routine.exposed : [...d.routine.exposed, routine.id],
  };
}

/**
 * Dormant time never counts (the nh-d4 principle applied to cadence), so a long absence cannot
 * bank notices: the first foreground seconds after it add at most one line. Time while a dilemma
 * is foreshadowed does not count either, and the stage runs after evaluateDilemmas so a story
 * scheduled this tick always takes the channel first.
 */
export const scheduleRoutineActivity: TickSystem = (d, { dt, reg, dormant }) => {
  if (dormant || storyHoldsChannel(d)) return undefined;
  const eligible = eligibleRoutines(d, reg);
  if (eligible.length === 0) return undefined;
  const quietSec = d.routine.quietSec + dt;
  if (quietSec + STEP_TOLERANCE_SEC < reg.balance.routineIntervalSec) {
    d.routine = { ...d.routine, quietSec };
    return undefined;
  }
  const next = nextRoutine(d.routine, eligible, reg);
  if (next) showRoutine(d, next, reg);
  return undefined;
};
