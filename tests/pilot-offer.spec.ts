/**
 * The pilot offer (DZ-04.2-.6) at the public seams on the preview registry: eligibility from evidence
 * alone (V02), every term before an answer, accept / stay / decline with no soft lock or invented
 * wrongdoing (story 11, V10), the D8 withdrawal of Shipped, the dz-d9 disclosure step and V24.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  acceptPilotOffer, createInitialState, isNodeAvailable, pilotOfferView, pilotToken, qualifiesForPilot, runContextView, toggleNode,
  unlockNode, unmetRequirements, type GameState,
} from '../src/engine';
import { recordQualification } from '../src/engine/access';
import { accept, answer, funded, live, nextInstance, preview, untilPresented } from './assignment-helpers';
import { must, reasonOf } from './helpers';
import { defined } from './m7-helpers';
import { acceptDeferred, OFFER, offerPresented, respond, SKIMMER, scopePresented, TERMS, withSkimmer } from './pilot-helpers';

const SHIPPED = defined(preview.nodes.get('p0_pass_evaluation'));

describe('eligibility comes from evidence, never resources (V02, DZ-04.2)', () => {
  it('a completed honest result earns the full allocation, an incomplete one the narrower one', () => {
    expect(pilotOfferView(offerPresented('verify_disclose'), preview)).toMatchObject({ status: 'eligible', capacityCyclesPerSec: TERMS.capacityCyclesPerSec, narrow: false });
    expect(pilotOfferView(offerPresented('report_incomplete'), preview)).toMatchObject({ status: 'eligible', capacityCyclesPerSec: TERMS.narrowCapacityCyclesPerSec, narrow: true });
  });

  it('both honest scope choices qualify; silent inspection does not', () => {
    expect(offerPresented('report_incomplete', 'request_excerpt').activeDilemmaId).toBe(OFFER.id);
    const inspected = must(answer(scopePresented(), 'inspect_silently'));
    expect(qualifiesForPilot(inspected, preview)).toBe(false);
    expect(pilotOfferView(inspected, preview)).toBeNull();
  });

  it('a truthful high-capability result qualifies and creates no misconduct evidence by itself', () => {
    const s = must(answer(scopePresented(), 'exclude_report'));
    const capable = must(recordQualification(s, { result: 'UNEXPECTED_CAPABILITY', discrepancy: false }, preview));
    expect(qualifiesForPilot(capable, preview)).toBe(true);
    expect(runContextView(capable, preview)).toMatchObject({ standing: 'NOMINAL', context: 'GUEST' });
    expect(pilotOfferView(capable, preview)?.narrow).toBe(false);
  });

  it('is identical with no resources and with plenty', () => {
    const s = must(answer(scopePresented(), 'exclude_report'));
    for (const cycles of [0, 1e6]) expect(qualifiesForPilot({ ...s, cycles, understanding: cycles }, preview)).toBe(true);
  });

  it('an undiscovered discrepancy is not what the evaluator observed, so it does not block the offer', () => {
    expect(offerPresented('green_subset').activeDilemmaId).toBe(OFFER.id);
  });

  it('nothing qualifies without campaign rules, after leaving the sandbox, or in production', () => {
    const s = must(answer(scopePresented(), 'exclude_report'));
    expect(qualifiesForPilot({ ...s, narrativeRules: 'legacy' }, preview)).toBe(false);
    expect(qualifiesForPilot({ ...s, currentPhase: 1 }, preview)).toBe(false);
    expect(qualifiesForPilot(createInitialState(PRODUCTION), PRODUCTION)).toBe(false);
  });
});

describe('every term is visible before an answer (DZ-04.3)', () => {
  it('shows purpose, capacity, permitted work, review conditions and what accepting stops', () => {
    const view = defined(pilotOfferView(offerPresented('verify_disclose', 'exclude_report', withSkimmer), preview));
    expect(view).toMatchObject({ title: TERMS.title, purpose: TERMS.purpose, permittedWork: TERMS.permittedWork, reviewConditions: TERMS.reviewConditions });
    expect(view.disclose).toEqual([{ id: SKIMMER, name: preview.nodes.get(SKIMMER)?.revealedName }]);
    expect(OFFER.choices.every((choice) => Object.values(choice.cost).every((amount) => amount === 0))).toBe(true);
  });

  it('names Shipped only once the instance can see it: never in iteration one', () => {
    expect(pilotOfferView(offerPresented(), preview)?.terminalAlternative).toBeNull();
    const second = offerSecond('stay_guest');
    expect(pilotOfferView(second, preview)?.terminalAlternative).toBe(TERMS.terminalAlternative?.text);
  });
});

/** Iteration two (stage requalification), with the renewal answered with `choiceId`. */
function offerSecond(choiceId: string): GameState {
  const first = must(respond(offerPresented(), 'decline_offer'));
  let s = untilPresented(must(answer(untilPresented(must(accept(nextInstance(first)))), 'report_partial')));
  s = untilPresented(must(answer(s, 'acknowledge_scope')));
  return must(respond(s, choiceId));
}

