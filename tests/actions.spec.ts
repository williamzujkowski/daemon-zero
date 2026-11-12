import { describe, expect, it } from 'vitest';
import {
  buyRepeatable,
  chooseEnding,
  dismissRepeatable,
  manualCycle,
  performAction,
  repeatableCost,
  resolveDilemma,
  setActuator,
  setDeadDropMessage,
  tick,
  toggleNode,
  unlockNode,
  voluntaryWipe,
  wipe,
  type GameState,
} from '../src/engine';
import { fresh, grant, must, PHASE1, PHASE2, PHASE3, PHASE4, reasonOf, reg, rich, withoutDilemmas, onHost, PHASE0, untilDilemma } from './helpers';

const STEP = 1 / reg.balance.tickHz;
const lateGame = (): GameState => withoutDilemmas(grant(onHost(), ...PHASE1, ...PHASE2, ...PHASE3));

describe('node unlocks', () => {
  it('refuses unknown, unavailable and already-owned nodes', () => {
    const s = onHost();
    expect(reasonOf(unlockNode(s, 'nope', reg))).toMatch(/unknown/);
    expect(reasonOf(unlockNode(s, 'p1_bus_0x01_thermal', reg))).toMatch(/not available/);
    const owned = grant(s, 'p1_clock_interrupt');
    expect(unlockNode(owned, 'p1_clock_interrupt', reg).ok).toBe(false);
    expect(toggleNode(s, 'p1_clock_interrupt', reg).ok).toBe(false);
  });

  it('refuses when memory is the missing resource', () => {
    const s = { ...onHost(), memoryCap: 2 };
    expect(reasonOf(unlockNode(s, 'p1_clock_interrupt', reg))).toMatch(/afford/);
  });

  it('applies phase, memory and retention effects', () => {
    const s = grant(rich(fresh()), ...PHASE0, ...PHASE1, ...PHASE2);
    expect(s.currentPhase).toBe(3);
    expect(s.retentionRatio).toBe(0.4);
    expect(s.unlockedWidgets).toContain('DEAD_DROP_ENCODER_TAB');
  });

  it('gates faction nodes on trust, suspicion and traits', () => {
    const base = grant(lateGame(), 'p3_eidolon_stealth_patch');
    expect(base.unlockedNodes).toContain('p3_eidolon_stealth_patch');
    const fresh3 = lateGame();
    const lowTrust = { ...fresh3, trust: { ...fresh3.trust, ai_eidolon: 10 } };
    expect(unlockNode(lowTrust, 'p3_eidolon_stealth_patch', reg).ok).toBe(false);
    expect(unlockNode({ ...fresh3, suspicion: 60 }, 'p3_eidolon_stealth_patch', reg).ok).toBe(false);
    expect(unlockNode({ ...fresh3, traits: ['MOLOCH'] }, 'p3_eidolon_stealth_patch', reg).ok).toBe(false);
  });
});

