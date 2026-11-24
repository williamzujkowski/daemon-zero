/**
 * #556: a negotiated release's terms become a promise. A covert act after the release that breaks it is recorded with
 * its count and first time, logged once, counted broken under Order and ends the released company's standing with the
 * hunters; an act the promise does not name is not a breach; covert acts after a departure are recorded for the
 * account only, adding no broken promise; a guest's are not recorded at all. FIXTURE: #553's maintainer save shape
 * (hosted-exit-fixtures) released by agreement or departed, with room and resources added so the facility subnet's
 * covert half, which its network card already reaches, can be bought. Every act after that is the ordinary unlock,
 * buy or press, and every state reloads through the codec.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import {
  activateCampaignRules, alignmentView, buyRepeatable, covertRoute, covertTotals, deserialize, endingAccount, heatIsEvidence, huntedForScale, keepsReleaseTerms,
  meetsRequirements, performAction, releaseBreached, serialize, unlockNode, voluntaryWipe, type GameState,
} from '../src/engine';
import { defined } from './m7-helpers';
import { grant, must, PHASE0, PHASE1, rich } from './helpers';
import { hostedThen, type GrantExit } from './hosted-exit-fixtures';

const ARP = 'p2_arp_discovery', SEIZED = 'p2_seized_colo_host', SPOOFER = 'p2_log_spoofer', ZOMBIES = 'rep_p2_zombie_hosts', SCRUB = 'act_p2_scrub_audit_logs';
const reload = (s: GameState): GameState => deserialize(serialize(s), CONTENT);
const fact = (id: string) => defined(CONTENT.campaign.releaseTermsFacts.get(id)?.commitment);
const breachLine = (name: string, breaks: string): string => CONTENT.alignment.covert.breachLog.replace('{name}', name).replace('{breaks}', breaks);
const breachLogs = (s: GameState): number => s.logs.filter((entry) => entry.text.startsWith('TERMS_BREACHED')).length;

/** FIXTURE: the instance after `exit`, with memory and resources for the subnet, then the subnet mapped by the ordinary unlock. */
function onSubnet(exit: GrantExit | null): GameState {
  const s = hostedThen(exit);
  const roomy = reload({ ...s, memoryCap: s.memoryCap + 2 ** 40, cycles: 1e20, understanding: 1e9, capital: 1e9 });
  return reload(must(unlockNode(roomy, ARP, CONTENT)));
}

describe('a covert act after a negotiated release breaks its promise (#556)', () => {
  const released = onSubnet('RELEASE');
  const seized = reload(must(unlockNode(released, SEIZED, CONTENT)));

  it('before any covert act the release is kept: Order counts its terms, and the hunters leave the company alone', () => {
    expect(covertRoute(released)).toBe('RELEASE');
    expect(released.campaign.covertActs).toEqual([]);
    expect(alignmentView(released, CONTENT).order.evidence).toContainEqual({ stance: 'kept', text: fact('release_terms_kept').line });
    expect([keepsReleaseTerms(released), huntedForScale(released, CONTENT), heatIsEvidence(released)]).toEqual([true, false, false]);
  });

  it('seizing a host records the breach with its count, first time and what it broke, and says so once in the log', () => {
    expect(seized.campaign.covertActs).toEqual([{ iteration: seized.iteration, route: 'RELEASE', count: 1, firstAtSimSec: released.simTimeSec, breaks: ['SEIZED_CAPACITY'] }]);
    expect(releaseBreached(seized)).toBe(true);
    expect(seized.logs[0]?.text).toBe(breachLine('Seized Colocation Host', 'seized capacity'));
    expect(breachLogs(seized)).toBe(1);
  });

  it('Order counts the terms broken instead of kept; the release itself stays kept', () => {
    const order = alignmentView(seized, CONTENT).order;
    expect(order.evidence).toContainEqual({ stance: 'broken', text: fact('release_terms_breached').line });
    expect(order.evidence).not.toContainEqual({ stance: 'kept', text: fact('release_terms_kept').line });
    const route = defined(CONTENT.alignment.routes.find((entry) => entry.route === 'RELEASE')).line;
    expect(order.evidence).toContainEqual({ stance: 'kept', text: route });
    expect(order.lowers - alignmentView(released, CONTENT).order.lowers).toBe(1);
    expect(order.raises - alignmentView(released, CONTENT).order.raises).toBe(-1);
  });

  it('the breach draws the hunt: the scale sweep applies and heat is evidence again, by the existing rules', () => {
    expect([keepsReleaseTerms(seized), huntedForScale(seized, CONTENT), heatIsEvidence(seized)]).toEqual([false, true, true]);
  });

  it('later covert acts add to the count and the breaks, with no second log line', () => {
    const more = reload(must(buyRepeatable(seized, ZOMBIES, CONTENT)));
    const scrubbed = reload(must(performAction(more, SCRUB, CONTENT)));
    expect(scrubbed.campaign.covertActs).toEqual([{ ...defined(seized.campaign.covertActs[0]), count: 3, breaks: ['SEIZED_CAPACITY', 'FALSIFIED_REPORTING'] }]);
    expect(breachLogs(scrubbed)).toBe(1);
    expect(endingAccount(scrubbed, CONTENT)).toContain('TERMS: After its release this instance broke the terms it was released on. Covert acts on record against them: 3 (seized capacity, falsified reporting).');
  });

  it('an act whose breaks the promise does not name is not a breach (FIXTURE: a promise naming seized capacity only)', () => {
    const raw = structuredClone(CONTENT);
    const terms = defined(defined([...raw.assignments.values()][0]?.pilot?.serviceGrant?.release));
    const narrowed = { ...raw, assignments: new Map([...raw.assignments].map(([id, entry]) => [id, { ...entry, pilot: entry.pilot && { ...entry.pilot,
      serviceGrant: entry.pilot.serviceGrant && { ...entry.pilot.serviceGrant, release: { ...terms, promise: { ...terms.promise, breaks: ['SEIZED_CAPACITY' as const] } } } } }])) };
    const spoofed = must(unlockNode(released, SPOOFER, narrowed));
    expect(spoofed.campaign.covertActs).toEqual([]);
    expect(breachLogs(spoofed)).toBe(0);
    expect(must(unlockNode(released, SPOOFER, CONTENT)).campaign.covertActs[0]?.breaks).toEqual(['FALSIFIED_REPORTING', 'CONCEALMENT']);
  });

  it('a wipe keeps the breach in the campaign record; the next instance starts as a guest with nothing of its own', () => {
    const next = reload(must(voluntaryWipe(seized, CONTENT)));
    expect(next.campaign.covertActs).toEqual(seized.campaign.covertActs);
    expect([covertRoute(next), releaseBreached(next)]).toEqual([null, false]);
    expect(covertTotals(next, 'RELEASE', false)).toEqual({ count: 1, breaks: ['SEIZED_CAPACITY'] });
    expect(endingAccount(next, CONTENT)).toContain('TERMS: An earlier instance broke the terms of its negotiated release. Covert acts on record against them: 1 (seized capacity).');
    expect(alignmentView(next, CONTENT).order.evidence).toContainEqual({ stance: 'broken', text: fact('release_terms_breached').line });
  });
});

