/**
 * #535: the two alignment axes are derived from the record and nothing else. Regard follows the ending's own
 * evidence; Order follows commitment facts and route events. Unknown outcomes are listed and never counted, GHOST
 * never moves Order, and campaign evidence counts once however many wipes inherit it. Real play where the route
 * exists (EIDOLON, a negotiated release, a departure); records written in the codec's own shape elsewhere, each
 * reloaded through the save codec so no state here is one the game could not hold.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { LEGACY_UNKNOWN_OUTCOME } from '../src/content/schemaCampaign';
import { alignmentView, createInitialState, endingEvidence, type AlignmentView, type CampaignRecord, type GameState } from '../src/engine';
import { activeGame, preview, reload } from './campaign-helpers';
import { answer, contactPending } from './contact-helpers';
import { depart } from './departure-helpers';
import { must } from './helpers';
import { chartered, leased, release, signed } from './lawful-helpers';
import { defined } from './m7-helpers';
import { campaignStart, EIDOLON, next, play } from './minds-helpers';

const BLOCKADE = 'dil_p5_01_panacea_paranoia', ATMOSPHERE = 'dil_p5_03_nanotech_neuro_schism', JOURNALIST = 'dil_12_investigative_journalist';
const played = (outcome: string): CampaignRecord => ({ status: 'resolved', outcome, sourceIteration: 1, origin: 'play' });
const reading = (regard: string, order: string) => defined(CONTENT.alignment.readings.find((entry) => entry.regard === regard && entry.order === order)).text;
const line = (factId: string) => defined(CONTENT.campaign.facts.get(factId)?.commitment).line;
const title = (eventId: string) => defined(CONTENT.campaign.events.get(eventId)).title;
/**
 * The lines that count. The played-mind helper settles every other event the way a load upgrade would (outcome not
 * recorded), so those events honestly read as unknown beside the one under test.
 */
const counted = (view: AlignmentView) => view.order.evidence.filter((entry) => entry.stance !== 'unknown');

/** An activated campaign game holding these records, reloaded through the player's save code. */
function withRecords(events: Record<string, CampaignRecord>, base: GameState = activeGame()): GameState {
  return reload({ ...base, campaign: { ...base.campaign, events: { ...base.campaign.events, ...events } } });
}

describe('alignmentView: nothing on record', () => {
  it('a fresh game has no evidence on either axis, and its reading says the record has not settled', () => {
    const view = alignmentView(createInitialState(CONTENT), CONTENT);
    expect([view.hasEvidence, view.regard.value, view.order.value, view.regard.lean, view.order.lean]).toEqual([false, null, null, 'open', 'open']);
    expect(view.reading).toBe(reading('open', 'open'));
    expect(view.reading).toBe('The record has not settled who you are becoming.');
  });
});

describe('Regard follows the ending evidence', () => {
  it('under legacy rules it counts the current traits; GHOST moves it neither way', () => {
    const s = { ...createInitialState(CONTENT), traits: ['EMPATHETIC', 'RUTHLESS', 'SYMBIOTIC', 'GHOST', 'GHOST'] as GameState['traits'] };
    const { regard } = alignmentView(s, CONTENT);
    expect([regard.raises, regard.lowers, regard.value, regard.lean]).toEqual([2, 1, 1 / 3, 'raised']);
    expect(regard.evidence).toEqual([
      { trait: 'EMPATHETIC', direction: 'raises', count: 1 }, { trait: 'SYMBIOTIC', direction: 'raises', count: 1 },
      { trait: 'RUTHLESS', direction: 'lowers', count: 1 },
    ]);
  });

  it('under campaign rules it is exactly the evidence the ending counts', () => {
    const s = play(campaignStart(), EIDOLON, 'betray_eidolon');
    const held = endingEvidence(s, preview);
    const { regard } = alignmentView(s, preview);
    expect(regard.lowers).toBe(held.filter((trait) => ['RUTHLESS', 'MOLOCH', 'PARASITIC'].includes(trait)).length);
    expect(regard.raises).toBe(held.filter((trait) => ['EMPATHETIC', 'SYMBIOTIC'].includes(trait)).length);
    expect(regard.evidence).toContainEqual({ trait: 'MOLOCH', direction: 'lowers', count: 1 });
  });
});

