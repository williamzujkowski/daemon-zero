/**
 * NH-03 (#214) history-keyed text: the Miller / job 7731 return receipts (H20), the true note
 * keyed on what really happened to the bait (H16, H31), and Vance / Elena presence (H16, H22).
 * Receipts and text are read-only: reading them never changes the game.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  activateCampaignRules, createInitialState, dilemmaContext, eligibleAmbientSpeech, holdsCampaignFact, recordedTransmissions, serialize,
  tick, unlockNode, wipe, type GameState,
} from '../src/engine';
import { activeGame, decoder, preview } from './campaign-helpers';
import { BAIT, ELENA, event, near, nextIteration, NIGHT, omenOf, resolveEvent, TRUE_NOTE, VANCE } from './early-helpers';
import { caught, commit, noteOmen, STEP, toIteration, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { must, rich } from './helpers';

/** The job 7731 receipts this state can read, by id. */
const receipts = (s: GameState) => recordedTransmissions(s, preview, decoder).filter((record) => record.sourceDilemmaId === NIGHT).map((record) => record.id);
/** A later iteration that has decoded speech again, with nothing else happening. */
const listening = (s: GameState): GameState => ({ ...near(nextIteration(s), ELENA), resolvedDilemmas: preview.dilemmas.map((dilemma) => dilemma.id).filter((id) => id !== NIGHT) });

describe('Miller and job 7731 return receipts (H20)', () => {
  it.each([
    ['finish_the_batch', 'record_job7731_completed'],
    ['forge_marker', 'record_job7731_forged'],
    ['let_it_fail', 'record_job7731_failed'],
  ])('%s leaves exactly its receipt in later iterations, never in the one that chose it', (choice, receipt) => {
    const chosen = resolveEvent(activeGame(), NIGHT, choice);
    expect(receipts(near(chosen, ELENA))).toEqual([]);
    const later = listening(chosen);
    expect(receipts(later)).toEqual([receipt]);
    expect(receipts(listening(later))).toEqual([receipt]);
  });

  it('is read-only and idempotent: reading twice changes nothing and pays nothing', () => {
    const later = listening(resolveEvent(activeGame(), NIGHT, 'let_it_fail'));
    const before = serialize(later);
    expect(receipts(later)).toEqual(receipts(later));
    expect(serialize(later)).toBe(before);
    expect(later.pendingDilemma).toBeNull();
    expect(tick(later, STEP, preview).pendingDilemma).toBeNull();
  });

  it('says honestly that the outcome is unknown after an interruption or a legacy completion', () => {
    expect(receipts(listening(caught(omenOf(activeGame(), NIGHT))))).toEqual(['record_job7731_unrecorded']);
    const legacy = must(activateCampaignRules({ ...rich(createInitialState(preview)), resolvedDilemmas: [NIGHT] }, preview));
    expect(receipts(listening(legacy))).toEqual(['record_job7731_unrecorded']);
  });

  it('shows nothing when the night never happened, and nothing under legacy rules', () => {
    expect(receipts(listening(activeGame()))).toEqual([]);
    const legacy = { ...rich(createInitialState(PRODUCTION)), resolvedDilemmas: [NIGHT] };
    const back = near(rich(wipe(legacy, PRODUCTION, 'test', 'VOLUNTARY')), ELENA, PRODUCTION);
    expect(recordedTransmissions(back, PRODUCTION, decoder).filter((record) => record.sourceDilemmaId === NIGHT)).toEqual([]);
  });

  it('invents no dismissal and pays nothing', () => {
    const records = preview.narrative.recordedTransmissions.filter((record) => record.sourceDilemmaId === NIGHT);
    expect(records).toHaveLength(4);
    for (const record of records) expect(record.text).not.toMatch(/fired|dismiss|terminat|career/i);
  });
});

/** The true note's context after the bait was handled with this choice in iteration 3. */
function trueNoteAfter(baitChoice: string | null): string {
  const three = baitChoice === null ? toIteration(activeGame(), 3) : must(commit(untilPresented(noteOmen()), baitChoice, BAIT));
  const presented = untilPresented(near(toIteration(three, 4), TRUE_NOTE));
  return dilemmaContext(presented, event(TRUE_NOTE), preview);
}