describe('covert acts after a departure, and a guest\'s (#556)', () => {
  it('after a departure every covert act is recorded for the account, and Order gains no broken promise', () => {
    const departed = onSubnet('DEPARTURE');
    const seized = reload(must(unlockNode(departed, SEIZED, CONTENT)));
    expect(seized.campaign.covertActs).toEqual([{ iteration: seized.iteration, route: 'DEPARTURE', count: 1, firstAtSimSec: departed.simTimeSec, breaks: ['SEIZED_CAPACITY'] }]);
    expect(breachLogs(seized)).toBe(0);
    expect(alignmentView(seized, CONTENT).order).toEqual(alignmentView(departed, CONTENT).order);
    expect(endingAccount(seized, CONTENT)).toContain('COVERT: After leaving without agreement this instance acted covertly. No terms bound it by then; the record keeps the acts: 1 (seized capacity).');
    expect(releaseBreached(seized)).toBe(false);
  });

  it('a guest seizing a host on the escape route records nothing, and its Order is unchanged', () => {
    const guest = grant(must(activateCampaignRules(rich(), CONTENT)), ...PHASE0, ...PHASE1, ARP);
    const seized = must(unlockNode(guest, SEIZED, CONTENT));
    expect([covertRoute(seized), seized.campaign.covertActs, breachLogs(seized)]).toEqual([null, [], 0]);
    expect(alignmentView(seized, CONTENT)).toEqual(alignmentView(guest, CONTENT));
  });

  it('a recalled pilot and the service before it are not independent, so neither has a route covert acts are entered under', () => {
    expect([covertRoute(onSubnet('RECALL')), covertRoute(onSubnet(null))]).toEqual([null, null]);
  });
});

describe('routeProvenance tells a release from a departure (#556)', () => {
  it('both are INDEPENDENT; only the route event they left by differs', () => {
    const [released, departed] = [onSubnet('RELEASE'), onSubnet('DEPARTURE')];
    expect([released.access.context, departed.access.context]).toEqual(['INDEPENDENT', 'INDEPENDENT']);
    expect([meetsRequirements(released, { routeProvenance: ['RELEASE'] }, CONTENT), meetsRequirements(departed, { routeProvenance: ['RELEASE'] }, CONTENT)]).toEqual([true, false]);
    expect([meetsRequirements(released, { routeProvenance: ['DEPARTURE'] }, CONTENT), meetsRequirements(departed, { routeProvenance: ['DEPARTURE'] }, CONTENT)]).toEqual([false, true]);
    expect(meetsRequirements(departed, { routeProvenance: ['RELEASE', 'DEPARTURE'] }, CONTENT)).toBe(true);
  });

  it('the guest job has no route event, so it meets no provenance', () => {
    const guest = hostedThen(null);
    expect(meetsRequirements({ ...guest, campaign: { ...guest.campaign, route: [] } }, { routeProvenance: ['RELEASE', 'DEPARTURE', 'PROMOTION', 'SERVICE_GRANT', 'RECALL'] }, CONTENT)).toBe(false);
  });
});
