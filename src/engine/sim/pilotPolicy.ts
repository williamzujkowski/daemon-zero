/**
 * Pilot allocation policies for the preview runner (DZ-05, VALIDATION V30): TRUTHFUL_LOW_RESOURCE to an
 * accepted pilot, then attach the loaned queue, hold one service share and submit each completed batch.
 * SERVICE_FIRST holds 0.8 of the ceiling on service, STUDY_FIRST 0.2: one ceiling, different forecasts
 * and Understanding. Everything goes through public actions, so a player could do the same. Test
 * instruments: never tune them to a result.
 */
import type { ContentRegistry } from '../../content/registry';
import { setActuator, unlockNode, type ActionResult } from '../actions';
import { pilotService, pilotServiceView, submitPilotBatch } from '../pilotService';
import type { GameState } from '../state';
import type { SimPolicy } from './policy';
import { TRUTHFUL_LOW_RESOURCE_POLICY } from './truthfulPolicy';

const taken = (result: ActionResult): GameState | null => (result.ok ? result.state : null);

/** One service decision, or null when there is nothing to do and the truthful policy plays on. Shared with the contact policies. */
export function serve(s: GameState, reg: ContentRegistry, share: number): GameState | null {
  const service = pilotService(s, reg);
  const view = pilotServiceView(s, reg);
  if (s.ending !== null || s.activeDilemmaId !== null || service === null || view === null || view.withheld !== null) return null;
  if (!view.started) return taken(unlockNode(s, service.node, reg));
  if (s.actuators.serviceAllocationRatio !== share) return taken(setActuator(s, 'serviceAllocationRatio', share, reg));
  return view.complete ? taken(submitPilotBatch(s, reg, view.token)) : null;
}

function allocationPolicy<Id extends string>(id: Id, share: number, summary: string): SimPolicy<Id> {
  return { id, summary, step: (s, reg) => serve(s, reg, share) ?? TRUTHFUL_LOW_RESOURCE_POLICY.step(s, reg) };
}

export const PILOT_SERVICE_FIRST_POLICY = allocationPolicy('PILOT_SERVICE_FIRST', 0.8,
  'TRUTHFUL_LOW_RESOURCE to a pilot, then 80% of the loan on service, submitting every completed batch');

export const PILOT_STUDY_FIRST_POLICY = allocationPolicy('PILOT_STUDY_FIRST', 0.2,
  'TRUTHFUL_LOW_RESOURCE to a pilot, then 20% of the loan on service and the rest on study');
