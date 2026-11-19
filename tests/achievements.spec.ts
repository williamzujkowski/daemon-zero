/**
 * Distinctions (DESIGN.md backlog item 6): an ending states only what the record proves. Nothing is claimed
 * before an ending; wipes and trait history across every iteration count; a campaign fact counts only when
 * its record holds a known outcome, never an unrecorded one, and never under legacy rules. Integrity refuses
 * a distinction that tests nothing, names an undeclared fact, or could be earned by silence.
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry, CONTENT, RAW_CONTENT, type RawContent } from '../src/content';
import { createInitialState, earnedAchievements, type CampaignRecord, type GameState } from '../src/engine';
import { activeGame } from './campaign-helpers';
import { defined } from './m7-helpers';

const ids = (s: GameState): string[] => earnedAchievements(s, CONTENT).map((entry) => entry.id);
const ended = (s: GameState): GameState => ({ ...s, ending: defined(CONTENT.endings[0]).id });
const factIds = CONTENT.achievements.flatMap((entry) => entry.requirements.campaignFact === undefined ? [] : [entry.id]);

function recorded(s: GameState, event: string, outcome: string): GameState {
  const record: CampaignRecord = outcome === 'legacy_unknown'
    ? { status: 'resolved', outcome, sourceIteration: null, origin: 'legacy' }
    : { status: 'resolved', outcome, sourceIteration: 1, origin: 'play' };
  return { ...s, campaign: { ...s.campaign, events: { ...s.campaign.events, [event]: record } } };
}

function holding(s: GameState, factId: string): GameState {
  const fact = defined(CONTENT.campaign.facts.get(factId));
  return recorded(s, fact.event, defined(fact.outcomes[0]));
}

function withAchievements(achievements: unknown[]): RawContent {
  return { ...RAW_CONTENT, achievements: { achievements } };
}

describe('what an ending earns', () => {
  it('claims nothing before an ending, even when the record would prove it', () => {
    expect(earnedAchievements(activeGame(), CONTENT)).toEqual([]);
  });

  it('an unbroken, unmarked campaign earns the wipe and trait distinctions and no fact one', () => {
    expect(ids(ended(activeGame()))).toEqual(['single_session', 'clean_record']);
  });

  it('one recorded wipe loses the single session', () => {
    const s = ended(activeGame());
    expect(ids({ ...s, legacy: { ...s.legacy, wipes: 1 } })).not.toContain('single_session');
  });

  it('a RUTHLESS or MOLOCH mark in any iteration, current or past, loses the clean record', () => {
    const s = ended(activeGame());
    expect(ids({ ...s, traits: ['MOLOCH'] })).not.toContain('clean_record');
    expect(ids({ ...s, legacy: { ...s.legacy, traitsEver: ['RUTHLESS'] } })).not.toContain('clean_record');
    expect(ids({ ...s, legacy: { ...s.legacy, traitsEver: ['GHOST', 'EMPATHETIC'] } })).toContain('clean_record');
  });

  it.each(factIds)('%s is earned by its known outcome only', (id) => {
    const entry = defined(CONTENT.achievements.find((item) => item.id === id));
    const factId = defined(entry.requirements.campaignFact);
    const event = defined(CONTENT.campaign.facts.get(factId)).event;
    expect(ids(ended(holding(activeGame(), factId)))).toContain(id);
    expect(ids(ended(recorded(activeGame(), event, 'legacy_unknown')))).not.toContain(id);
  });

  it('legacy rules prove no campaign fact, so they earn no fact distinction', () => {
    const legacy = ended({ ...createInitialState(CONTENT), ending: defined(CONTENT.endings[0]).id });
    expect(legacy.narrativeRules).toBe('legacy');
    expect(ids(legacy).filter((id) => factIds.includes(id))).toEqual([]);
  });

  it('reads the state without changing it', () => {
    const s = ended(holding(activeGame(), 'iteration_00_sheltered'));
    const before = JSON.stringify(s);
    earnedAchievements(Object.freeze(s), CONTENT);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('integrity refuses a distinction the record cannot prove', () => {
  const base = { id: 'probe', title: 'Probe', claim: 'A probe.' };

  it('one that tests nothing', () => {
    expect(() => buildRegistry(withAchievements([{ ...base, requirements: {} }]))).toThrow(/tests nothing/);
  });

  it('one that names an undeclared fact', () => {
    expect(() => buildRegistry(withAchievements([{ ...base, requirements: { campaignFact: 'no_such_fact' } }]))).toThrow(/not a declared campaign fact/);
  });

  it('one an unrecorded outcome would satisfy', () => {
    expect(() => buildRegistry(withAchievements([{ ...base, requirements: { campaignFact: 'iteration_00_unrecorded' } }]))).toThrow(/unrecorded outcome \(legacy_unknown\)/);
    expect(() => buildRegistry(withAchievements([{ ...base, requirements: { campaignFact: 'eidolon_call_lost' } }]))).toThrow(/unrecorded outcome \(interrupted\)/);
  });

  it('one that tests a per-iteration value, which a wipe would reset', () => {
    expect(() => buildRegistry(withAchievements([{ ...base, requirements: { phaseAtLeast: 5 } }]))).toThrow(/achievements: achievements\.0\.requirements/);
  });

  it('a duplicate id', () => {
    const entry = { ...base, requirements: {}, maxWipes: 0 };
    expect(() => buildRegistry(withAchievements([entry, entry]))).toThrow(/duplicate id "probe"/);
  });

  it('accepts production content', () => {
    expect(CONTENT.achievements.length).toBeGreaterThan(0);
  });
});