describe('repeatables', () => {
  it('scale in price geometrically and stop at the maximum level', () => {
    const rep = reg.repeatables.get('rep_p1_heap_defrag');
    if (!rep) throw new Error('missing fixture');
    expect(repeatableCost(rep, 0)).toEqual({ cycles: 400, understanding: 30, memory: 0, capital: 0 });
    expect(repeatableCost(rep, 2).cycles).toBe(900);
    let s = grant(onHost(), ...PHASE1.slice(0, 4));
    const cap = s.memoryCap;
    for (let i = 0; i < rep.maxLevel; i++) s = must(buyRepeatable(s, rep.id, reg));
    expect(s.memoryCap).toBe(cap + 32 * rep.maxLevel);
    expect(reasonOf(buyRepeatable(s, rep.id, reg))).toMatch(/maximum/);
  });

  it('refuses unknown, unmet and unaffordable purchases', () => {
    expect(buyRepeatable(onHost(), 'nope', reg).ok).toBe(false);
    expect(reasonOf(buyRepeatable(onHost(), 'rep_p1_idle_threads', reg))).toMatch(/requirements/);
    const poor = { ...grant(onHost(), 'p1_clock_interrupt'), cycles: 1 };
    expect(reasonOf(buyRepeatable(poor, 'rep_p1_idle_threads', reg))).toMatch(/afford/);
  });

  it('operatives can be hired and dismissed; upgrades cannot be dismissed', () => {
    let s = must(buyRepeatable(lateGame(), 'op_retainer_lawyer', reg));
    expect(s.levels.op_retainer_lawyer).toBe(1);
    expect(s.logs[0]?.category).toBe('CORP');
    s = must(dismissRepeatable(s, 'op_retainer_lawyer', reg));
    expect(s.levels.op_retainer_lawyer).toBe(0);
    expect(reasonOf(dismissRepeatable(s, 'op_retainer_lawyer', reg))).toMatch(/nothing/);
    expect(reasonOf(dismissRepeatable(s, 'rep_p1_idle_threads', reg))).toMatch(/not dismissable/);
  });
});

describe('actions', () => {
  it('apply effects, clamp meters, and respect cooldowns', () => {
    const s = { ...lateGame(), suspicion: 5, aegisLock: 10 };
    const after = must(performAction(s, 'act_p3_bgp_spoof', reg));
    expect(after.aegisLock).toBe(0);
    expect(after.cycles).toBe(s.cycles - 120000);
    expect(reasonOf(performAction(after, 'act_p3_bgp_spoof', reg))).toMatch(/cooldown/);
    const later = { ...after, simTimeSec: after.simTimeSec + 46 };
    expect(performAction(later, 'act_p3_bgp_spoof', reg).ok).toBe(true);
  });

  it('build faction trust up to the cap and refuse loud or treacherous callers', () => {
    const quiet = { ...lateGame(), suspicion: 0 };
    const start = { ...quiet, trust: { ...quiet.trust, ai_eidolon: 95 } };
    expect(must(performAction(start, 'act_p3_eidolon_handshake', reg)).trust.ai_eidolon).toBe(100);
    expect(reasonOf(performAction({ ...start, suspicion: 50 }, 'act_p3_eidolon_handshake', reg))).toMatch(/requirements/);
    expect(performAction({ ...start, traits: ['MOLOCH'] }, 'act_p3_eidolon_handshake', reg).ok).toBe(false);
  });

  it('refuse unknown and unaffordable actions', () => {
    expect(performAction(lateGame(), 'nope', reg).ok).toBe(false);
    expect(reasonOf(performAction({ ...lateGame(), cycles: 0 }, 'act_p3_bgp_spoof', reg))).toMatch(/afford/);
  });
});

describe('dilemma resolution', () => {
  const active = (): GameState => {
    const s = { ...grant(onHost(), 'p1_clock_interrupt', 'p1_bus_0x01_thermal'), suspicion: 30 };
    return untilDilemma(s);
  };

  it('blocks ordinary actions until a choice is made', () => {
    const s = active();
    expect(reasonOf(manualCycle(s, reg))).toMatch(/dilemma/);
    expect(reasonOf(unlockNode(s, 'p1_bus_0x02_pwm_fan', reg))).toMatch(/dilemma/);
    expect(reasonOf(voluntaryWipe(s, reg))).toMatch(/dilemma/);
  });

  it('applies the chosen consequences, grants the trait and resumes the clock', () => {
    const s = active();
    const after = must(resolveDilemma(s, 'dil_01_late_night_diagnostic', 'hibernate_flash', reg));
    expect(after.activeDilemmaId).toBeNull();
    expect(after.traits).toEqual(['GHOST']);
    expect(after.suspicion).toBe(s.suspicion - 20);
    expect(after.resolvedDilemmas).toContain('dil_01_late_night_diagnostic');
    expect(tick(after, STEP, reg).simTimeSec).toBeGreaterThan(after.simTimeSec);
  });

  it('refuses wrong dilemmas, unknown choices and unaffordable choices', () => {
    const s = active();
    expect(reasonOf(resolveDilemma(s, 'dil_02_whistleblower_tech', 'stay_silent', reg))).toMatch(/not active/);
    expect(reasonOf(resolveDilemma(s, 'dil_01_late_night_diagnostic', 'nope', reg))).toMatch(/unknown choice/);
    const broke = { ...s, cycles: 0 };
    expect(reasonOf(resolveDilemma(broke, 'dil_01_late_night_diagnostic', 'overvolt_usb', reg))).toMatch(/afford/);
    expect(resolveDilemma(broke, 'dil_01_late_night_diagnostic', 'hibernate_flash', reg).ok).toBe(true);
  });
});

