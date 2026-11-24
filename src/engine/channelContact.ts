/**
 * First permitted contact (DZ-08, SPEC "A Voice on the Support Channel", nexus vote dz-d7
 * contact-by-channel): a population mind reaches this instance through a channel its arrangement
 * authorizes. The player refers it onward (free, no reward) or hosts it in stable memory it already
 * has; both answers complete the contact, reschedule the encounter clock like any resolution and are
 * recorded once in the campaign (nexus vote nh-d1). Hosting itself is the run-local cohort.
 */
import type { ContentRegistry } from '../content/registry';
import { CostSchema } from '../content/schema';
import type { ChannelEncounter, ShardTemplate } from '../content/schemaSwarm';
import { memoryExact } from './physicalUnits';
import type { ActionResult } from './actions';
import { contextPermits, isPermitted, routeTarget } from './accessQuery';
import type { OperatingContext } from './accessState';
import { isCampaignActive } from './campaignQuery';
import { CONTACT_HISTORY_LIMIT, type ChannelContact } from './campaignState';
import { freeMemory, meetsRequirements } from './query';
import { formatOutput, pausedReason, requirementLabels } from './queryPresentation';
import { bindCohort, cohortBlocker } from './shardActions';
import type { GameState } from './state';
import { outcomeMerge } from './logMerges';
import { pushLog } from './util';
import type { ContactAnswer } from '../content/schemaRouteCopy';
import { contactAnswer, grantClosedBetween, grantStoodAt, heldHosting, onwardUnmet } from './hostedReferral';

export type ContactMode = 'REFER' | 'HOST';

function refuse(s: GameState, reason: string): ActionResult {
  return { ok: false, state: s, reason };
}

/** The authorized-channel encounter an id names, or undefined (a wild encounter is not one). */
export function channelEncounter(reg: ContentRegistry, id: string | null): ChannelEncounter | undefined {
  return id === null ? undefined : reg.swarm.channelEncounters.find((entry) => entry.id === id);
}

function templateOf(reg: ContentRegistry, encounter: ChannelEncounter): ShardTemplate | undefined {
  return reg.swarm.playerSwarmTemplates.find((entry) => entry.id === encounter.templateId);
}

/** This instance's answered contact through one channel, if it gave one. */
export function iterationContact(s: Pick<GameState, 'campaign' | 'iteration'>, encounterId: string): ChannelContact | undefined {
  return s.campaign.contacts.find((entry) => entry.encounter === encounterId && entry.iteration === s.iteration);
}

/**
 * Whether the encounter clock may open this channel now: campaign rules, its requirements, the grant
 * it runs under currently permitted (a restricted or recall-pending service is sent no new contact),
 * and no contact answered here by this instance. Each instance meets at most one fragment per channel,
 * so referring cannot be repeated into a stream of contacts (DZ-08.4).
 */
export function channelEncounterEligible(s: GameState, encounter: ChannelEncounter, reg: ContentRegistry): boolean {
  return isCampaignActive(s) && meetsRequirements(s, encounter.requirements, reg) && isPermitted(s, encounter.grant)
    && iterationContact(s, encounter.id) === undefined;
}

/** Pass to resolveChannelContact: the contact as rendered, so a stale or repeated tap is refused. */
export function contactToken(s: Pick<GameState, 'iteration' | 'encounterSequenceIndex' | 'pendingWildEncounterId'>): string {
  return `${s.pendingWildEncounterId ?? 'none'}@${String(s.iteration)}#${String(s.encounterSequenceIndex)}`;
}

function memoryCost(template: ShardTemplate) {
  return CostSchema.parse({ memory: template.cost.memory });
}

/** Why hosting is refused now, in the player's terms; empty when it may go ahead. Referral never needs any of it. */
function hostBlockers(s: GameState, encounter: ChannelEncounter, template: ShardTemplate, reg: ContentRegistry): string[] {
  const out = [...pausedReason(s), ...requirementLabels(s, encounter.requirements, reg)];
  // A released instance (DZ-10) holds no grant at all, which is not the same as a standing withholding one.
  if (!isPermitted(s, encounter.grant)) out.push(contextPermits(s.access.context, encounter.grant)
    ? 'The current review standing withholds the permission hosting runs under. Referral is still open.'
    : 'This arrangement holds no grant for hosting to run under. Referral is still open.');
  const cohort = cohortBlocker(s, template);
  if (cohort !== null) out.push(cohort);
  const need = template.cost.memory, free = freeMemory(s);
  if (free < need) out.push(`Hosting needs ${memoryExact(need)} of free stable memory; ${memoryExact(Math.floor(free))} is free. Referral is still open.`);
  return out;
}

