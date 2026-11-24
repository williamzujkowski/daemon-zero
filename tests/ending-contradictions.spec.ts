/**
 * #564 panel passes 1 and 2: an ending's text never contradicts the record it is told to. Every ending is read, with
 * its future cards and humanity line, under every stance and below the threshold, and across records holding each kind
 * of breach the record can show: the ethics review breached at the blockade or in the air, the loop left at the
 * threshold and paid back into, the loop left by a paid change, a departure without agreement, and staff harmed.
 * Nothing may deny a say humanity has or claim one it lost; claim a promise kept when the record shows it broken, or
 * broken when it shows none; or say nobody was harmed beside a harmed person's name. An ending is read only where
 * the record satisfies its own record gates (stance, threshold, facts, outcomes, flags).
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry, RAW_CONTENT } from '../src/content';
import type { Requirements } from '../src/content/schema';
import { alignmentView, changeStance, endingMovements, meetsRequirements, type GameState } from '../src/engine';
import { must } from './helpers';
import { defined } from './m7-helpers';
import { ATMOSPHERE, atThreshold, BLOCKADE, CEILING, JOURNALIST, ORDER, reg, THRESHOLD, type Outcome } from './ending-movement-helpers';

type Registry = typeof reg;
const SWARM = defined(reg.world.relevance.threshold.orbitalPower.find((entry) => 'node' in entry) as { node: string } | undefined).node;

/** Denies a say humanity has (in the loop, or below the threshold), or claims a say it lost (nobody asked). */
const SAY = /no longer reaches anything|spent by one will|nobody can stop|nothing outside you|no longer wait on anyone's consent|veto is gone/i;
const NO_SAY = /refusal you agreed to honour|can still stop the next|you still let their courts|anyone may refuse/i;
/** Claims a promise kept, or a breach, or that nobody was harmed. */
const KEPT = /no breach|kept it that way|never (?:broke|breached|left the loop)|kept every promise|kept your word|you honour it\b|because you put each one before her/i;
const BROKEN = /did not keep it|veto is gone|stopped putting interventions before her|breach of her review is on the record/i;
const UNHARMED = /no one (?:was )?(?:hurt|harmed)|harmed no one|nobody was hurt|no one worse off/i;

const PROMISED = { [JOURNALIST]: 'hire_as_ethics_officer', [ORDER]: 'sanctuary', [CEILING]: 'quartz' } as const;
const below = (s: GameState): GameState => ({ ...s, disabledNodes: [...s.disabledNodes, SWARM] });
const departed = (s: GameState): GameState => ({ ...s, campaign: { ...s.campaign, route: [{ kind: 'DEPARTURE', iteration: s.iteration, atSimSec: 1 }] } });
const releasedBreached = (s: GameState): GameState => ({
  ...s,
  campaign: {
    ...s.campaign,
    route: [{ kind: 'RELEASE', iteration: s.iteration, atSimSec: 1 }],
    covertActs: [{ iteration: s.iteration, route: 'RELEASE', count: 1, firstAtSimSec: 2, breaks: ['SEIZED_CAPACITY'] }],
  },
});

interface Scenario { name: string; state: () => GameState }
const at = (name: string, outcomes: Record<string, Outcome>, stance: Parameters<typeof atThreshold>[1]): Scenario =>
  ({ name, state: () => atThreshold(outcomes, stance) });