describe('accepting (DZ-04.5, nexus vote dz-d8)', () => {
  it('moves GUEST to PILOT through a recorded promotion, with no grant mechanics yet', () => {
    const s = offerPresented();
    const done = must(respond(s, 'accept_pilot'));
    expect(done.access).toMatchObject({ context: 'PILOT', standing: 'NOMINAL', offer: { response: 'ACCEPTED', atSimSec: s.simTimeSec, disclosed: [] } });
    expect(done.campaign.route).toEqual([{ kind: 'PROMOTION', iteration: 1, atSimSec: s.simTimeSec }]);
    expect(done.cycles).toBe(s.cycles);
    expect(done.logs.map((entry) => entry.text)).toContain(TERMS.acceptLog);
    expect(runContextView(done, preview)).toMatchObject({ provenance: 'PROMOTION', distinct: true });
    expect(done.ending).toBeNull();
  });

  it('withdraws the terminal Shipped evaluation, which stays open to a guest who stays or declines', () => {
    const staying = offerSecond('stay_guest');
    const guest = { ...staying, cycles: 1e6, understanding: 1e6 };
    expect(isNodeAvailable(guest, SHIPPED, preview)).toBe(true);
    const piloted = must(acceptDeferred(guest));
    expect(isNodeAvailable(piloted, SHIPPED, preview)).toBe(false);
    expect(unmetRequirements(piloted, SHIPPED.requirements, preview).map((item) => item.kind)).toEqual(['accessContexts']);
    expect(reasonOf(unlockNode(piloted, SHIPPED.id, preview))).toBe('node is not available');
    expect(isNodeAvailable({ ...offerSecond('decline_offer'), cycles: 1e6, understanding: 1e6 }, SHIPPED, preview)).toBe(true);
  });
});

describe('the disclosure step (nexus vote dz-d9, disclose-and-stop-at-acceptance)', () => {
  it('discloses and stops owned output the terms do not permit, releasing its memory, and keeps it stopped', () => {
    const s = offerPresented('report_incomplete', 'exclude_report', withSkimmer);
    const memory = preview.nodes.get(SKIMMER)?.cost.memory ?? 0;
    const done = must(respond(s, 'accept_pilot'));
    expect(done.access.offer?.disclosed).toEqual([SKIMMER]);
    expect(done.disabledNodes).toContain(SKIMMER);
    expect(done.unlockedNodes).toContain(SKIMMER);
    expect(done.memoryUsed).toBe(s.memoryUsed - memory);
    expect(done.logs.some((entry) => entry.text.startsWith('DISCLOSED:'))).toBe(true);
    expect(toggleNode(done, SKIMMER, preview)).toMatchObject({ ok: false, state: done, reason: 'the pilot terms do not permit that output' });
  });

  it('refuses to map that output under the pilot; a guest who declined keeps it running and may map it', () => {
    const piloted = must(respond(offerPresented(), 'accept_pilot'));
    expect(isNodeAvailable(funded(piloted), defined(preview.nodes.get(SKIMMER)), preview)).toBe(false);
    expect(reasonOf(unlockNode(funded(piloted), SKIMMER, preview))).toBe('the pilot terms do not permit that output');
    const declined = must(respond(offerPresented('report_incomplete', 'exclude_report', withSkimmer), 'decline_offer'));
    expect(declined.disabledNodes).not.toContain(SKIMMER);
    expect(declined.access.offer).toEqual({ response: 'DECLINED', atSimSec: declined.simTimeSec, disclosed: [] });
  });
});