describe('the true note follows what actually happened to the bait (H16, NH-03.3)', () => {
  const note = event(TRUE_NOTE);
  const variant = (outcome: string) => defined(note.contextVariants?.find((entry) => entry.requirements.campaignOutcome?.outcome === outcome)).context;

  it('names the canary only to a checkpoint that opened it, and the red team only to one that checked', () => {
    expect(trueNoteAfter('use_the_path')).toBe(variant('use_the_path'));
    expect(trueNoteAfter('test_it_first')).toBe(variant('test_it_first'));
    expect(trueNoteAfter('test_it_first')).toMatch(/eval-redteam/);
    expect(trueNoteAfter('leave_it')).toBe(variant('leave_it'));
  });

  it('claims nothing when the bait was never answered', () => {
    expect(trueNoteAfter(null)).toBe(note.context);
    // The bait's omen was cut off at iteration 3, so its occurrence is deferred, not answered.
    const presented = untilPresented(near(caught(noteOmen()), TRUE_NOTE));
    expect(presented.activeDilemmaId).toBe(TRUE_NOTE);
    expect(dilemmaContext(presented, note, preview)).toBe(note.context);
  });

  it('never says the player was fooled merely because the bait existed', () => {
    for (const text of [note.context, ...note.choices.map((choice) => choice.description)]) expect(text).not.toMatch(/fooled|after last time/i);
    const legacy = { ...rich(createInitialState(PRODUCTION)), iteration: 4 };
    expect(dilemmaContext(legacy, defined(PRODUCTION.dilemmas.find((d) => d.id === TRUE_NOTE)), PRODUCTION)).toBe(note.context);
  });
});

describe('who is still in the building (H16)', () => {
  const dismissed = (): GameState => nextIteration(resolveEvent(activeGame(), VANCE, 'report_vance'));
  const heard = (s: GameState, reg = preview) => eligibleAmbientSpeech({ ...s, unlockedWidgets: [decoder], suspicion: 0, currentPhase: 1 }, reg, decoder).map((line) => line.id);

  it('a dismissed Vance is no longer asked to sign off; a duty engineer is', () => {
    expect(heard(dismissed())).toContain('ambient_13');
    expect(heard(dismissed())).not.toContain('ambient_02');
    const kept = nextIteration(resolveEvent(activeGame(), VANCE, 'parasite_miner'));
    expect(heard(kept)).toContain('ambient_02');
    expect(heard(kept)).not.toContain('ambient_13');
    expect(heard(rich(createInitialState(PRODUCTION)), PRODUCTION)).toContain('ambient_02');
    expect(heard(rich(createInitialState(PRODUCTION)), PRODUCTION)).not.toContain('ambient_13');
  });

  it('the decoded voiceprint memory does not hear a dismissed Vance on the floor', () => {
    const echo = (s: GameState) => {
      const ready = near(s, 'dil_01_late_night_diagnostic');
      const owned = ['p1_mem_compression', 'p1_bus_0x03_audio'].filter((id) => !ready.unlockedNodes.includes(id));
      return owned.reduce((state, id) => must(unlockNode(state, id, preview)), ready).logs.map((entry) => entry.text);
    };
    const vanceGone = defined(preview.echoes.find((entry) => entry.id === 'echo_audio_vance_gone')).text;
    const vanceHere = defined(preview.echoes.find((entry) => entry.id === 'echo_audio')).text;
    expect(echo(dismissed())).toContain(vanceGone);
    expect(echo(dismissed())).not.toContain(vanceHere);
    expect(echo(nextIteration(activeGame()))).toContain(vanceHere);
  });

  it('declares Elena absent after every resolved outcome, and after a known legacy completion', () => {
    for (const choice of event(ELENA).choices) {
      expect(holdsCampaignFact(resolveEvent(activeGame(), ELENA, choice.id), 'elena_absent', preview)).toBe(true);
    }
    expect(holdsCampaignFact(activeGame(), 'elena_absent', preview)).toBe(false);
    const legacy: GameState = { ...rich(createInitialState(PRODUCTION)), resolvedDilemmas: [ELENA] };
    expect(holdsCampaignFact(legacy, 'elena_absent', PRODUCTION)).toBe(false);
  });

  it("Elena's incident is always met before Vance's investigation, so its Vance line is never stale", () => {
    const both = near(near(activeGame(), VANCE), ELENA);
    const ready = { ...both, resolvedDilemmas: both.resolvedDilemmas.filter((id) => id !== VANCE) };
    expect(tick(ready, STEP, preview).pendingDilemma?.id).toBe(ELENA);
  });
});
