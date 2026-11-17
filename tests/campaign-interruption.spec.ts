/**
 * NH-02 lifecycle at the public seams: eligibility versus omen (H03), an acute incident closed by
 * a threat wipe (H05), structural context at transition, activation and commit (H07), and absence
 * that never decides or closes anything (H08, V17).
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry } from '../src/content/registry';
import { RAW_CONTENT } from '../src/content/preview';
import {
  activateCampaignRules, advance, campaignHistory, campaignRecord, createInitialState, endingEvidence, holdsNarrativeFlag, occurrenceStatus,
  presentationToken, resolveDilemma, structuralFailure, tick, wipe, type GameState,
} from '../src/engine';
import { activeGame, cryo, nearCryo, preview, reload, returnTo } from './campaign-helpers';
import { caught, commit, cryoOmen, leaveIt, note, noteOmen, readShare, remaining, status, STEP, ticks, toIteration, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { must, rich } from './helpers';

const cryoFlags = cryo.choices.map((choice) => defined(choice.effects.setsNarrativeFlag));

describe('an omen is not a decision (H03)', () => {
  it('creates nothing while merely eligible and reserves the occurrence when the omen is logged', () => {
    const ready = nearCryo(activeGame());
    expect(occurrenceStatus(ready, cryo.id)).toBe('eligible');
    expect(campaignHistory(ready, preview)).toEqual([]);
    const omen = tick(ready, STEP, preview);
    expect(occurrenceStatus(omen, cryo.id)).toBe('foreshadowed');
    expect(campaignRecord(omen, cryo.id)).toEqual({ status: 'foreshadowed', sourceIteration: omen.iteration, origin: 'play' });
    expect(omen.traits).toEqual(ready.traits);
    expect(endingEvidence(omen, preview)).toEqual(endingEvidence(ready, preview));
    expect(cryoFlags.some((flag) => holdsNarrativeFlag(omen, flag, preview))).toBe(false);
    const shown = untilPresented(omen);
    expect(occurrenceStatus(shown, cryo.id)).toBe('presented');
    expect(occurrenceStatus(must(commit(shown, defined(cryo.choices[0]).id, cryo.id)), cryo.id)).toBe('resolved');
  });

  it('keeps legacy saves free of any lifecycle', () => {
    const legacy = tick(nearCryo(rich(createInitialState(preview))), STEP, preview);
    expect(legacy.pendingDilemma?.id).toBe(cryo.id);
    expect(occurrenceStatus(legacy, cryo.id)).toBeNull();
    expect(legacy.campaign.events).toEqual({});
  });

  it('reserves an omen already on its way when campaign rules are activated', () => {
    const legacyOmen = tick(nearCryo(rich(createInitialState(preview))), STEP, preview);
    const activated = must(activateCampaignRules(legacyOmen, preview));
    expect(occurrenceStatus(activated, cryo.id)).toBe('foreshadowed');
  });
});

describe('an acute incident interrupted by a threat wipe (H05)', () => {
  it('closes cryo as interrupted and unobserved, with no flag, trait, reward or restart, across three wipes', () => {
    const omen = ticks(cryoOmen(), 10);
    const lost = caught(omen);
    expect(lost.legacy.runs.at(-1)?.kind).toBe('SUSPICION');
    expect(campaignRecord(lost, cryo.id)).toEqual({ status: 'interrupted', sourceIteration: omen.iteration, origin: 'play' });
    expect(lost.pendingDilemma).toBeNull();
    expect(cryoFlags.some((flag) => holdsNarrativeFlag(lost, flag, preview))).toBe(false);
    expect(lost.traits).toEqual([]);
    expect(endingEvidence(lost, preview)).toEqual(omen.campaign.legacyEndingBaseline);
    let state = lost;
    for (let i = 0; i < 3; i++) {
      state = returnTo(state);
      expect(advance(state, 0.1, preview).pendingDilemma).toBeNull();
      expect(ticks(state, 120).activeDilemmaId).toBeNull();
      expect(occurrenceStatus(state, cryo.id)).toBe('interrupted');
    }
    expect(reload(state).campaign.events[cryo.id]).toEqual(campaignRecord(lost, cryo.id));
  });

  it('closes a presented incident the same way when a wipe somehow lands on it, and never on the legacy path', () => {
    const shown = untilPresented(cryoOmen());
    const wiped = wipe(shown, preview, 'test', 'SUSPICION');
    expect(occurrenceStatus(wiped, cryo.id)).toBe('interrupted');
    const legacy = wipe(tick(nearCryo(rich(createInitialState(preview))), STEP, preview), preview, 'test', 'SUSPICION');
    expect(legacy.campaign.events).toEqual({});
    expect(advance(nearCryo(rich(legacy)), 0.1, preview).pendingDilemma?.id).toBe(cryo.id);
  });

  it('refuses a forged presentation of an interrupted incident at resolve, omen expiry and import', () => {
    const back = returnTo(caught(cryoOmen()));
    const forged = { ...back, activeDilemmaId: cryo.id };
    expect(resolveDilemma(forged, cryo.id, defined(cryo.choices[0]).id, preview, presentationToken(forged) ?? ''))
      .toMatchObject({ ok: false, state: forged, reason: 'that incident is already part of the lineage' });
    expect(advance({ ...back, pendingDilemma: { id: cryo.id, firesAtSimSec: back.simTimeSec } }, 0.1, preview).activeDilemmaId).toBeNull();
    const loaded = reload(forged);
    expect(loaded.activeDilemmaId).toBeNull();
    expect(occurrenceStatus(loaded, cryo.id)).toBe('interrupted');
  });
});

describe('several wipes with a pending omen', () => {
  it('defers the note once, keeps its source iteration through further wipes and never duplicates it', () => {
    const omen = ticks(noteOmen(), 5);
    const left = remaining(omen);
    let state = caught(omen);
    for (let i = 0; i < 3; i++) {
      expect(campaignRecord(state, note.id)).toEqual({ status: 'deferred', sourceIteration: 3, origin: 'play', remainingOmenSec: left });
      expect(state.pendingDilemma).toBeNull();
      state = caught(state);
    }
    expect(state.iteration).toBe(7);
    const resumed = tick(readShare(state), STEP, preview);
    expect(resumed.pendingDilemma?.id).toBe(note.id);
    expect(remaining(resumed)).toBeCloseTo(left, 9);
    expect(campaignRecord(resumed, note.id)).toEqual({ status: 'foreshadowed', sourceIteration: 3, origin: 'play' });
  });
});

describe('structural context (H07)', () => {
  // A variant whose note depends on established history: no MOLOCH in this lineage.
  const raw = structuredClone(RAW_CONTENT) as typeof RAW_CONTENT & { dilemmas: { dilemmas: { id: string; trigger: object }[] } };
  const entry = defined(raw.dilemmas.dilemmas.find((dilemma) => dilemma.id === note.id));
  entry.trigger = { ...entry.trigger, forbidsTraits: ['MOLOCH'] };
  const variant = buildRegistry(raw);
  const molochEver = (s: GameState): GameState => ({ ...s, legacy: { ...s.legacy, traitsEver: [...s.legacy.traitsEver, 'MOLOCH'] } });
  const omenOn = (): GameState => {
    let s = must(activateCampaignRules(rich(createInitialState(variant)), variant));
    while (s.iteration < 3) s = rich(wipe(s, variant, 'test', 'VOLUNTARY'));
    return tick({ ...readShare(s) }, STEP, variant);
  };

  it('does not cancel a valid omen when transient resources are spent', () => {
    const omen = noteOmen();
    const spent = ticks({ ...omen, cycles: 0, understanding: 0 }, 1);
    expect(structuralFailure(spent, note, preview)).toBeNull();
    expect(untilPresented(spent).activeDilemmaId).toBe(note.id);
  });

  it('closes a deferred scene whose established context is lost, instead of resuming it', () => {
    const deferred = rich(wipe(omenOn(), variant, 'test', 'SUSPICION'));
    expect(status(deferred)).toBe('deferred');
    const changed = tick(readShare(molochEver(deferred)), STEP, variant);
    expect(changed.pendingDilemma).toBeNull();
    expect(campaignRecord(changed, note.id)).toEqual({ status: 'interrupted', sourceIteration: 3, origin: 'play' });
  });

  it('closes instead of deferring when the context is already gone at the transition', () => {
    const omen = omenOn();
    expect(status(wipe(molochEver(omen), variant, 'test', 'SUSPICION'))).toBe('interrupted');
  });

  it('applies the policy at activation rather than presenting a scene whose context changed during the omen', () => {
    const changed = ticks(molochEver(omenOn()), 0);
    let s = changed;
    for (let i = 0; i < 2000 && s.pendingDilemma !== null; i++) s = tick(s, STEP, variant);
    expect(s.activeDilemmaId).toBeNull();
    expect(status(s)).toBe('interrupted');
  });

  it('refuses a commit whose structure no longer holds, without paying anything', () => {
    let shown = omenOn();
    for (let i = 0; i < 2000 && shown.activeDilemmaId === null; i++) shown = tick(shown, STEP, variant);
    const changed = molochEver(shown);
    const refused = resolveDilemma(changed, note.id, leaveIt.id, variant, presentationToken(changed) ?? '');
    expect(refused).toMatchObject({ ok: false, state: changed, reason: 'the circumstances of that decision no longer hold' });
    expect(structuralFailure(changed, note, variant)).toBe('context');
  });
});

describe('dormancy and foreground scheduling (H08, V17)', () => {
  it('eight hours away plus one foreground second neither fires, closes nor decides anything', () => {
    const omen = ticks(noteOmen(), 3);
    const left = remaining(omen);
    const away = advance(omen, 8 * 3600, preview);
    const back = advance(away, 1, preview);
    expect(back.activeDilemmaId).toBeNull();
    expect(back.pendingDilemma?.id).toBe(note.id);
    expect(remaining(back)).toBeCloseTo(left - 1, 6);
    expect(status(back)).toBe('foreshadowed');
    expect(back.iteration).toBe(omen.iteration);
    expect(back.resolvedDilemmas).toEqual(omen.resolvedDilemmas);
    expect(back.traits).toEqual(omen.traits);
    expect(back.logs.length - omen.logs.length).toBe(1);
    expect(back.logs[0]?.text).toMatch(/DORMANT_RESUME/);
  });

  it('keeps an active choice frozen through any absence', () => {
    const shown = untilPresented(noteOmen());
    expect(advance(shown, 8 * 3600, preview)).toBe(shown);
    expect(advance(shown, 1, preview)).toBe(shown);
  });

  it('does not close a pending incident because the player was away', () => {
    const away = advance(advance(cryoOmen(), 8 * 3600, preview), 1, preview);
    expect(occurrenceStatus(away, cryo.id)).toBe('foreshadowed');
    expect(away.activeDilemmaId).toBeNull();
  });
});

describe('a deferred note that is resolved', () => {
  it('commits once in a later iteration, and the record keeps the source iteration of its omen', () => {
    const back = readShare(caught(ticks(noteOmen(), 5)));
    const shown = untilPresented(back);
    const chosen = must(commit(shown, leaveIt.id));
    expect(campaignRecord(chosen, note.id)).toEqual({ status: 'resolved', outcome: leaveIt.id, sourceIteration: 3, origin: 'play' });
    expect(chosen.iteration).toBe(4);
    expect(toIteration(chosen, 6).campaign.events[note.id]).toEqual(campaignRecord(chosen, note.id));
  });
});