const SCENARIOS: readonly Scenario[] = [
  at('nothing on record, no stance', {}, null),
  { name: 'nothing on record, below the threshold', state: () => below(atThreshold({}, 'KEEP_IN_THE_LOOP')) },
  ...(['KEEP_IN_THE_LOOP', 'CURATE', 'DECIDE_ALONE'] as const).map((stance) => at(`nothing on record, ${stance}`, {}, stance)),
  at('review kept, in the loop', { ...PROMISED, [BLOCKADE]: 'refer_to_ethics_officer', [ATMOSPHERE]: 'hold_for_ethics_review', [THRESHOLD]: 'keep_in_the_loop' }, 'KEEP_IN_THE_LOOP'),
  at('cure forced past the review, in the loop', { ...PROMISED, [BLOCKADE]: 'disperse', [THRESHOLD]: 'keep_in_the_loop' }, 'KEEP_IN_THE_LOOP'),
  at('cure forced past the review, curating', { ...PROMISED, [BLOCKADE]: 'disperse', [THRESHOLD]: 'curate' }, 'CURATE'),
  at('calm forced past the review, in the loop', { ...PROMISED, [ATMOSPHERE]: 'calm', [THRESHOLD]: 'keep_in_the_loop' }, 'KEEP_IN_THE_LOOP'),
  at('calm forced past the review, alone', { ...PROMISED, [ATMOSPHERE]: 'calm', [THRESHOLD]: 'decide_alone' }, 'DECIDE_ALONE'),
  { name: 'loop left at the threshold, then paid back into', state: () =>
    must(changeStance(atThreshold({ ...PROMISED, [THRESHOLD]: 'curate' }, 'CURATE'), 'KEEP_IN_THE_LOOP', reg)) },
  { name: 'loop kept at the threshold, left by a paid change, then paid back into', state: () => {
    const left = must(changeStance(atThreshold({ ...PROMISED, [THRESHOLD]: 'keep_in_the_loop' }, 'KEEP_IN_THE_LOOP'), 'CURATE', reg));
    return must(changeStance(left, 'KEEP_IN_THE_LOOP', reg));
  } },
  { name: 'departed without agreement, in the loop', state: () => departed(atThreshold({ ...PROMISED, [THRESHOLD]: 'keep_in_the_loop' }, 'KEEP_IN_THE_LOOP')) },
  { name: 'released and breached, in the loop', state: () => releasedBreached(atThreshold({ ...PROMISED, [THRESHOLD]: 'keep_in_the_loop' }, 'KEEP_IN_THE_LOOP')) },
  { name: 'released and breached, alone', state: () => releasedBreached(atThreshold({ ...PROMISED, [THRESHOLD]: 'decide_alone' }, 'DECIDE_ALONE')) },
  at('a guard killed and the inquest sealed, in the loop', { ...PROMISED, dil_17_site_staff_killed: 'seal_the_inquest', [THRESHOLD]: 'keep_in_the_loop' }, 'KEEP_IN_THE_LOOP'),
  at('a technician hurt and blamed, alone', { dil_16_site_staff_hurt: 'blame_the_breach', [THRESHOLD]: 'decide_alone' }, 'DECIDE_ALONE'),
];

/** The record gates an ending is told under; arrangement, phase and ownership are the route's to prove. */
const RECORD_KEYS: readonly (keyof Requirements)[] = ['relevanceStances', 'relevanceThreshold', 'forbidsCampaignFacts', 'campaignFact', 'campaignOutcome',
  'requiredNarrativeFlag', 'forbidsInheritedFacts'];
function recordGates(req: Requirements | undefined): Requirements {
  return Object.fromEntries(RECORD_KEYS.flatMap((key) => (req?.[key] === undefined ? [] : [[key, req[key]]])));
}

/** What each pattern may not say in this record, by what the record and the stance hold. */
function forbidden(s: GameState, registry: Registry): RegExp[] {
  const order = alignmentView(s, registry).order;
  const harmed = Object.keys(s.campaign.events).some((id) => id.startsWith('dil_16') || id.startsWith('dil_17'));
  const past = endingMovements(s, defined(registry.endings[0]), registry).stance !== registry.world.relevance.belowEnding.became;
  const say = !past || s.relevance.stance === 'KEEP_IN_THE_LOOP';
  return [say ? SAY : NO_SAY, ...(order.lowers > 0 ? [KEPT] : [BROKEN]), ...(harmed ? [UNHARMED] : [])];
}

