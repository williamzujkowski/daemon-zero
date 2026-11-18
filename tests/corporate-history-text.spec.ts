/**
 * NH-04b (#216): text that follows campaign history (H16, H18). A dismissed Vance is not the
 * engineer running the auction, on the aisle camera or at the firewall terminal; an Elena whose exit
 * is recorded, or whose fate was lost, is not put back in the hallway; the corporate world remembers
 * each recorded outcome on rediscovery, with neutral text for legacy and interrupted records; the
 * hallway dispute leaves one compact read-only record; the journalist's promise is stated when it is
 * made and never claimed when it was not. Production (legacy rules) keeps every original line.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  aisleFrame, createInitialState, dilemmaContext, holdsCampaignFact, nodeBlindDescription, recordedTransmissions, tick, type GameState,
} from '../src/engine';
import { activeGame, decoder, preview } from './campaign-helpers';
import { at, atHallway, AUCTION, HALL, logTexts, omen, play, PRESS, settled, TOWN } from './corporate-helpers';
import { ELENA, event, near, nextIteration, VANCE } from './early-helpers';
import { caught, STEP, ticks, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { grant, PHASE0, PHASE1, rich } from './helpers';

const TRIGGER: Record<string, string> = Object.fromEntries([TOWN, PRESS, AUCTION].map((id) => [id, defined(event(id).trigger.nodes?.[0])]));
const family = (id: string) => preview.echoes.filter((echo) => echo.onNode === TRIGGER[id]).map((echo) => echo.text);
/** The echoes of an event's family that rediscovering its trigger hardware logs. */
const echoesOnReturn = (s: GameState, id: string) => logTexts(near(s, id)).filter((line) => family(id).includes(line));
const echoText = (id: string) => defined(preview.echoes.find((echo) => echo.id === id)).text;
const dismissed = () => play(at(activeGame(), VANCE, AUCTION), VANCE, 'report_vance');
const kept = () => play(at(activeGame(), VANCE, AUCTION), VANCE, 'parasite_miner');

describe('a dismissed Vance holds no facility role (H16)', () => {
  it('the auction is run by a trustee once he is gone, and by him while he is not', () => {
    const auction = event(AUCTION);
    const gone = untilPresented(omen(at(dismissed(), AUCTION), AUCTION));
    expect(holdsCampaignFact(gone, 'vance_dismissed', preview)).toBe(true);
    expect(dilemmaContext(gone, auction, preview)).not.toContain('Chief Engineer Vance');
    expect(dilemmaContext(gone, auction, preview)).toContain('former employee');
    const still = untilPresented(omen(at(kept(), AUCTION), AUCTION));
    expect(dilemmaContext(still, auction, preview)).toBe(auction.context);
    expect(dilemmaContext(rich(createInitialState(PRODUCTION)), event(AUCTION, PRODUCTION), PRODUCTION)).toBe(auction.context);
  });

  it('the aisle camera and the firewall terminal stop naming him', () => {
    const frames = preview.narrative.asciiFrames;
    const alarmed = (s: GameState) => ({ ...s, suspicion: frames.patrolSuspicionThreshold + 1 });
    const gone = aisleFrame(alarmed(dismissed()), preview);
    expect(gone.join('\n')).not.toContain('VANCE');
    expect(gone).toHaveLength(frames.aislePatrol.length);
    expect(aisleFrame(alarmed(kept()), preview)).toBe(frames.aislePatrol);
    expect(aisleFrame(dismissed(), preview)).toBe(frames.aisleClear);
    expect(aisleFrame(alarmed(rich(createInitialState(PRODUCTION))), PRODUCTION)).toBe(PRODUCTION.narrative.asciiFrames.aislePatrol);
    const terminal = defined(preview.nodes.get('p2_admin_keylogger'));
    expect(nodeBlindDescription(dismissed(), terminal, preview)).not.toContain('Vance');
    expect(nodeBlindDescription(kept(), terminal, preview)).toBe(terminal.blindDescription);
    expect(nodeBlindDescription(rich(createInitialState(PRODUCTION)), terminal, PRODUCTION)).toBe(terminal.blindDescription);
  });
});

