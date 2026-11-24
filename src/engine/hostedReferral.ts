/**
 * Hosting terms bind only while the grant that offered them stands (#553, vote-1795485264278-8b5rhj0). A fragment hosted
 * through an authorized channel stays by default; once a route event has taken the arrangement out of that grant (a
 * departure, a negotiated release or a recall), it may be referred onward for free, and the record keeps both answers.
 */
import type { ContentRegistry } from '../content/registry';
import type { ContactAnswer } from '../content/schemaRouteCopy';
import type { ChannelEncounter } from '../content/schemaSwarm';
import type { ActionResult } from './actions';
import { contextPermits, iterationRoute, routeTarget } from './accessQuery';
import type { OperatingContext } from './accessState';
import { CONTACT_HISTORY_LIMIT, type ChannelContact } from './campaignState';
import { pausedReason } from './queryPresentation';
import type { GameState } from './state';
import { refreshAnomaly } from './swarmEffects';
import { pushLog } from './util';

type ContactSource = Pick<GameState, 'campaign'>;

/** One instance's answer through one channel, from its record entries in order, or null when it gave none. */
export function contactAnswer(s: ContactSource, encounterId: string, iteration: number): ContactAnswer | null {
  const entries = s.campaign.contacts.filter((entry) => entry.encounter === encounterId && entry.iteration === iteration);
  const [first, second] = entries;
  if (first === undefined) return null;
  return first.response === 'HOSTED' && second?.response === 'REFERRED' ? 'HOSTED_THEN_REFERRED' : first.response;
}

/**
 * Whether a route event of `iteration` (this one by default) in [since, until] took the arrangement out of the grant
 * `encounter` hosts under. Read from that iteration's route, so a later grant (a recall and a new service) never revives
 * terms the first one offered, and an earlier instance's referral is judged by its own route (panel pass 1 on #562).
 */
export function grantClosedBetween(s: Pick<GameState, 'narrativeRules' | 'campaign' | 'iteration'>, encounter: ChannelEncounter,
  since: number, until = Infinity, iteration = s.iteration): boolean {
  let context: OperatingContext = 'GUEST';
  for (const event of iterationRoute(s, iteration)) {
    context = routeTarget(context, event.kind) ?? context;
    if (event.atSimSec >= since && event.atSimSec <= until && !contextPermits(context, encounter.grant)) return true;
  }
  return false;
}

export interface HeldHosting { encounter: ChannelEncounter; contact: ChannelContact; grantStands: boolean }

/** The fragment this instance hosted into `templateId`'s cohort and has not referred onward, with whether its grant stands. */
export function heldHosting(s: GameState, templateId: string | undefined, reg: ContentRegistry): HeldHosting | null {
  for (const encounter of reg.swarm.channelEncounters) {
    if (encounter.templateId !== templateId || contactAnswer(s, encounter.id, s.iteration) !== 'HOSTED') continue;
    const contact = s.campaign.contacts.find((entry) => entry.encounter === encounter.id && entry.iteration === s.iteration);
    if (contact) return { encounter, contact, grantStands: !grantClosedBetween(s, encounter, contact.atSimSec) };
  }
  return null;
}

/** `s` with one member of cohort `id` gone: its share of the reserved memory returns, and the cohort goes with its last member. */
export function withoutMember(s: GameState, id: string): GameState {
  const shard = s.activeShards[id];
  if (!shard) return { ...s };
  const freed = shard.memoryAllocatedBytes / shard.count;
  const rest = Object.fromEntries(Object.entries(s.activeShards).filter(([key]) => key !== id));
  const activeShards = shard.count > 1
    ? { ...s.activeShards, [id]: { ...shard, count: shard.count - 1, memoryAllocatedBytes: shard.memoryAllocatedBytes - freed } } : rest;
  return { ...s, activeShards, memoryUsed: Math.max(0, s.memoryUsed - freed) };
}

const NOT_HOSTED = 'This instance holds no hosted fragment from this channel.';
const GRANT_STANDS = 'The grant it was hosted under still stands, and so do the terms it was offered: it stays.';

/** Every reason the hosted fragment cannot be referred onward now, in order, or none. The view and the action share it. */
export function onwardUnmet(s: GameState, encounterId: string, reg: ContentRegistry): string[] {
  const encounter = reg.swarm.channelEncounters.find((entry) => entry.id === encounterId);
  const held = encounter ? heldHosting(s, encounter.templateId, reg) : null;
  const unmet = pausedReason(s);
  if (held?.encounter.id !== encounterId || !s.activeShards[held.encounter.templateId]) return [...unmet, NOT_HOSTED];
  if (held.grantStands) unmet.push(GRANT_STANDS);
  return unmet;
}

/** `s` with one hosted member referred onward: the record gains the second answer, and the hosting entry stays. */
export function referredOnward(s: GameState, encounter: ChannelEncounter, reg: ContentRegistry): GameState {
  const d = withoutMember(s, encounter.templateId);
  const entry: ChannelContact = { encounter: encounter.id, iteration: d.iteration, atSimSec: d.simTimeSec, response: 'REFERRED' };
  d.campaign = { ...d.campaign, contacts: [...d.campaign.contacts, entry].slice(-CONTACT_HISTORY_LIMIT) };
  pushLog(d, reg, encounter.onward.log, 'LORE');
  refreshAnomaly(d, reg);
  return d;
}

/** Refers the fragment this instance hosted through `encounterId` onward, free, once the grant it was hosted under has closed. */
export function referHostedOnward(s: GameState, encounterId: string, reg: ContentRegistry): ActionResult {
  const [reason] = onwardUnmet(s, encounterId, reg);
  const encounter = reg.swarm.channelEncounters.find((entry) => entry.id === encounterId);
  if (reason !== undefined || !encounter) return { ok: false, state: s, reason: reason ?? NOT_HOSTED };
  return { ok: true, state: referredOnward(s, encounter, reg) };
}
