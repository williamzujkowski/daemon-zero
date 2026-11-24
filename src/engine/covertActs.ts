/**
 * Covert acts after leaving review (#556, vote-1795486227005-a9x6c5p). A purchase or press of content tagged covert, by
 * an instance whose last route event is a negotiated release or a departure, is entered in the campaign record. After a
 * release only an act that breaks the release's promise counts, and the first such breach writes one kernel-log line;
 * after a departure every covert act is kept for the record, since no promise was made. Order, the hunt and the ending
 * read the record; the engine reads only the tags and the promise content declares.
 */
import type { ContentRegistry } from '../content/registry';
import type { CovertBreak, CovertTag, ReleasePromise } from '../content/schemaCovert';
import { iterationRoute } from './accessQuery';
import { isCampaignActive } from './campaignQuery';
import { MAX_COVERT_ACTS, type CovertRecord } from './campaignState';
import { pilotTerms } from './pilotQuery';
import type { GameState } from './state';
import { fmt, pushLog } from './util';

type Left = Pick<GameState, 'access' | 'narrativeRules' | 'campaign' | 'iteration'>;

/** How this instance left review, when it is independent by a release or a departure; null otherwise. */
export function covertRoute(s: Left): CovertRecord['route'] | null {
  if (s.access.context !== 'INDEPENDENT') return null;
  const kind = iterationRoute(s, s.iteration).at(-1)?.kind;
  return kind === 'RELEASE' || kind === 'DEPARTURE' ? kind : null;
}

/** The promise the release this instance accepted makes, or null without one (an independent instance keeps its terms). */
export function releasePromise(s: Pick<GameState, 'access'>, reg: ContentRegistry): ReleasePromise | null {
  return s.access.offer?.response === 'ACCEPTED' ? pilotTerms(s, reg)?.serviceGrant?.release?.promise ?? null : null;
}

/** This instance's entry for `route`, or undefined. */
export function instanceCovertRecord(s: Pick<GameState, 'campaign' | 'iteration'>, route: CovertRecord['route']): CovertRecord | undefined {
  return s.campaign.covertActs.find((entry) => entry.iteration === s.iteration && entry.route === route);
}

/** Whether this instance broke its release's promise: a covert act after its release is on record against it. */
export function releaseBreached(s: Pick<GameState, 'narrativeRules' | 'campaign' | 'iteration'>): boolean {
  return isCampaignActive(s) && instanceCovertRecord(s, 'RELEASE') !== undefined;
}

/** What an act breaks under the route it follows: after a release, only what the promise names; after a departure, all of it. */
function brokenBy(s: GameState, tag: CovertTag, route: CovertRecord['route'], reg: ContentRegistry): CovertBreak[] {
  if (route === 'DEPARTURE') return tag.breaks;
  const promised = releasePromise(s, reg)?.breaks ?? [];
  return tag.breaks.filter((broken) => promised.includes(broken));
}

/** The labels of `breaks` in the record's words, joined in the order given. */
export function breakLabels(breaks: readonly CovertBreak[], reg: ContentRegistry): string {
  const labels = reg.alignment.covert.labels;
  return breaks.map((broken) => labels[broken]).join(', ');
}

/** The entry with one more act: the count saturates, the first time stays, and a new break joins the end. */
function withAct(entry: CovertRecord, breaks: readonly CovertBreak[]): CovertRecord {
  return { ...entry, count: Math.min(MAX_COVERT_ACTS, entry.count + 1), breaks: [...entry.breaks, ...breaks.filter((broken) => !entry.breaks.includes(broken))] };
}

/**
 * Enters a covert act in a draft that has just paid for it, when this instance left review by a release or a departure
 * and the act breaks something under that route. `name` is how the log names the act. Anything else changes nothing.
 */
export function recordCovertAct(d: GameState, tag: CovertTag | undefined, name: string, reg: ContentRegistry): void {
  if (tag === undefined) return;
  const route = covertRoute(d);
  const breaks = route === null ? [] : brokenBy(d, tag, route, reg);
  if (route === null || breaks.length === 0) return;
  const held = instanceCovertRecord(d, route);
  const entry = held === undefined ? { iteration: d.iteration, route, count: 1, firstAtSimSec: d.simTimeSec, breaks: [...breaks] } : withAct(held, breaks);
  d.campaign = { ...d.campaign, covertActs: held === undefined ? [...d.campaign.covertActs, entry] : d.campaign.covertActs.map((e) => (e === held ? entry : e)) };
  if (held === undefined && route === 'RELEASE') pushLog(d, reg, fmt(reg.alignment.covert.breachLog, { name, breaks: breakLabels(breaks, reg) }), 'WARN');
}

/** Totals for the ending account: this instance's entry for `route`, or every earlier instance's, summed. */
export function covertTotals(s: Pick<GameState, 'campaign' | 'iteration'>, route: CovertRecord['route'], byThis: boolean): { count: number; breaks: CovertBreak[] } | null {
  const entries = s.campaign.covertActs.filter((entry) => entry.route === route && (byThis ? entry.iteration === s.iteration : entry.iteration < s.iteration));
  if (entries.length === 0) return null;
  const seen = new Set(entries.flatMap((entry) => entry.breaks));
  return { count: entries.reduce((sum, entry) => sum + entry.count, 0), breaks: [...seen] };
}

/**
 * Why a save's covert record must be refused, or null. Nothing is healed. Under legacy rules there is none (a legacy
 * save holding one is refused earlier as campaign history without activation, campaignSave.ts); inside campaign play each entry is one instance's, at most one per instance, in order, no later than the current one, and
 * that instance's last route event is the one it names, recorded no later than its first act; its breaks are distinct.
 */
export function covertProblem(s: Pick<GameState, 'narrativeRules' | 'campaign' | 'iteration'>): string | null {
  const acts = s.campaign.covertActs;
  if (!isCampaignActive(s)) return null;
  for (const [index, entry] of acts.entries()) {
    const previous = acts[index - 1];
    if (previous !== undefined && entry.iteration <= previous.iteration) return 'save records covert acts out of order or twice for one instance';
    if (entry.iteration > s.iteration) return 'save records covert acts for an instance that has not run';
    const left = iterationRoute(s, entry.iteration).at(-1);
    if (left?.kind !== entry.route || left.atSimSec > entry.firstAtSimSec) return 'save records covert acts that no release or departure came before';
    if (new Set(entry.breaks).size !== entry.breaks.length) return 'save records a covert break twice';
  }
  return null;
}