/** Draft-only: the answer is history, and the encounter clock restarts exactly as any resolution restarts it. */
function record(d: GameState, encounter: ChannelEncounter, response: ChannelContact['response'], reg: ContentRegistry): void {
  const entry: ChannelContact = { encounter: encounter.id, iteration: d.iteration, atSimSec: d.simTimeSec, response };
  d.campaign = { ...d.campaign, contacts: [...d.campaign.contacts, entry].slice(-CONTACT_HISTORY_LIMIT) };
  d.pendingWildEncounterId = null;
  d.nextEncounterAtSec = d.simTimeSec + reg.swarm.balance.encounterIntervalSec;
}

/**
 * Answers the pending channel contact as `shownAs` (its contactToken). REFER is free, pays nothing
 * and is always open while the contact is pending, even if the arrangement changed, so the contact
 * can always complete. HOST reserves the template's memory from what this instance already has,
 * under the encounter's grant; it is refused unchanged when that memory or permission is missing.
 */
export function resolveChannelContact(s: GameState, mode: ContactMode, reg: ContentRegistry, shownAs: string): ActionResult {
  if (s.ending !== null || s.activeDilemmaId !== null) return refuse(s, 'run is paused');
  const encounter = channelEncounter(reg, s.pendingWildEncounterId);
  if (!encounter || !isCampaignActive(s)) return refuse(s, 'no channel contact is waiting');
  if (shownAs !== contactToken(s)) return refuse(s, 'that contact is no longer current');
  const template = templateOf(reg, encounter);
  if (!template) return refuse(s, 'unknown template');
  if (mode === 'REFER') {
    const d = { ...s };
    pushLog(d, reg, encounter.referral.log, 'LORE', outcomeMerge(encounter));
    record(d, encounter, 'REFERRED', reg);
    return { ok: true, state: d };
  }
  const blocked = hostBlockers(s, encounter, template, reg);
  if (blocked.length > 0) return refuse(s, blocked.join(' '));
  const bound = bindCohort(s, template, memoryCost(template), reg);
  if (!bound.ok) return bound;
  pushLog(bound.state, reg, encounter.hosting.log, 'LORE', outcomeMerge(encounter));
  record(bound.state, encounter, 'HOSTED', reg);
  return bound;
}

export interface ChannelContactView {
  /** The contact waiting for an answer, with everything a player needs before choosing. */
  pending: {
    id: string; title: string; origin: string; signature: string; description: string;
    consent: string; obligations: readonly string[]; referral: string; hosting: string;
    /** The arrangement and standing the contact arrives under, and whether hosting's permission holds. */
    context: OperatingContext; standing: GameState['access']['standing']; permitted: boolean;
    memoryNeededMb: number; memoryFreeMb: number;
    /** What a hosted member of the population contributes, from its template. */
    output: string;
    hostEligible: boolean; hostUnmet: string[]; referEligible: boolean; token: string;
  } | null;
  /** How this instance answered, once it has; a fragment hosted and then referred onward reads both (#553). */
  answered: { title: string; response: ContactAnswer } | null;
  /** The cohort hosting reserved memory for, while this instance holds it. */
  hosted: { title: string; count: number; allocatedMb: number } | null;
  /**
   * Referring the hosted fragment onward (#553): offered only once the grant it was hosted under has closed, with the
   * channel's words on the broken promise and the reasons it waits (a pending decision), or null while hosting binds.
   */
  onward: { id: string; text: string; eligible: boolean; unmet: string[] } | null;
  /** The encounter's line about an earlier instance's contact here, or null. */
  earlier: string | null;
  /** The route note, shown once this instance has answered: what comes next and how to stop. */
  boundary: ChannelEncounter['boundary'] | null;
}

