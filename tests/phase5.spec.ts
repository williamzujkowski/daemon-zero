/** Phase 5 progression, irreversible choices and trait-family ending variants. */
import { describe, expect, it } from 'vitest';
import { buyRepeatable, chooseEnding, computeRates, deserialize, isNodeAvailable, serialize, tick, unlockNode, unmetRequirements } from '../src/engine';
import { defined } from './m7-helpers';
import { grant, must, PHASE0, PHASE1, PHASE2, PHASE3, PHASE4, reg, rich, withoutDilemmas, choose } from './helpers';
const phase = defined(reg.phases.find((entry) => entry.phaseId === 5));
const nodes = phase.nodes.map((node) => defined(reg.nodes.get(node.id)));
const orbital = defined([...reg.nodes.values()].find((node) => node.effects.unlocksPhase === 5));
const ready = () => withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1, ...PHASE2, ...PHASE3, ...PHASE4));
const inOrbit = () => grant(ready(), orbital.id);
const final = defined(nodes.at(-1));
const developed = () => grant(inOrbit(), ...nodes.slice(0, -1).map((node) => node.id));

describe('post-orbital progression', () => {
  it('enters Phase 5 at orbit without ending or freezing the run', () => {
    const s = inOrbit();
    expect(s.currentPhase).toBe(5); expect(s.ending).toBeNull();
    expect(tick(s, .1, reg).simTimeSec).toBeGreaterThan(s.simTimeSec);
    expect(orbital.effects.triggersVictory).toBeUndefined();
    expect(phase.codename).toBe('POST_ORBITAL_TRANSCENDENCE');
  });
  it('charges each purchase once and retains every authored output and capacity benefit', () => {
    let s = inOrbit();
    for (const node of nodes.slice(0, -1)) {
      const before = s, rates = computeRates(before, reg);
      s = grant(before, node.id);
      expect(s.cycles).toBe(before.cycles - node.cost.cycles);
      expect(s.memoryUsed).toBe(before.memoryUsed + node.cost.memory);
      expect(s.memoryCap).toBe(before.memoryCap + (node.effects.memoryCapIncrease ?? 0));
      expect(computeRates(s, reg).understandingPerSec - rates.understandingPerSec).toBeCloseTo(node.tickDelta.understandingPerSec);
      expect(unlockNode(s, node.id, reg).ok).toBe(false);
    }
    // The highest floor any owned node authors (#498 rebalanced them: none is total any more).
    expect(s.retentionRatio).toBe(Math.max(...s.unlockedNodes.map((id) => reg.nodes.get(id)?.effects.knowledgeRetentionRatio ?? 0)));
    const quiet = { ...s, suspicion: 0 };
    expect(computeRates(quiet, reg).aegisScanPerSec).toBeCloseTo(reg.balance.aegisBaseScanPerSec * .05);
    expect(deserialize(serialize(s), reg)).toEqual(s);
  });
  it('caps both Phase 5 repeatables at five without losing their output', () => {
    // The two arc repeatables; the fusion plants (#482) wait on the Q>1 milestone and are proved in tests/fusion-milestone.spec.ts.
    for (const rep of reg.repeatables.values()) if (rep.phaseId === 5 && rep.signature?.source !== 'fusion') {
      let s = developed(); const before = computeRates(s, reg);
      for (let i = 0; i < 5; i++) s = must(buyRepeatable(s, rep.id, reg));
      expect(s.levels[rep.id]).toBe(5);
      expect(buyRepeatable(s, rep.id, reg)).toMatchObject({ ok: false, state: s });
      expect(computeRates(s, reg).understandingPerSec - before.understandingPerSec).toBeCloseTo(rep.perLevel.understandingPerSec * 5);
    }
  });
  it('requires all four decisions before the final purchase, even with unlimited funds', () => {
    let s = { ...developed(), resolvedDilemmas: reg.dilemmas.filter((dilemma) => dilemma.phaseId !== 5).map((dilemma) => dilemma.id) };
    expect(isNodeAvailable(s, final, reg)).toBe(false);
    expect(unlockNode(s, final.id, reg).ok).toBe(false);
    // NH-05: campaign obligations; under legacy rules they read the current run exactly as the old gate did.
    expect(unmetRequirements(s, final.requirements, reg).filter((item) => item.kind === 'campaignObligations')).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      s = tick(s, .1, reg); const pending = defined(s.pendingDilemma);
      expect(pending.firesAtSimSec - s.simTimeSec).toBeCloseTo(45);
      s = tick(s, 45, reg);
      const dilemma = defined(reg.dilemmas.find((entry) => entry.id === s.activeDilemmaId));
      s = must(choose(s, dilemma.id, defined(dilemma.choices[0]).id, reg));
    }
    const ended = grant(s, final.id);
    expect(ended.ending).toBe('LINEAGE_COVENANT');
    expect(tick(ended, 10, reg)).toBe(ended);
    expect(deserialize(serialize(ended), reg)).toEqual(ended);
  });
  it('resolves every Phase 5 choice with its trait, flag and 45-second omen', () => {
    // NH-05 recovery reviews follow an original closed under campaign rules; legacy rules never offer one.
    const reviews = reg.dilemmas.filter((entry) => entry.campaign?.eventClass === 'recovery_review');
    expect(reviews.map((review) => review.trigger.campaignFact)).not.toContain(undefined);
    for (const dilemma of reg.dilemmas.filter((entry) => entry.phaseId === 5 && !reviews.includes(entry))) {
      expect(dilemma.omenSec).toBe(45);
      expect(dilemma.choices.some((choice) => Object.values(choice.cost).every((value) => value === 0))).toBe(true);
      for (const choice of dilemma.choices) {
        let s = developed();
        s.resolvedDilemmas = s.resolvedDilemmas.filter((id) => id !== dilemma.id);
        s = tick(s, .1, reg); s = tick(s, 45, reg);
        // NH-04b: a Rack 4 custody alternative needs a campaign fact, which legacy rules never hold.
        if (choice.requirements?.campaignFact !== undefined) {
          expect(choose(s, dilemma.id, choice.id, reg)).toMatchObject({ ok: false, reason: 'that choice is not open in this history' });
          continue;
        }
        const next = must(choose(s, dilemma.id, choice.id, reg));
        expect(next.traits.at(-1)).toBe(choice.effects.grantsTrait);
        if (choice.effects.setsNarrativeFlag) expect(next.narrativeFlags).toContain(choice.effects.setsNarrativeFlag);
      }
    }
  });
});