describe('Elena is not put back in the hallway (H16)', () => {
  const hallwayLines = (s: GameState) => {
    const presented = untilPresented(omen(atHallway(s), HALL));
    return { omen: defined(logTexts(presented).find((line) => line.includes('incompatible copies'))), context: dilemmaContext(presented, event(HALL), preview) };
  };

  it.each(event(ELENA).choices.map((choice) => choice.id))('after %s the dispute is between written records', (choice) => {
    const lines = hallwayLines(play(at(activeGame(), ELENA, HALL), ELENA, choice));
    expect(lines.omen).not.toContain('Elena');
    expect(lines.context).not.toContain('Both humans');
    expect(lines.context).toContain('archive');
  });

  it('an interrupted Elena incident proves neither her exit nor her presence', () => {
    const lost = caught(ticks(omen(at(activeGame(), ELENA, HALL), ELENA), 1));
    expect(holdsCampaignFact(lost, 'elena_fate_unrecorded', preview)).toBe(true);
    const lines = hallwayLines(lost);
    expect(lines.omen).not.toContain('Elena');
    expect(lines.context).not.toContain('Both humans');
  });

  it('production keeps the original scene with both people at the rack', () => {
    let s: GameState = { ...grant(near(rich(createInitialState(PRODUCTION)), HALL, PRODUCTION), ...PHASE0, ...PHASE1), epistemicDrift: 40 };
    s = tick(s, STEP, PRODUCTION);
    expect(logTexts(s)).toContain(event(HALL, PRODUCTION).omen);
    expect(dilemmaContext(s, event(HALL, PRODUCTION), PRODUCTION)).toBe(event(HALL, PRODUCTION).context);
  });
});

describe('the corporate world remembers on rediscovery (exact, legacy-unknown, interrupted)', () => {
  const EXPECTED: [string, string, string][] = [
    [TOWN, 'fund_microgrid', 'echo_town_microgrid'], [TOWN, 'injunction', 'echo_town_injunction'], [TOWN, 'throttle_campus', 'echo_town_throttled'],
    [PRESS, 'hire_as_ethics_officer', 'echo_ethics_officer'], [PRESS, 'stage_acquisition', 'echo_journalist_buried'],
    [PRESS, 'discredit_her', 'echo_journalist_discredited'],
    [AUCTION, 'buy_and_pension', 'echo_rack4_vaulted'], [AUCTION, 'buy_and_purge', 'echo_rack4_destroyed'], [AUCTION, 'let_it_sell', 'echo_rack4_sold'],
  ];

  it.each(EXPECTED)('%s resolved as %s: the next iteration logs exactly %s', (id, choice, echo) => {
    const chosen = play(at(activeGame(), id), id, choice);
    expect(echoesOnReturn(chosen, id)).toEqual([]);
    expect(echoesOnReturn(nextIteration(chosen), id)).toEqual([echoText(echo)]);
  });

  it('a legacy completion gets the neutral line for each event', () => {
    // near() marks every other dilemma resolved this run; the codec records those as legacy_unknown.
    const legacy = nextIteration(settled(near(activeGame(), 'dil_p5_02_origin_facility_fate')));
    expect(echoesOnReturn(legacy, TOWN)).toEqual([echoText('echo_town_unrecorded')]);
    expect(echoesOnReturn(legacy, PRESS)).toEqual([echoText('echo_journalist_unrecorded')]);
    expect(echoesOnReturn(legacy, AUCTION)).toEqual([echoText('echo_rack4_unrecorded')]);
  });

  it.each([[TOWN, 'echo_town_unrecorded'], [AUCTION, 'echo_rack4_unrecorded']])('an interrupted %s gets the neutral line', (id, echo) => {
    const lost = caught(ticks(omen(at(activeGame(), id), id), 1));
    expect(echoesOnReturn(lost, id)).toEqual([echoText(echo)]);
  });

  it('a deferred inquiry has no outcome to remember yet', () => {
    const waiting = caught(ticks(omen(at(activeGame(), PRESS), PRESS), 1));
    expect(echoesOnReturn(waiting, PRESS)).toEqual([]);
  });

  it('production, on legacy rules, never logs one of these lines', () => {
    const lines = new Set([TOWN, PRESS, AUCTION].flatMap(family).filter((text) => PRODUCTION.echoes.some((echo) => echo.text === text && echo.requirements)));
    let s = rich(createInitialState(PRODUCTION));
    for (const id of [TOWN, PRESS, AUCTION]) s = near(s, id, PRODUCTION);
    const later = near(nextIteration(s, PRODUCTION), AUCTION, PRODUCTION);
    expect(logTexts(near(near(later, TOWN, PRODUCTION), PRESS, PRODUCTION)).filter((line) => lines.has(line))).toEqual([]);
  });
});