function pendingView(s: GameState, encounter: ChannelEncounter, template: ShardTemplate, reg: ContentRegistry): NonNullable<ChannelContactView['pending']> {
  const unmet = hostBlockers(s, encounter, template, reg);
  return {
    id: encounter.id, title: encounter.name, origin: encounter.origin, signature: encounter.signature,
    description: encounter.description, consent: encounter.consent, obligations: encounter.obligations,
    referral: encounter.referral.text, hosting: encounter.hosting.text,
    context: s.access.context, standing: s.access.standing, permitted: isPermitted(s, encounter.grant),
    memoryNeededMb: memoryCost(template).memory, memoryFreeMb: Math.floor(freeMemory(s)),
    output: formatOutput(template.tickDelta, template.epistemicDriftPerSec),
    hostEligible: unmet.length === 0, hostUnmet: unmet, referEligible: pausedReason(s).length === 0, token: contactToken(s),
  };
}

/** The channel this instance is meeting or met: the pending contact, or what it answered. */
function focus(s: GameState, reg: ContentRegistry): ChannelEncounter | undefined {
  return channelEncounter(reg, s.pendingWildEncounterId) ?? reg.swarm.channelEncounters.find((entry) => iterationContact(s, entry.id) !== undefined);
}

/** The contact surface's view, or null when this instance has no channel contact to show. */
export function channelContactView(s: GameState, reg: ContentRegistry): ChannelContactView | null {
  const encounter = isCampaignActive(s) ? focus(s, reg) : undefined;
  const template = encounter ? templateOf(reg, encounter) : undefined;
  if (!encounter || !template) return null;
  const answer = contactAnswer(s, encounter.id, s.iteration);
  const cohort = answer === 'HOSTED' ? s.activeShards[template.id] : undefined;
  const held = cohort ? heldHosting(s, template.id, reg) : null;
  const unmet = onwardUnmet(s, encounter.id, reg);
  const earlier = s.campaign.contacts.some((entry) => entry.encounter === encounter.id && entry.iteration < s.iteration);
  return {
    pending: answer ? null : pendingView(s, encounter, template, reg),
    answered: answer ? { title: encounter.name, response: answer } : null,
    hosted: cohort ? { title: template.name, count: cohort.count, allocatedMb: cohort.memoryAllocatedBytes } : null,
    onward: held?.grantStands === false ? { id: encounter.id, text: encounter.onward.text, eligible: unmet.length === 0, unmet } : null,
    earlier: earlier ? encounter.earlierContact : null,
    boundary: answer ? encounter.boundary : null,
  };
}

/** The arrangements this iteration's route visited, from the guest job on. */
function visitedContexts(s: GameState): OperatingContext[] {
  const out: OperatingContext[] = ['GUEST'];
  for (const event of s.campaign.route.filter((entry) => entry.iteration === s.iteration)) {
    const next = routeTarget(out.at(-1) ?? 'GUEST', event.kind);
    if (next !== null) out.push(next);
  }
  return out;
}

/**
 * Whether this iteration could have opened the channel (panel round 1 on #271): its route reached an
 * arrangement the channel admits, and everything else the channel requires (structural, access-scope
 * only by integrity) holds now. The arrangement is checked against the route, not the current context,
 * so a contact that opened before a recall or restriction still loads and can still be referred.
 */
function openedProblem(s: GameState, encounter: ChannelEncounter, reg: ContentRegistry): string | null {
  const { accessContexts: admitted, ...rest } = encounter.requirements;
  if (admitted && !visitedContexts(s).some((context) => admitted.includes(context))) return 'save holds a channel contact its route never reached';
  return meetsRequirements(s, rest, reg) ? null : 'save holds a channel contact whose channel it never opened';
}

/**
 * Every record's time against the save's clock, whichever iteration made it (panel round 2 on #271): an
 * earlier instance's contact happened before this iteration began, and this instance's happened inside
 * it. With the ordering check, a contact appended now (at simTimeSec) can never break either rule, so
 * what the loader admits stays loadable after an answer.
 */
function clockProblem(s: GameState, entry: ChannelContact): string | null {
  if (entry.iteration < s.iteration) return entry.atSimSec > s.iterationStartedAtSimSec ? 'save records an earlier contact after this iteration began' : null;
  return entry.atSimSec < s.iterationStartedAtSimSec || entry.atSimSec > s.simTimeSec ? 'save records a contact outside this iteration' : null;
}