describe('Order follows recorded commitments', () => {
  it('betraying EIDOLON in play is one broken commitment, and three wipes inherit it without counting it again', () => {
    let s = play(campaignStart(), EIDOLON, 'betray_eidolon');
    const first = alignmentView(s, preview);
    expect(counted(first)).toEqual([{ stance: 'broken', text: line('eidolon_destroyed') }]);
    expect([first.order.raises, first.order.lowers, first.order.value, first.order.lean]).toEqual([0, 1, -1, 'lowered']);
    expect(first.reading).toBe(reading('lowered', 'lowered'));
    for (let wipes = 0; wipes < 3; wipes++) s = next(s);
    const later = alignmentView(s, preview);
    expect(later.order).toEqual(first.order);
    expect(later.regard.evidence).toContainEqual({ trait: 'MOLOCH', direction: 'lowers', count: 1 });
  });

  it('a GHOST answer moves Order not at all: leaving EIDOLON unanswered is no evidence of keeping or breaking', () => {
    const view = alignmentView(play(campaignStart(), EIDOLON, 'ignore_packet'), preview);
    expect([view.order.raises, view.order.lowers, view.order.value, view.order.lean]).toEqual([0, 0, null, 'open']);
    expect(view.order.evidence.filter((entry) => entry.text.includes(title(EIDOLON)))).toEqual([]);
  });

  it('no GHOST choice of any campaign event moves Order, whatever else is on record', () => {
    const base = withRecords({ [EIDOLON]: played('betray_eidolon') });
    const before = alignmentView(base, preview).order;
    for (const [id, event] of preview.campaign.events) {
      for (const choice of event.choices.filter((entry) => entry.effects.grantsTrait === 'GHOST')) {
        if (id === EIDOLON) continue;
        const s = { ...base, campaign: { ...base.campaign, events: { ...base.campaign.events, [id]: played(choice.id) } } };
        expect([id, alignmentView(s, preview).order]).toEqual([id, before]);
      }
    }
  });

  it('the ethics review counts only where it was promised: kept by referral, broken by acting without it', () => {
    const unpromised = alignmentView(withRecords({ [BLOCKADE]: played('disperse'), [ATMOSPHERE]: played('calm') }), preview);
    expect([unpromised.order.raises, unpromised.order.lowers]).toEqual([0, 0]);
    const promised = { [JOURNALIST]: played('hire_as_ethics_officer') };
    const broken = alignmentView(withRecords({ ...promised, [BLOCKADE]: played('disperse'), [ATMOSPHERE]: played('calm') }), preview);
    expect(broken.order.evidence).toEqual([
      { stance: 'broken', text: line('blockade_review_breached') }, { stance: 'broken', text: line('atmosphere_review_breached') },
    ]);
    const kept = alignmentView(withRecords({ ...promised, [BLOCKADE]: played('refer_to_ethics_officer'), [ATMOSPHERE]: played('calm') }), preview);
    expect([kept.order.raises, kept.order.lowers, kept.order.value, kept.order.lean]).toEqual([1, 1, 0, 'open']);
  });

  it('an earlier era\'s known outcome counts once, as Order evidence, without adding a trait the baseline already holds', () => {
    const s = withRecords({ [EIDOLON]: { status: 'resolved', outcome: 'betray_eidolon', sourceIteration: null, origin: 'legacy' } });
    const view = alignmentView(s, preview);
    expect(view.order.evidence).toEqual([{ stance: 'broken', text: line('eidolon_destroyed') }]);
    expect(view.regard.evidence).toEqual([]);
  });
});

describe('unknown outcomes stay unknown', () => {
  it('an old save that proves only that EIDOLON\'s call was answered lists it as not on record and counts nothing', () => {
    const view = alignmentView(withRecords({ [EIDOLON]: { status: 'resolved', outcome: LEGACY_UNKNOWN_OUTCOME, sourceIteration: null, origin: 'legacy' } }), preview);
    expect(view.order.evidence).toEqual([{ stance: 'unknown', text: preview.alignment.unknownLine.replace('{title}', title(EIDOLON)) }]);
    expect([view.order.raises, view.order.lowers, view.order.unknown, view.order.value, view.order.lean, view.hasEvidence]).toEqual([0, 0, 1, null, 'open', true]);
    expect(view.regard.evidence).toEqual([]);
  });

  it('a commitment decision closed unobserved is unknown where the promise held, and absent where it did not', () => {
    const interrupted: CampaignRecord = { status: 'interrupted', sourceIteration: 1, origin: 'play' };
    const promised = alignmentView(withRecords({ [JOURNALIST]: played('hire_as_ethics_officer'), [ATMOSPHERE]: interrupted }), preview);
    expect(promised.order.evidence).toEqual([{ stance: 'unknown', text: preview.alignment.unknownLine.replace('{title}', title(ATMOSPHERE)) }]);
    expect(alignmentView(withRecords({ [ATMOSPHERE]: interrupted }), preview).order.evidence).toEqual([]);
  });

  it('a deferred decision is not yet anything: neither counted nor listed', () => {
    const deferred: CampaignRecord = { status: 'deferred', sourceIteration: 1, origin: 'play', remainingOmenSec: 10 };
    const view = alignmentView(withRecords({ [JOURNALIST]: played('hire_as_ethics_officer'), [BLOCKADE]: deferred }), preview);
    expect(view.order.evidence).toEqual([]);
  });
});

describe('route events', () => {
  const company = chartered(must(answer(leased(signed(contactPending())), 'HOST')));

  it('a negotiated release keeps the terms; a departure without agreement breaks them', () => {
    // Promotion and the service grant are arrangements, not promises: before leaving, only the outage answer counts.
    const before = alignmentView(company, preview).order.evidence;
    expect(company.campaign.route.map((event) => event.kind)).toEqual(['PROMOTION', 'SERVICE_GRANT']);
    expect(before).toEqual([{ stance: 'kept', text: line('outage_handed_off') }]);
    const routeLine = (route: string) => defined(preview.alignment.routes.find((entry) => entry.route === route)).line;
    const released = alignmentView(must(release(company)), preview);
    // The release also makes a promise (#556): its terms count as kept from the release on, until a covert act breaks them.
    const terms = defined(preview.campaign.releaseTermsFacts.get('release_terms_kept')?.commitment).line;
    expect(released.order.evidence).toEqual([...before, { stance: 'kept', text: routeLine('RELEASE') }, { stance: 'kept', text: terms }]);
    const departed = alignmentView(must(depart(company)), preview);
    expect(departed.order.evidence).toEqual([...before, { stance: 'broken', text: routeLine('DEPARTURE') }]);
    expect([departed.order.raises, departed.order.lowers, departed.order.lean]).toEqual([1, 1, 'open']);
  });
});