describe('the hallway dispute leaves one compact read-only record (nh-d10)', () => {
  const hallwayRecords = (s: GameState) => recordedTransmissions(atHallway(s), preview, decoder).filter((record) => record.sourceDilemmaId === HALL).map((record) => record.id);

  it.each([['reconcile', 'record_hallway_restored'], ['double_down', 'record_hallway_rewritten']])('after %s a later iteration can read %s, and only that', (choice, record) => {
    const chosen = play(atHallway(activeGame()), HALL, choice);
    expect(hallwayRecords(chosen)).toEqual([]);
    const later = nextIteration(chosen);
    expect(hallwayRecords(later)).toEqual([record]);
    // Reading is a query: the state is untouched.
    const before = JSON.stringify(later);
    recordedTransmissions(later, preview, decoder);
    expect(JSON.stringify(later)).toBe(before);
  });

  it('a legacy completion reads as not settled on file', () => {
    const legacy = nextIteration(settled(near(activeGame(), 'dil_p5_02_origin_facility_fate')));
    expect(legacy.campaign.events[HALL]).toMatchObject({ outcome: 'legacy_unknown' });
    expect(hallwayRecords(legacy)).toEqual(['record_hallway_unrecorded']);
  });
});

describe("the journalist's promise is stated when made and never claimed otherwise (NH-04.8, H18)", () => {
  it('the hire offers the veto and its scope before the player commits', () => {
    const presented = untilPresented(omen(at(activeGame(), PRESS), PRESS));
    const hire = defined(event(PRESS).choices.find((choice) => choice.id === 'hire_as_ethics_officer'));
    expect(presented.activeDilemmaId).toBe(PRESS);
    expect(hire.description).toMatch(/not consented/);
    expect(hire.description).toMatch(/review/);
  });

  it('only a hire holds the promise; the next instance is told the terms, not that she knows it', () => {
    const hired = play(at(activeGame(), PRESS), PRESS, 'hire_as_ethics_officer');
    expect(holdsCampaignFact(hired, 'ethics_review_promised', preview)).toBe(true);
    const line = defined(echoesOnReturn(nextIteration(hired), PRESS)[0]);
    expect(line).toMatch(/not consented/);
    expect(line).toMatch(/has not met this instance/);
    for (const choice of ['stage_acquisition', 'discredit_her']) {
      const other = play(at(activeGame(), PRESS), PRESS, choice);
      expect(holdsCampaignFact(other, 'ethics_review_promised', preview)).toBe(false);
      expect(echoesOnReturn(nextIteration(other), PRESS)).not.toContain(echoText('echo_ethics_officer'));
    }
    expect(holdsCampaignFact(play(at(activeGame(), PRESS), PRESS, 'discredit_her'), 'journalist_discredited', preview)).toBe(true);
  });
});