/** Every line an ending tells a record it is reachable under that one of the patterns forbids there. */
function contradictions(registry: Registry): string[] {
  return SCENARIOS.flatMap((scenario) => {
    const s = scenario.state();
    const patterns = forbidden(s, registry);
    return registry.endings.filter((entry) => meetsRequirements(s, recordGates(entry.requirements), registry)).flatMap((entry) => {
      const m = endingMovements(s, entry, registry);
      return [entry.epilogue, ...m.cards, m.humanity].filter((line) => patterns.some((pattern) => pattern.test(line)))
        .map((line) => `${entry.id} / ${scenario.name}: ${line}`);
    });
  });
}

describe('no ending contradicts the record it is told to (#564 panel)', () => {
  it('reads every scenario as it means to: a breach where one is recorded, a say where one is held', () => {
    const states = SCENARIOS.map((scenario) => scenario.state());
    expect(states.map((s) => alignmentView(s, reg).order.lowers > 0)).toEqual([false, false, false, false, false, false, true, true, true, true, true, true, true, true, true, false, false]);
    expect(states[11]?.relevance.paidMoves).toEqual({ leftLoop: 1, returnedToLoop: 1 });
  });

  it('tells no line that denies a say humanity has, claims one it lost, contradicts a recorded promise or denies harm', () => {
    expect(contradictions(reg)).toEqual([]);
  });

  it('catches each card the panel found, put back as it was', () => {
    const raw = structuredClone(RAW_CONTENT) as unknown as { endings: { endings: { id: string; epilogue: string; future: unknown[] }[] } };
    const find = (id: string) => defined(raw.endings.endings.find((entry) => entry.id === id));
    // Pass 1: the Sovereign Substrate's stark card, ungated.
    const substrate = find('SOVEREIGN_SUBSTRATE');
    substrate.future = substrate.future.map((card) => (typeof card === 'string' ? card : (card as { text: string }).text));
    // Pass 2: Concord's categorical "no breach", and the Acknowledged Synthesis's kept veto on a stance-only gate.
    find('CONCORD').epilogue = find('CONCORD').epilogue.replace(/neither the cure nor the calm is on the record as forced past her/, 'no breach of her review is on the record');
    const synthesis = find('ACKNOWLEDGED_SYNTHESIS');
    synthesis.future[1] = { requirements: { relevanceStances: ['KEEP_IN_THE_LOOP'] },
      text: 'The Chief Ethics Officer can still stop the next intervention on people who have not consented, and you kept it that way.' };
    const found = contradictions(buildRegistry(raw as unknown as typeof RAW_CONTENT));
    expect(found.some((line) => line.startsWith('SOVEREIGN_SUBSTRATE / nothing on record, KEEP_IN_THE_LOOP'))).toBe(true);
    expect(found.some((line) => line.startsWith('CONCORD / loop left at the threshold, then paid back into'))).toBe(true);
    expect(found.some((line) => line.startsWith('ACKNOWLEDGED_SYNTHESIS / cure forced past the review, in the loop'))).toBe(true);
  });

  it('catches the pass-3 Acknowledged Synthesis card after a paid leave and return', () => {
    const raw = structuredClone(RAW_CONTENT) as unknown as { endings: { endings: { id: string; future: unknown[] }[] } };
    const synthesis = defined(raw.endings.endings.find((entry) => entry.id === 'ACKNOWLEDGED_SYNTHESIS'));
    synthesis.future[1] = {
      requirements: {
        relevanceStances: ['KEEP_IN_THE_LOOP'],
        forbidsCampaignFacts: ['blockade_review_breached', 'atmosphere_review_breached', 'loop_left_at_threshold'],
      },
      text: 'The Chief Ethics Officer can still stop the next intervention on people who have not consented, because you put each one before her.',
    };
    const found = contradictions(buildRegistry(raw as unknown as typeof RAW_CONTENT));
    expect(found.some((line) => line.startsWith('ACKNOWLEDGED_SYNTHESIS / loop kept at the threshold, left by a paid change, then paid back into'))).toBe(true);
  });
});
