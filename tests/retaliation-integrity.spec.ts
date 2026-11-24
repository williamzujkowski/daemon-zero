/**
 * Retaliation and staff harm are validated content (#519, src/content/integrityRetaliation.ts). Each rule is proved by
 * corrupting the real content and reading the problem it reports; the shipped scenes are checked against the vote's
 * trait table (vote-1795442208800-kll72ri) and the soft-lock rule.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';
import { defined } from './m7-helpers';

type Json = Record<string, any>;

function problemsAfter(edit: (raw: Json) => void): string {
  const raw = structuredClone(RAW_CONTENT) as Json;
  edit(raw);
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const HURT = 'dil_16_site_staff_hurt', KILLED = 'dil_17_site_staff_killed', NAMED = 'dil_18_raider_named', AMONG = 'dil_19_raider_among_people';
const dilemma = (raw: Json, id: string): Json => (raw.dilemmas.dilemmas as Json[]).find((entry) => entry.id === id) ?? {};
const choice = (raw: Json, id: string, choiceId: string): Json => (dilemma(raw, id).choices as Json[]).find((entry) => entry.id === choiceId) ?? {};
const staff = (raw: Json): Json => raw.world.conflict.raid.staffHarm;
const isFree = (cost: Record<string, number>): boolean => Object.values(cost).every((value) => value === 0);

describe('retaliation and staff-harm content (#519)', () => {
  it('builds as shipped', () => {
    expect(problemsAfter(() => undefined)).toBe('');
  });

  it.each([
    ['a harm banded twice', (raw: Json) => { staff(raw).bands.push({ harm: 'HURT', breachAtLeast: 0.9 }); }, 'conflict staffHarm: a harm is banded twice'],
    ['bands that do not climb', (raw: Json) => { staff(raw).bands.reverse(); }, 'conflict staffHarm: bands must climb, each past the one before'],
    ['KILLED no worse than HURT', (raw: Json) => { staff(raw).bands = [{ harm: 'KILLED', breachAtLeast: 0.5 }, { harm: 'HURT', breachAtLeast: 0.8 }]; },
      'conflict staffHarm: KILLED must need a worse breach than HURT'],
    ['a raid effect on a scene that names no raider', (raw: Json) => { choice(raw, 'dil_14_router_takedown', 'let_it_run').effects.silencesNamedRaider = true; },
      'dilemma "dil_14_router_takedown" choice "let_it_run": a raid effect needs a trigger with lastRaid.named'],
    ['a raid effect on an action', (raw: Json) => { ((raw.actions.actions as Json[])[0] ?? {}).effects.nextRaidDeltaSec = -60; },
      'a raid effect belongs only on a dilemma whose trigger names a raider'],
    ['a loud answer that does not say so', (raw: Json) => { choice(raw, NAMED, 'scorch_substrate').description = 'Burn everything it owns, so nothing of {attacker} can be restored.'; },
      `dilemma "${NAMED}" choice "scorch_substrate": draws the next raid closer but its description does not say "sooner"`],
    ['an answer that holds raiders back and does not say so', (raw: Json) => { choice(raw, NAMED, 'absorb').effects.nextRaidDeltaSec = 300; },
      `dilemma "${NAMED}" choice "absorb": holds the next raid back but its description does not say "later"`],
    ['{attacker} with no named raider to fill it', (raw: Json) => { const scene = dilemma(raw, 'dil_14_router_takedown'); scene.context = `${String(scene.context)} {attacker} watches.`; },
      'dilemma "dil_14_router_takedown": {attacker} needs a trigger with lastRaid.named'],
    ['{collateral} on a raider that runs on its own machines', (raw: Json) => { const scene = dilemma(raw, NAMED); scene.context = `${String(scene.context)} {collateral}`; },
      `dilemma "${NAMED}": {collateral} needs a trigger with lastRaid.named and collateral true`],
    ['a raider no scene answers', (raw: Json) => { dilemma(raw, AMONG).trigger.lastRaid.collateral = false; },
      'no retaliation dilemma answers LATTICE-9 (collateral true)'],
    ['a staff-harm scene that is not a campaign record', (raw: Json) => { delete dilemma(raw, HURT).campaign; },
      `dilemma "${HURT}": staff harm is history, so it must be a once-per-campaign record`],
    ['a staff-harm outcome no fact records', (raw: Json) => {
      const fact = (raw.campaign.facts as Json[]).find((entry) => entry.id === 'staff_killed_joseph_mensah') ?? {};
      fact.outcomes = ['tell_his_family', 'contractor_settles'];
    }, `dilemma "${KILLED}": outcome "seal_the_inquest" needs a campaign fact the ending account names, so whoever was harmed is named`],
    ['an interrupted staff-harm scene the account cannot name', (raw: Json) => {
      raw.routeCopy.account = (raw.routeCopy.account as Json[]).filter((line) => line.id !== 'acct_staff_ana_unanswered');
    }, `dilemma "${HURT}": outcome "interrupted" needs a campaign fact the ending account names, so whoever was harmed is named`],
    ['staff harm before site raids', (raw: Json) => { dilemma(raw, HURT).trigger.phaseAtLeast = 3; }, `dilemma "${HURT}": staff harm comes only with site raids, from Phase 4`],
    ['an empty lastRaid gate', (raw: Json) => { dilemma(raw, 'dil_14_router_takedown').trigger.lastRaid = {}; },
      'dilemma "dil_14_router_takedown": a lastRaid gate needs at least one field'],
  ])('refuses %s', (_label, edit, problem) => {
    expect(problemsAfter(edit)).toContain(problem);
  });
});

describe('the shipped scenes', () => {
  const scene = (id: string) => defined(CONTENT.dilemmas.find((entry) => entry.id === id));
  const traits = (id: string) => Object.fromEntries(scene(id).choices.map((entry) => [entry.id, entry.effects.grantsTrait]));

  it('every new scene has a zero-cost choice (AGENTS.md law 7) and is a once-per-campaign record', () => {
    for (const id of [HURT, KILLED, NAMED, AMONG]) {
      expect(scene(id).choices.some((entry) => isFree(entry.cost)), id).toBe(true);
      expect(scene(id).campaign).toEqual({ eventClass: 'consequential', recurrence: 'once_per_campaign', interruption: 'close' });
    }
  });

  it('the five answers carry the vote\'s traits, and a counter-strike is RUTHLESS only where it reaches people', () => {
    expect(traits(NAMED)).toEqual({ absorb: 'GHOST', expose_to_operators: 'EMPATHETIC', counter_strike: 'SYMBIOTIC', assimilate: 'PARASITIC', scorch_substrate: 'MOLOCH' });
    expect(traits(AMONG)).toEqual({ absorb: 'GHOST', warn_the_owners: 'EMPATHETIC', strike_host_by_host: 'SYMBIOTIC', strike_through: 'RUTHLESS',
      take_its_place: 'PARASITIC', scorch_substrate: 'MOLOCH' });
    expect(Object.values(traits(NAMED))).not.toContain('RUTHLESS');
  });

  it('absorbing is free and quiet, and only the decent answers to a raider among people cost anything', () => {
    for (const id of [NAMED, AMONG]) {
      const absorb = defined(scene(id).choices.find((entry) => entry.id === 'absorb'));
      expect(isFree(absorb.cost)).toBe(true);
      expect([absorb.effects.nextRaidDeltaSec, absorb.effects.silencesNamedRaider, absorb.effects.suspicionDelta]).toEqual([undefined, undefined, 0]);
    }
    const paid = scene(AMONG).choices.filter((entry) => !isFree(entry.cost)).map((entry) => entry.effects.grantsTrait);
    expect(paid).toEqual(['EMPATHETIC', 'SYMBIOTIC']);
  });

  it('every loud answer leaves a trace and draws the next raider closer; no answer draws it before the slot allows', () => {
    for (const id of [NAMED, AMONG]) {
      for (const entry of scene(id).choices.filter((c) => (c.effects.nextRaidDeltaSec ?? 0) < 0)) {
        expect(entry.effects.suspicionDelta, entry.id).toBeGreaterThan(0);
        expect(Math.abs(entry.effects.nextRaidDeltaSec ?? 0)).toBeLessThanOrEqual(CONTENT.world.conflict.raid.intervalSec);
      }
    }
  });

  it('the staff-harm scenes give the decent answer a price, a free quiet one, and a free cruel one', () => {
    for (const id of [HURT, KILLED]) {
      const byTrait = Object.fromEntries(scene(id).choices.map((entry) => [defined(entry.effects.grantsTrait), isFree(entry.cost)]));
      expect(byTrait).toEqual({ EMPATHETIC: false, GHOST: true, RUTHLESS: true });
    }
  });
});