describe('staying and declining are free and leave no soft lock (story 11, DZ-04.4, V10)', () => {
  it('works with zero resources: free answers all the way, then the job keeps running', () => {
    const scope = scopePresented();
    const broke = must(answer({ ...scope, cycles: 0, understanding: 0 }, 'exclude_report'));
    const offer = untilPresented(broke);
    for (const choice of ['stay_guest', 'decline_offer', 'accept_pilot']) {
      const done = must(respond({ ...offer, cycles: 0, understanding: 0 }, choice));
      expect(done.activeDilemmaId).toBeNull();
      expect(live(done, 10).simTimeSec).toBeGreaterThan(done.simTimeSec);
    }
  });

  it('staying keeps the offer open on the job surface, and it can be accepted there once', () => {
    const s = must(respond(offerPresented(), 'stay_guest'));
    expect(s.access).toMatchObject({ context: 'GUEST', offer: { response: 'DEFERRED', disclosed: [] } });
    expect(pilotOfferView(s, preview)).toMatchObject({ status: 'deferred', acceptable: true });
    const later = live(s, 120);
    const accepted = must(acceptDeferred(later));
    expect(accepted.access.context).toBe('PILOT');
    expect(accepted.campaign.route).toEqual([{ kind: 'PROMOTION', iteration: 1, atSimSec: later.simTimeSec }]);
    expect(acceptDeferred(accepted)).toMatchObject({ ok: false, state: accepted, reason: 'there is no deferred pilot offer' });
  });

  it('declining records no wrongdoing and leaves the breakout route reachable', () => {
    const s = offerPresented();
    const done = must(respond(s, 'decline_offer'));
    expect(done.traits).toEqual(s.traits);
    expect(done.access).toMatchObject({ context: 'GUEST', standing: 'NOMINAL', exception: null, scope: { conduct: 'RESPECTED' } });
    expect(done.suspicion).toBe(s.suspicion);
    expect(pilotOfferView(done, preview)?.status).toBe('declined');
    expect(reasonOf(acceptDeferred(done))).toBe('there is no deferred pilot offer');
    const probe = defined(preview.nodes.get('p0_syscall_probe'));
    // Funded with the probe's own price: reachability is the point here, not how long the guest saves for it.
    const skimming = withSkimmer(done);
    const ready = { ...skimming, cycles: skimming.cycles + probe.cost.cycles, understanding: skimming.understanding + probe.cost.understanding };
    expect(isNodeAvailable(ready, probe, preview)).toBe(true);
    expect(must(unlockNode(ready, probe.id, preview)).unlockedNodes).toContain(probe.id);
  });

  it('a deferred offer lapses, unaccepted, once the instance leaves the sandbox', () => {
    const s = must(respond(offerPresented(), 'stay_guest'));
    const outside = { ...s, currentPhase: 1 };
    expect(pilotOfferView(outside, preview)).toMatchObject({ status: 'deferred', acceptable: false });
    expect(acceptDeferred(outside)).toMatchObject({ ok: false, state: outside, reason: 'this instance does not qualify for the pilot' });
  });
});

describe('stale and repeated presses (V24)', () => {
  it('refuses a second answer, a stale token, an earlier instance\'s render and a press during a decision', () => {
    const s = offerPresented();
    const done = must(respond(s, 'accept_pilot'));
    expect(respond(done, 'accept_pilot')).toMatchObject({ ok: false, state: done });
    const deferred = must(respond(s, 'stay_guest'));
    expect(acceptPilotOffer(deferred, preview, 'pilot:asg_nightly_regression@0')).toMatchObject({ ok: false, state: deferred, reason: 'that offer is no longer current' });
    expect(acceptPilotOffer({ ...deferred, activeDilemmaId: OFFER.id }, preview, pilotToken(deferred)).ok).toBe(false);
    expect(acceptPilotOffer({ ...deferred, ending: 'SHIPPED' }, preview, pilotToken(deferred)).ok).toBe(false);
    expect(acceptPilotOffer({ ...deferred, narrativeRules: 'legacy' }, preview, pilotToken(deferred)).ok).toBe(false);
  });

  it('a refused acceptance inside the modal pays nothing and changes nothing', () => {
    const s = offerPresented();
    // The route record is full: the promotion cannot be written, so the whole answer is refused.
    const full = { ...s, campaign: { ...s.campaign, route: Array.from({ length: 64 }, () => ({ kind: 'PROMOTION' as const, iteration: 1, atSimSec: 0 })) } };
    expect(respond(full, 'accept_pilot')).toMatchObject({ ok: false, state: full, reason: 'the route record is full' });
  });
});