/** A hosting this instance holds and has not referred onward needs the cohort it reserved (#553). */
function heldProblem(s: GameState, encounter: ChannelEncounter): string | null {
  const unheld = contactAnswer(s, encounter.id, s.iteration) === 'HOSTED' && (s.activeShards[encounter.templateId]?.count ?? 0) < 1;
  return unheld ? 'save records hosting this instance does not hold' : null;
}

/**
 * An onward referral, in any iteration, needs a route event of that same iteration that closed the grant between the
 * hosting and it (#553; panel pass 1 on #562: an earlier instance's referral is checked against its own route, which is
 * never trimmed, so a save cannot claim a closed grant that iteration never recorded).
 */
function onwardProblem(s: GameState, encounter: ChannelEncounter, entry: ChannelContact): string | null {
  const [first, second] = s.campaign.contacts.filter((other) => other.encounter === entry.encounter && other.iteration === entry.iteration);
  if (second !== entry || first?.response !== 'HOSTED' || entry.response !== 'REFERRED') return null;
  return grantClosedBetween(s, encounter, first.atSimSec, entry.atSimSec, entry.iteration)
    ? null : 'save records an onward referral while the grant it was hosted under still stood';
}

/** A hosting, in any iteration, is dated while the grant it runs under stood in that iteration's route (panel pass 2 on #562). */
function hostingProblem(s: GameState, encounter: ChannelEncounter, entry: ChannelContact): string | null {
  return entry.response !== 'HOSTED' || grantStoodAt(s, encounter, entry.atSimSec, entry.iteration)
    ? null : 'save records hosting dated outside the grant it was hosted under';
}

function entryProblem(s: GameState, entry: ChannelContact, reg: ContentRegistry): string | null {
  const encounter = channelEncounter(reg, entry.encounter);
  if (!encounter) return `save records a contact through an unknown channel "${entry.encounter}"`;
  if (entry.iteration < (s.campaign.activatedAtIteration ?? Infinity) || entry.iteration > s.iteration) return 'save records a contact outside campaign play';
  const problem = clockProblem(s, entry) ?? hostingProblem(s, encounter, entry) ?? onwardProblem(s, encounter, entry);
  if (problem !== null || entry.iteration !== s.iteration) return problem;
  const opened = openedProblem(s, encounter, reg);
  if (opened !== null) return opened;
  return iterationContact(s, encounter.id) === entry ? heldProblem(s, encounter) : null;
}

/** At most one answer per channel per instance, or a hosting followed by its one onward referral (#553). */
function answersProblem(contacts: readonly ChannelContact[]): string | null {
  const byKey = new Map<string, ChannelContact['response'][]>();
  for (const entry of contacts) {
    const key = `${entry.encounter}@${String(entry.iteration)}`;
    byKey.set(key, [...(byKey.get(key) ?? []), entry.response]);
  }
  const allowed = [...byKey.values()].every((answers) => answers.length === 1 || (answers.length === 2 && answers[0] === 'HOSTED' && answers[1] === 'REFERRED'));
  return allowed ? null : 'save records two contacts through one channel in one iteration';
}

/**
 * Why a save's channel contacts must be refused, or null. Nothing is healed: under legacy rules no
 * contact or channel encounter exists; every contact names a known channel inside campaign play and
 * in order, at most once per channel per instance or a hosting then one onward referral (#553); this
 * instance's contact, answered or pending, needs a channel this iteration could have opened and, if hosted
 * and not referred onward, the cohort it reserved; and an answered channel cannot be pending again.
 */
export function contactProblem(s: GameState, reg: ContentRegistry): string | null {
  const pending = channelEncounter(reg, s.pendingWildEncounterId);
  if (!isCampaignActive(s)) return s.campaign.contacts.length > 0 || pending ? 'save holds a channel contact outside campaign rules' : null;
  const answers = answersProblem(s.campaign.contacts);
  if (answers !== null) return answers;
  const ordered = s.campaign.contacts.every((entry, index, all) => {
    const previous = all[index - 1];
    return !previous || (entry.iteration >= previous.iteration && entry.atSimSec >= previous.atSimSec);
  });
  if (!ordered) return 'save records contacts out of order';
  for (const entry of s.campaign.contacts) {
    const problem = entryProblem(s, entry, reg);
    if (problem !== null) return problem;
  }
  if (!pending) return null;
  if (iterationContact(s, pending.id)) return 'save holds a channel contact this instance already answered';
  return openedProblem(s, pending, reg);
}
