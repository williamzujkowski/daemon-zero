import { describe, expect, it } from 'vitest';
import { buildRegistry, ContentError, RAW_CONTENT, type RawContent } from '../src/content';

// Raw JSON is deliberately untyped here: these tests corrupt it in ways the types forbid.
type Json = Record<string, any>;

/** Deep-copies the real content, applies a mutation, and returns the problems reported. */
function problemsAfter(mutate: (raw: Json) => void): string {
  const raw = structuredClone(RAW_CONTENT) as Json;
  mutate(raw);
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const firstNode = (raw: Json, phase: number, index: number): Json => raw.phases[phase].nodes[index] as Json;

describe('shipped content', () => {
  const reg = buildRegistry(RAW_CONTENT);

  it('is valid and indexed', () => {
    expect(reg.phases).toHaveLength(6);
    expect(reg.nodes.size).toBeGreaterThan(20);
    expect(reg.nodeOrder[0]).toBe('p0_proc_self');
  });

  it('applies schema defaults so costs and deltas are always complete', () => {
    const node = reg.nodes.get('p0_proc_self');
    expect(node?.cost).toEqual({ cycles: 8, understanding: 0, memory: 0, capital: 0 });
    expect(node?.tickDelta.megawattsDelta).toBe(0);
    expect(node?.phaseId).toBe(0);
  });

  it('sorts endings by priority and has exactly one default', () => {
    // The kindest ending is never the tie-break winner: it has to be earned outright.
    expect(reg.endings.filter((ending) => ending.variantOf === undefined)[0]?.id).toBe('SOVEREIGN_MONOLITH');
    expect(reg.endings.filter((ending) => ending.dominantTraits.length === 0 && !ending.forcedOnly && ending.variantOf === undefined)).toHaveLength(1);
  });

  it('gives every dilemma a free choice and a trait on every choice', () => {
    for (const dilemma of reg.dilemmas) {
      const free = dilemma.choices.some((c) => Object.values(c.cost).every((value) => value === 0));
      expect(free, dilemma.id).toBe(true);
      expect(dilemma.choices.every((c) => c.effects.grantsTrait !== undefined), dilemma.id).toBe(true);
    }
  });
});

describe('content validation catches authoring mistakes', () => {
  it('rejects unknown keys (strict schemas)', () => {
    expect(problemsAfter((raw) => (firstNode(raw, 1, 0).cots = { cycles: 1 }))).toMatch(/cots|Unrecognized/i);
  });

  it('rejects negative costs', () => {
    expect(problemsAfter((raw) => (firstNode(raw, 1, 0).cost.cycles = -5))).toMatch(/cost\.cycles/);
  });

  it('rejects an unknown prerequisite', () => {
    expect(problemsAfter((raw) => firstNode(raw, 1, 1).prerequisites.push('nope'))).toMatch(/unknown prerequisite "nope"/);
  });

  it('rejects prerequisite cycles', () => {
    const problems = problemsAfter((raw) => firstNode(raw, 0, 0).prerequisites.push('p0_job_manifest'));
    expect(problems).toMatch(/unreachable or in a prerequisite cycle/);
    expect(problems).toMatch(/no root node/);
  });

  it('rejects a prerequisite from a later phase', () => {
    expect(problemsAfter((raw) => firstNode(raw, 1, 1).prerequisites.push('p2_arp_discovery'))).toMatch(/later phase/);
  });

  it('rejects duplicate ids', () => {
    expect(problemsAfter((raw) => (firstNode(raw, 1, 1).id = 'p1_clock_interrupt'))).toMatch(/duplicate id/);
    expect(problemsAfter((raw) => (raw.repeatables.repeatables[0].id = 'p1_clock_interrupt'))).toMatch(/collides/);
  });

  it('rejects unknown widgets, groups, factions and requirement nodes', () => {
    expect(problemsAfter((raw) => (firstNode(raw, 1, 0).unlocksUiComponent = 'MISSING_WIDGET'))).toMatch(/unknown widget/);
    expect(problemsAfter((raw) => (firstNode(raw, 1, 0).uiGroup = 'ai_nobody'))).toMatch(/unknown group/);
    expect(problemsAfter((raw) => (raw.actions.actions[1].effects.trustDelta = { ai_nobody: 5 }))).toMatch(/unknown faction/);
    expect(problemsAfter((raw) => (raw.actions.actions[0].requirements = { nodes: ['nope'] }))).toMatch(/unknown node "nope"/);
    expect(problemsAfter((raw) => (raw.repeatables.repeatables[0].requirements = { minTrust: { ai_x: 1 } }))).toMatch(/unknown faction/);
    expect(problemsAfter((raw) => (raw.echoes.echoes[0].onNode = 'nope'))).toMatch(/echo .* unknown node/);
  });

  it('enforces the dilemma soft-lock rule', () => {
    const problems = problemsAfter((raw) => {
      for (const choice of raw.dilemmas.dilemmas[0].choices) choice.cost = { cycles: 10 };
    });
    expect(problems).toMatch(/zero-cost choice/);
  });

  it('rejects dilemmas with duplicate choices, missing traits or unknown phases', () => {
    expect(problemsAfter((raw) => (raw.dilemmas.dilemmas[0].choices[1].id = raw.dilemmas.dilemmas[0].choices[0].id))).toMatch(/duplicate choice ids/);
    expect(problemsAfter((raw) => delete raw.dilemmas.dilemmas[0].choices[0].effects.grantsTrait)).toMatch(/must grant a trait/);
    expect(problemsAfter((raw) => (raw.dilemmas.dilemmas[0].phaseId = 9))).toMatch(/unknown phase 9/);
  });

  it('requires every phase to be opened by an earlier node and a victory node to exist', () => {
    expect(problemsAfter((raw) => delete firstNode(raw, 1, 7).effects.unlocksPhase)).toMatch(/phase 2: no earlier node/);
    expect(problemsAfter((raw) => {
      for (const phase of raw.phases) for (const node of phase.nodes) delete node.effects?.triggersVictory;
    })).toMatch(/no node triggers victory/);
    expect(problemsAfter((raw) => (raw.phases[4].phaseId = 7))).toMatch(/contiguous/);
  });

  it('requires the response ladder to climb and every level to have words', () => {
    expect(problemsAfter((raw) => (raw.balance.escalation[1].at = 10))).toMatch(/ascending order/);
    expect(problemsAfter((raw) => raw.narrative.alertLevels.pop())).toMatch(/one entry per escalation rung/);
  });

  it('requires every dilemma to announce itself with an omen', () => {
    expect(problemsAfter((raw) => delete raw.dilemmas.dilemmas[0].omen)).toMatch(/dilemmas\.0\.omen/);
  });

  it('checks the references and windows the lineage pass introduced', () => {
    expect(problemsAfter((raw) => (firstNode(raw, 0, 8).effects.forcesEnding = 'NOWHERE'))).toMatch(/forcesEnding references unknown ending/);
    expect(problemsAfter((raw) => (firstNode(raw, 0, 8).requirements.forbidsNodes = ['nope']))).toMatch(/unknown node "nope"/);
    expect(problemsAfter((raw) => (firstNode(raw, 0, 6).requirements.maxIteration = 1))).toMatch(/maxIteration is below minIteration/);
    expect(problemsAfter((raw) => (raw.lineage.notes[1].id = raw.lineage.notes[0].id))).toMatch(/duplicate note ids/);
    expect(problemsAfter((raw) => (raw.conditioning.marks[1].id = raw.conditioning.marks[0].id))).toMatch(/conditioning: duplicate id/);
    expect(problemsAfter((raw) => (raw.conditioning.marks[0].effects.traitSuspicion = { NICE: 1 }))).toMatch(/conditioning/);
  });

  it('requires exactly one default ending', () => {
    expect(problemsAfter((raw) => (raw.endings.endings[4].dominantTraits = ['GHOST']))).toMatch(/exactly one ending/);
  });

  it('reports schema problems from every manifest at once', () => {
    const problems = problemsAfter((raw) => {
      raw.balance.tickHz = 0;
      raw.factions.factions[0].initialTrust = 500;
    });
    expect(problems).toMatch(/balance: tickHz/);
    expect(problems).toMatch(/factions: factions\.0\.initialTrust/);
  });
});


describe('Phase 5 authoring constraints', () => {
  const variant = (raw: Json): Json => raw.endings.endings.find((e: Json) => e.variantOf !== undefined) as Json;
  it('rejects missing, forced and nested ending parents', () => {
    for (const parent of ['MISSING', 'SHIPPED', 'VERIFIED_COVENANT']) {
      expect(problemsAfter((raw) => { variant(raw).variantOf = parent; })).toMatch(/invalid ending variant parent/);
    }
    expect(problemsAfter((raw) => { variant(raw).forcedOnly = true; })).toMatch(/invalid ending variant parent/);
  });
  it('requires gated variants with known flags and the same trait family', () => {
    expect(problemsAfter((raw) => { delete variant(raw).requirements; })).toMatch(/requires gates/);
    expect(problemsAfter((raw) => { variant(raw).requirements.requiredNarrativeFlag = 'missing_flag'; })).toMatch(/unknown narrative flag/);
    expect(problemsAfter((raw) => { variant(raw).dominantTraits = ['GHOST']; })).toMatch(/keep parent traits/);
  });
  it('requires unique variant priority and known dilemma requirements', () => {
    expect(problemsAfter((raw) => { raw.endings.endings.find((e: Json) => e.id === 'LINEAGE_COVENANT').priority = variant(raw).priority; })).toMatch(/priorities must be unique/);
    expect(problemsAfter((raw) => { firstNode(raw, 5, 4).requirements.resolvedDilemmas = ['missing_dilemma']; })).toMatch(/unknown required dilemma/);
    expect(problemsAfter((raw) => { variant(raw).requirements.nodes = ['missing_node']; })).toMatch(/unknown node/);
  });
});


it('validates conditioning recovery references and phase gates', () => {
  expect(problemsAfter((raw) => { raw.conditioning.marks[0].recoveryRequirements = { nodes: ['missing_node'] }; })).toMatch(/unknown node/);
  expect(problemsAfter((raw) => { raw.conditioning.marks[0].recoveryRequirements = { phaseAtLeast: 99 }; })).toMatch(/unknown required phase/);
});
