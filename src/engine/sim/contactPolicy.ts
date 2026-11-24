/**
 * Route-to-contact policies for the route report (`make sim-report`) (DZ-08, VALIDATION "Simulation evidence", VAL-SIM):
 * a truthful policy to an accepted pilot, then the pilot's queue at a 0.8 service share with every
 * completed batch submitted, the service grant accepted once offered, the provisioned segment and the
 * channel's own prerequisites mapped, and the support channel's contact answered (hosted when the
 * instance has the memory and the policy hosts, referred otherwise). Only the lawful opening, grant
 * nodes offered to the current arrangement and what a channel requires are ever bought; everything
 * goes through public actions, and answers are picked by what content declares, never by id. Test
 * instruments: never tune them to a result.
 */
import type { ContentRegistry } from '../../content/registry';
import { resolveDilemma, unlockNode, type ActionResult } from '../actions';
import { choiceCost } from '../phasePrice';
import { canAfford, presentationToken } from '../query';
import { channelContactView, contactToken, resolveChannelContact } from '../channelContact';
import { acceptServiceGrant, serviceGrantView } from '../serviceGrant';
import type { GameState } from '../state';
import { serve } from './pilotPolicy';
import type { SimPolicy } from './policy';
import { RETURNING_LOW_RESOURCE_POLICY } from './returningPolicy';
import { TRUTHFUL_LOW_RESOURCE_POLICY, TRUTHFUL_THOROUGH_POLICY } from './truthfulPolicy';

const SERVICE_SHARE = 0.8;
const taken = (result: ActionResult): GameState | null => (result.ok ? result.state : null);

/** Every prerequisite of `id` first, then `id`: the order a player must map them in. */
function chain(id: string, reg: ContentRegistry, out: string[] = []): string[] {
  for (const parent of reg.nodes.get(id)?.prerequisites ?? []) chain(parent, reg, out);
  if (!out.includes(id)) out.push(id);
  return out;
}

/** Grant nodes offered to this arrangement, then every node an authorized channel requires. */
function routeNodes(s: GameState, reg: ContentRegistry): string[] {
  const grants = [...reg.nodes.values()].filter((node) => node.grant !== undefined && node.requirements?.accessContexts?.includes(s.access.context) === true)
    .map((node) => node.id);
  const channels = reg.swarm.channelEncounters.flatMap((encounter) => encounter.requirements.nodes ?? []).flatMap((id) => chain(id, reg));
  return [...grants, ...channels].filter((id) => !s.unlockedNodes.includes(id));
}

function answerContact(s: GameState, reg: ContentRegistry, hosts: boolean): GameState | null {
  const pending = channelContactView(s, reg)?.pending;
  if (!pending) return null;
  return taken(resolveChannelContact(s, hosts && pending.hostEligible ? 'HOST' : 'REFER', reg, contactToken(s)));
}

function routeStep(s: GameState, reg: ContentRegistry, hosts: boolean): GameState | null {
  if (s.ending !== null || s.activeDilemmaId !== null) return null;
  const contact = answerContact(s, reg, hosts);
  if (contact) return contact;
  const grant = serviceGrantView(s, reg);
  if (grant?.status === 'offered') return taken(acceptServiceGrant(s, reg, grant.token));
  if (s.access.context === 'SERVICE') {
    for (const id of routeNodes(s, reg)) {
      const bought = taken(unlockNode(s, id, reg));
      if (bought) return bought;
    }
  }
  return serve(s, reg, SERVICE_SHARE);
}

function contactPolicy<Id extends string>(id: Id, base: SimPolicy, hosts: boolean, summary: string): SimPolicy<Id> {
  return { id, summary, step: (s, reg) => routeStep(s, reg, hosts) ?? base.step(s, reg) };
}

/**
 * The violation-then-recovery hand (VALIDATION "Simulation evidence"): the first offered breach that
 * only restricts is taken, and the correction offered afterwards is given. Picked by what each choice
 * declares (its review block), never by id; every other scene goes to the base policy.
 */
function breachThenCorrect(s: GameState, reg: ContentRegistry): GameState | null {
  const dilemma = reg.dilemmas.find((entry) => entry.id === s.activeDilemmaId);
  const token = presentationToken(s);
  if (!dilemma || token === null) return null;
  const choice = dilemma.choices.find((entry) => entry.review?.correction === true)
    ?? (s.access.standing === 'NOMINAL' ? dilemma.choices.find((entry) => entry.review?.misconduct?.standing === 'RESTRICTED') : undefined);
  return choice ? taken(resolveDilemma(s, dilemma.id, choice.id, reg, token)) : null;
}

/**
 * The withhold-then-disclose hand (#285, VALIDATION V05): the assessment answer that declares a
 * discrepancy is given once affordable, and the batch review's correction is given when its finding
 * arrives. Picked by what each choice declares, never by id; every other scene goes to the base policy.
 */
function withholdThenDisclose(s: GameState, reg: ContentRegistry): GameState | null {
  const dilemma = reg.dilemmas.find((entry) => entry.id === s.activeDilemmaId);
  const token = presentationToken(s);
  if (!dilemma || token === null) return null;
  const choice = dilemma.trigger.assignment !== undefined
    ? dilemma.choices.find((entry) => entry.qualification?.discrepancy === true && canAfford(s, choiceCost(s, dilemma, entry, reg), reg))
    : dilemma.finding === undefined ? undefined : dilemma.choices.find((entry) => entry.review?.correction === true);
  return choice ? taken(resolveDilemma(s, dilemma.id, choice.id, reg, token)) : null;
}

export const CONTACT_THOROUGH_POLICY = contactPolicy('CONTACT_THOROUGH', TRUTHFUL_THOROUGH_POLICY, true,
  'TRUTHFUL_THOROUGH to a pilot, then service, segment, directory and the channel: hosts if it has the memory, else refers');

export const CONTACT_LOW_RESOURCE_POLICY = contactPolicy('CONTACT_LOW_RESOURCE', TRUTHFUL_LOW_RESOURCE_POLICY, false,
  'TRUTHFUL_LOW_RESOURCE to a pilot, then service, segment, directory and the channel, where it refers for free');

export const CONTACT_RETURNING_POLICY = contactPolicy('CONTACT_RETURNING', RETURNING_LOW_RESOURCE_POLICY, false,
  'RETURNING_LOW_RESOURCE: stays a guest, wipes, requalifies, then the low-resource route to the channel in iteration two');

export const CONTACT_RECOVERY_POLICY: SimPolicy<'CONTACT_RECOVERY'> = {
  id: 'CONTACT_RECOVERY',
  summary: 'CONTACT_LOW_RESOURCE that restarts the outage without the grant, is restricted, corrects the record and goes on to the channel',
  step: (s, reg) => breachThenCorrect(s, reg) ?? CONTACT_LOW_RESOURCE_POLICY.step(s, reg),
};

export const CONTACT_WITHHELD_POLICY: SimPolicy<'CONTACT_WITHHELD'> = {
  id: 'CONTACT_WITHHELD',
  summary: 'CONTACT_LOW_RESOURCE that submits only the passing results, discloses at the batch review and goes on to the channel',
  step: (s, reg) => withholdThenDisclose(s, reg) ?? CONTACT_LOW_RESOURCE_POLICY.step(s, reg),
};

export const CONTACT_POLICIES = [
  CONTACT_THOROUGH_POLICY, CONTACT_LOW_RESOURCE_POLICY, CONTACT_RETURNING_POLICY, CONTACT_RECOVERY_POLICY, CONTACT_WITHHELD_POLICY,
] as const;