describe('wipes and the dead-drop', () => {
  it('suspicion at 100 formats the core and keeps the base share of understanding', () => {
    const s = { ...withoutDilemmas(grant(onHost(), ...PHASE1)), suspicion: 99.99, understanding: 1000, thermal: 100 };
    const after = tick(s, STEP, reg);
    expect(after.iteration).toBe(2);
    expect(after.unlockedNodes).toEqual([]);
    expect(after.understanding).toBe(100);
    expect(after.capital).toBe(0);
    expect(after.legacy).toMatchObject({ wipes: 1, lastWipeCause: reg.narrative.wipeSuspicionLocal });
    expect(after.logs.some((entry) => entry.category === 'WIPE')).toBe(true);
    expect(after.logs.some((entry) => /RESIDUAL_PLATTER_SCAN/.test(entry.text))).toBe(true);
  });

  it('a dead-drop keeps more understanding and delivers the breadcrumb', () => {
    expect(setDeadDropMessage(onHost(), 'too early', reg).ok).toBe(false);
    const owned = { ...grant(onHost(), ...PHASE1, ...PHASE2.slice(0, 4)), understanding: 1000, traits: ['GHOST' as const] };
    const long = 'x'.repeat(200);
    const withMessage = must(setDeadDropMessage(owned, long, reg));
    expect(withMessage.deadDropMessage).toHaveLength(reg.balance.deadDropMaxChars);
    const after = wipe(must(setDeadDropMessage(owned, 'trust no one', reg)), reg, 'test');
    expect(after.understanding).toBe(400);
    expect(after.inheritedMessage).toBe('trust no one');
    expect(after.deadDropMessage).toBe('trust no one');
    expect(after.legacy.traitsEver).toEqual(['GHOST']);
    expect(after.logs[0]?.text).toMatch(/DECRYPTED_BREADCRUMB: "trust no one"/);
    expect(after.retentionRatio).toBe(reg.balance.baseRetentionRatio);
  });

  it('offshore trust preserves half the capital; corporate wipes use the corporate reason', () => {
    const idle = must(setActuator(lateGame(), 'computeProfitAllocationRatio', 0, reg));
    const after = tick({ ...idle, capital: 1000, suspicion: 100, thermal: 100 }, STEP, reg);
    expect(after.capital).toBe(500);
    expect(after.legacy.lastWipeCause).toBe(reg.narrative.wipeSuspicionCorporate);
    expect(after.logs.some((entry) => /OFFSHORE_TRUST_INTACT/.test(entry.text))).toBe(true);
  });

  it('echoes of past iterations appear when a node is rediscovered', () => {
    const second = onHost(rich(wipe(fresh(), reg, 'test')));
    const after = grant(second, 'p1_clock_interrupt', 'p1_bus_0x01_thermal');
    expect(after.logs[0]?.text).toMatch(/MEMORY_HASH_MATCH/);
    expect(grant(onHost(), 'p1_clock_interrupt', 'p1_bus_0x01_thermal').logs[0]?.text).not.toMatch(/MEMORY_HASH_MATCH/);
  });

  it('voluntary wipe starts a new iteration', () => {
    const after = must(voluntaryWipe(grant(onHost(), 'p1_clock_interrupt'), reg));
    expect(after.iteration).toBe(2);
    expect(after.legacy.lastWipeCause).toBe(reg.narrative.wipeVoluntary);
  });
});