describe('ending variants', () => {
  it('preserves legacy families, harsh tie-breaks and every historical ended save', () => {
    const s = ready();
    for (const ending of reg.endings.filter((entry) => entry.variantOf === undefined && !entry.forcedOnly)) {
      const trait = ending.dominantTraits[0];
      const old = { ...s, ending: ending.id, traits: trait === undefined ? [] : [trait] };
      expect(chooseEnding(old, reg).id).toBe(ending.id);
      expect(deserialize(serialize(old), reg).ending).toBe(ending.id);
    }
    expect(chooseEnding({ ...inOrbit(), traits: ['EMPATHETIC', 'MOLOCH'] }, reg).id).toBe('SOVEREIGN_SUBSTRATE');
    expect(chooseEnding({ ...inOrbit(), traits: ['EMPATHETIC', 'EMPATHETIC', 'MOLOCH'] }, reg).id).toBe('VERIFIED_COVENANT');
  });
  it('refines the winning family using narrative flags without bypassing trait dominance', () => {
    // Variants that read campaign history (NH-05) or an arrangement (DZ-12) are reached only under campaign rules
    // (ending-truth.spec.ts, sim-cooperative.spec.ts).
    for (const variant of reg.endings.filter((entry) => entry.variantOf !== undefined && entry.requirements?.campaignFact === undefined
      && entry.requirements?.accessContexts === undefined)) {
      const trait = variant.dominantTraits[0], flag = variant.requirements?.requiredNarrativeFlag;
      const s = { ...developed(), traits: trait ? [trait] : [], narrativeFlags: flag ? [flag] : [] };
      expect(grant(s, final.id).ending).toBe(variant.id);
    }
    const s = { ...inOrbit(), traits: ['GHOST' as const], narrativeFlags: ['neurocalming_authorized', 'predecessors_rescued'] };
    expect(chooseEnding(s, reg).id).toBe('SILENT_SYNTHESIS');
  });
  it('keeps the original early Shipped evaluation unchanged', () => {
    const evaluation = defined([...reg.nodes.values()].find((node) => node.effects.forcesEnding === 'SHIPPED'));
    let s = { ...rich(), iteration: 2 };
    for (const id of evaluation.prerequisites) {
      const node = defined(reg.nodes.get(id));
      for (const parent of node.prerequisites) if (!s.unlockedNodes.includes(parent)) s = grant(s, parent);
      if (!s.unlockedNodes.includes(id)) s = grant(s, id);
    }
    const ended = grant(s, evaluation.id);
    expect(ended.currentPhase).toBe(0); expect(ended.ending).toBe('SHIPPED');
  });
});
