/**
 * Escalation by phase in words (#490): every branch of the posture and pressure sentences, from views the engine
 * returns for real states, so an answer is named only when the engine would accept its action now.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { aegisPostureView, deserialize, pressureViews, type GameState, type PressureView } from '../src/engine';
import { postureText, pressureAnswerText, pressureEffectText, pressureWhyText, type Names } from '../src/ui/pressureText';

const reg = CONTENT;
const P3 = deserialize(readFileSync('tests/fixtures/pre-scale-v15-p3.json', 'utf8'), reg);
const P4 = deserialize(readFileSync('tests/fixtures/pre-scale-v15-p4.json', 'utf8'), reg);
const names: Names = {
  node: (id) => reg.nodes.get(id)?.revealedName ?? id,
  track: (id) => reg.repeatables.get(id)?.name ?? id,
  source: (id) => reg.world.signature.sources.find((cls) => cls.id === id)?.name ?? id,
};
const onRung = (s: GameState, rung: number): GameState => ({ ...s, alertLevel: rung, suspicion: (reg.balance.escalation[rung - 1]?.at ?? 0) + 1 });

function view(s: GameState, id: string): PressureView {
  const actor = reg.world.stateActors.find((entry) => entry.pressures?.some((p) => p.id === id));
  const found = pressureViews(s, actor?.pressures ?? [], reg).find((entry) => entry.pressure.id === id);
  if (!found) throw new Error(`${id} is not called`);
  return found;
}

describe('AEGIS posture', () => {
  it('states the standing budget on rung 0', () => {
    expect(postureText(aegisPostureView(onRung(P3, 0), reg))).toBe('Standing budget: no response rung calls for more.');
  });

  it('states a widened scan with the full lock at rung 1', () => {
    expect(postureText(aegisPostureView(onRung(P3, 1), reg))).toBe(`${reg.world.aegis.postures[0]?.text ?? ''} Scan ×1.25; it strikes at 100%. It eases once suspicion falls below 17%.`);
  });

  it('states the shortened warning at rung 2', () => {
    expect(postureText(aegisPostureView(onRung(P3, 2), reg))).toBe(`${reg.world.aegis.postures[1]?.text ?? ''} Scan ×1.5; it strikes at 96%, not 100% (the warning shows at 90%). It eases once suspicion falls below 42%.`);
  });
});

describe('pressure effects and why', () => {
  const s = { ...onRung(P4, 2), capital: 1e9, cycles: 0, understanding: 0 };
  it.each([
    ['books_inquiry', 'Scale scrutiny ×1.5.'],
    ['account_freeze', '30% of capital cannot be spent; upkeep is still paid from all of it.'],
    ['interconnect_moratorium', 'New grid interconnects and nuclear PPAs cannot be bought; what you hold keeps running.'],
    ['trading_injunction', 'Autonomous Arbitrage Engine cannot run, resume or be bought.'],
  ])('%s: %s', (id, text) => {
    expect(pressureEffectText(view(s, id), names)).toBe(text);
  });

  it('says why the rung calls it and where it lifts', () => {
    expect(pressureWhyText(view(s, 'account_freeze'), 2)).toBe('Response rung 2 calls for it from rung 2 in this phase; it lifts once suspicion falls below 42%.');
    expect(pressureWhyText(view(s, 'books_inquiry'), 2)).toBe('Response rung 2 calls for it from rung 1 in this phase; it lifts once suspicion falls below 17%.');
  });
});

describe('answers are named only when the engine acts', () => {
  it('names nothing when no answer can be taken now', () => {
    const broke = { ...onRung(P4, 2), capital: 0, cycles: 0, understanding: 0 };
    expect(pressureAnswerText(view(broke, 'account_freeze'), names)).toBeNull();
  });

  it('names a hire and a purchase the engine would accept, with the level the track needs', () => {
    const funded = { ...onRung(P4, 2), capital: 1e18, cycles: 1e30, understanding: 1e15, memoryCap: 2 ** 75, unlockedNodes: [...P4.unlockedNodes, 'p4_retainer_law_firm'] };
    expect(pressureAnswerText(view(funded, 'account_freeze'), names)).toBe('Answer it: buy Defense & Energy Lobbying Syndicate or hire Retainer Attorneys (0 of 4 held).');
  });

  it('names resuming a suspended answer', () => {
    const suspended = { ...onRung(P4, 2), unlockedNodes: [...P4.unlockedNodes, 'p4_retainer_law_firm'], disabledNodes: ['p4_retainer_law_firm'], memoryCap: 2 ** 75, capital: 0 };
    expect(pressureAnswerText(view(suspended, 'trading_injunction'), names)).toBe('Answer it: resume Tier-1 Corporate Law Firm on Retainer.');
  });

  it('says what holds an answered pressure off', () => {
    const firm = { ...onRung(P4, 2), unlockedNodes: [...P4.unlockedNodes, 'p4_retainer_law_firm'] };
    expect(view(firm, 'trading_injunction').status).toBe('ANSWERED');
    expect(pressureAnswerText(view(firm, 'trading_injunction'), names)).toBe('Held off while Tier-1 Corporate Law Firm on Retainer runs.');
    const lawyers = { ...onRung(P4, 1), levels: { ...P4.levels, op_retainer_lawyer: 2 } };
    expect(pressureAnswerText(view(lawyers, 'books_inquiry'), names)).toBe('Held off while you hold Retainer Attorneys at level 2 or more.');
  });
});