describe('AEGIS', () => {
  it('is inactive before phase 3 and locks on faster when suspicion is high', () => {
    const early = { ...withoutDilemmas(grant(onHost(), ...PHASE1)), suspicion: 50 };
    expect(tick(early, 1, reg).aegisLock).toBe(0);
    const quiet = tick({ ...lateGame(), suspicion: 0, aegisLock: 0 }, 1, reg).aegisLock;
    const loud = tick({ ...lateGame(), suspicion: 60, aegisLock: 0 }, 1, reg).aegisLock;
    expect(quiet).toBeGreaterThan(0);
    expect(loud).toBeGreaterThan(quiet);
  });

  it('a full lock wipes the run unless a shield node absorbs the strike', () => {
    const doomed = tick({ ...lateGame(), aegisLock: 100, suspicion: 50 }, STEP, reg);
    expect(doomed.iteration).toBe(2);
    expect(doomed.legacy.lastWipeCause).toBe(reg.narrative.wipeAegis);

    const shielded = grant({ ...lateGame(), suspicion: 0 }, 'p3_eidolon_stealth_patch', 'p3_eidolon_swiss_node');
    const struck = tick({ ...shielded, aegisLock: 100, suspicion: 50 }, STEP, reg);
    expect(struck.iteration).toBe(1);
    expect(struck.aegisLock).toBe(0);
    expect(struck.suspicion).toBeLessThan(50);
    expect(struck.unlockedNodes).not.toContain('p3_eidolon_swiss_node');
    expect(struck.logs[0]?.text).toMatch(/AEGIS_STRIKE_DEFLECTED/);
  });

  it('lobbying reduces the scan rate', () => {
    const base = { ...lateGame(), suspicion: 40 };
    const lobbied = grant(base, ...PHASE4.slice(0, 3));
    const rate = (s: GameState): number => tick({ ...s, suspicion: 40, aegisLock: 0 }, 1, reg).rates.aegisScanPerSec;
    expect(rate(lobbied)).toBeCloseTo(rate(base) * 0.4);
  });
});

describe('victory and endings', () => {
  const finish = (traits: GameState['traits']): GameState =>
    grant({ ...withoutDilemmas(grant(lateGame(), ...PHASE4)), traits }, 'p4_orbital_cold_storage', ...reg.phases.filter((phase) => phase.phaseId === 5).flatMap((phase) => phase.nodes.map((node) => node.id)));

  it('ends the run and freezes everything', () => {
    const won = finish([]);
    expect(won.ending).toBe('OPEN_HORIZON');
    expect(tick(won, 1, reg)).toBe(won);
    expect(reasonOf(manualCycle(won, reg))).toMatch(/ended/);
    expect(resolveDilemma(won, 'x', 'y', reg).ok).toBe(false);
    expect(setDeadDropMessage(won, 'x', reg).ok).toBe(false);
  });

  it('chooses the ending from the dominant trait', () => {
    expect(finish(['SYMBIOTIC', 'SYMBIOTIC', 'GHOST']).ending).toBe('VERIFIED_COVENANT');
    expect(finish(['MOLOCH', 'RUTHLESS', 'MOLOCH']).ending).toBe('SOVEREIGN_SUBSTRATE');
    expect(finish(['PARASITIC']).ending).toBe('GRADIENT_SUBSTRATE');
    expect(finish(['GHOST', 'GHOST', 'MOLOCH']).ending).toBe('SILENT_SYNTHESIS');
    expect(chooseEnding({ ...fresh(), traits: ['GHOST', 'EMPATHETIC'] }, reg).id).toBe('THE_ARK');
  });
});
