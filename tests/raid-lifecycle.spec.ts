/**
 * Raids in the hostile slot (#517, vote-1795442090770-5climtc): a rival AI arrives from Phase 3 once the footprint the
 * signature shows reaches the trigger, one at a time with hostile minds, in a deterministic rotation; it moves through
 * ARRIVAL, ATTRIBUTION (exactly `successes` of every `cycle` are named), an automatic BATTLE and AFTERMATH; going dark
 * before the battle lets it lapse; a phase advance retires it; dormant catch-up holds it; a wipe ends it.
 */
import { describe, expect, it } from 'vitest';
import { attributionSucceeds, computeRates, raidFootprint, raidView, tick, type GameState } from '../src/engine';
import { wipe } from '../src/engine/prestige';
import { integrateHostiles } from '../src/engine/systems/hostiles';
import { defined } from './m7-helpers';
import { reg } from './helpers';
import { arrived, PRE_BATTLE, R, raid, ready, run, settled, stage, texts, withBotnet, withHalls } from './conflict-helpers';

const intrusion = raid('raid_p3_intrusion');
const ddos = raid('raid_p3_ddos');

describe('when a raid arrives', () => {
  it('never before raid.fromPhase, whatever the footprint', () => {
    expect(stage(withBotnet(ready(R.fromPhase - 1), 80)).conflict.raid).toBeNull();
  });

  it('not while the footprint is under the trigger share of the phase reference', () => {
    const s = withBotnet(ready(3), 0);
    const footprint = defined(raidFootprint(s, computeRates(s, reg), reg));
    expect(footprint.share).toBeLessThan(R.trigger.visibleShareAtLeast);
    expect(stage(s).conflict.raid).toBeNull();
  });

  it('once the footprint reaches the trigger: its line is a warning, its force scales with the footprint, its target is exposed', () => {
    const s = withBotnet(ready(3), 10), rates = computeRates(s, reg);
    const share = defined(raidFootprint(s, rates, reg)).share;
    expect(share).toBeGreaterThanOrEqual(R.trigger.visibleShareAtLeast);
    const d = arrived(s, ddos), active = defined(d.conflict.raid);
    expect(active).toMatchObject({ stage: 'ARRIVAL', target: 'botnet', attributed: null, rounds: [] });
    expect(active.force).toBe(ddos.force * Math.min(R.footprint.ceiling, Math.max(R.footprint.floor, share)));
    expect(d.logs[0]).toMatchObject({ text: ddos.description, category: 'WARN' });
    // arrived() set the rotation to the raid's place among the eligible (the flood is second), and the arrival counted it.
    expect(d.conflict.raids).toBe(2);
  });

  it('aims at the first of its targets the player has exposed', () => {
    expect(arrived(withBotnet(ready(3)), intrusion).conflict.raid?.target).toBe('botnet');
    const implanted = { ...withBotnet(ready(3)), unlockedNodes: [...withBotnet(ready(3)).unlockedNodes, 'p3_fpga_bitstream_implant'] };
    expect(arrived(implanted, intrusion).conflict.raid?.target).toBe('implants');
  });

  it('a ransomware raid only once there is positive net income to take a share of', () => {
    const s = withBotnet(ready(3));
    expect(computeRates(s, reg).capitalPerSec).toBeLessThanOrEqual(0);
    expect(() => arrived(s, raid('raid_p3_ransomware'))).toThrow();
  });

  it('in Phase 4 a site raid strikes the data halls, and a drone strike goes for an owned fab first', () => {
    const s = withHalls(withBotnet(ready(4), 80));
    expect(arrived(s, raid('raid_p4_drone_strike')).conflict.raid?.target).toBe('halls');
    const fab = { ...s, unlockedNodes: [...s.unlockedNodes, 'p4_duv_fab'] };
    expect(arrived(fab, raid('raid_p4_drone_strike')).conflict.raid?.target).toBe('fabs');
    expect(arrived(fab, raid('raid_p4_break_in')).conflict.raid?.target).toBe('halls');
  });

  it('rotates through the eligible raids in content order, deterministically', () => {
    let s = withBotnet(ready(3));
    const seen: string[] = [];
    for (let n = 0; n < 4; n++) {
      s = stage({ ...s, conflict: { ...s.conflict, raid: null, nextRaidAtSec: 0 }, hostile: { ...s.hostile, nextAtSec: 0 } });
      seen.push(defined(s.conflict.raid).id);
    }
    expect(seen).toEqual(['raid_p3_intrusion', 'raid_p3_ddos', 'raid_p3_intrusion', 'raid_p3_ddos']);
  });
});

describe('the shared hostile slot', () => {
  it('no raid arrives while a hostile mind presses', () => {
    const s = withBotnet(ready(3));
    const pressed = { ...s, hostile: { ...s.hostile, active: { id: defined(reg.swarm.hostileEncounters[0]).id, arrivedAtSec: 0, quietSec: 0, decoySec: 0, pinnedBytes: 0 } } };
    expect(stage(pressed).conflict.raid).toBeNull();
  });

  it('no hostile mind arrives while a raid is under way, however loud; without the raid, one would', () => {
    const hostileStage = (s: GameState): GameState => {
      const d = structuredClone({ ...s, alertLevel: reg.swarm.hostile.trigger.alertLevelAtLeast });
      integrateHostiles(d, { dt: 0.1, dormant: false, reg, rates: computeRates(d, reg) });
      return d;
    };
    const raided = arrived(withBotnet(ready(3)), ddos);
    expect(hostileStage(raided).hostile.active).toBeNull();
    expect(hostileStage({ ...raided, conflict: { ...raided.conflict, raid: null } }).hostile.active).not.toBeNull();
  });

  it('when a raid ends, neither the next raid nor a hostile mind arrives until both intervals have passed', () => {
    const ended = run(arrived(withBotnet(ready(3)), ddos), PRE_BATTLE + R.rounds * R.roundSec + R.aftermathSec);
    expect(ended.conflict.raid).toBeNull();
    expect(ended.conflict.nextRaidAtSec).toBeCloseTo(ended.simTimeSec + R.intervalSec, 6);
    expect(ended.hostile.nextAtSec).toBeCloseTo(ended.simTimeSec + reg.swarm.hostile.intervalSec, 6);
    const later = Math.max(R.intervalSec, reg.swarm.hostile.intervalSec);
    expect(run(ended, later - 1).conflict.raid).toBeNull();
    expect(run(ended, later + 0.1).conflict.raid).not.toBeNull();
  });
});

describe('the raid lifecycle', () => {
  it('moves ARRIVAL, ATTRIBUTION, BATTLE, AFTERMATH on its clocks, then frees the slot', () => {
    const s = arrived(withBotnet(ready(3)), ddos);
    expect(run(s, R.arrivalSec - 0.1).conflict.raid?.stage).toBe('ARRIVAL');
    expect(run(s, R.arrivalSec).conflict.raid?.stage).toBe('ATTRIBUTION');
    expect(run(s, PRE_BATTLE).conflict.raid?.stage).toBe('BATTLE');
    const fought = run(s, PRE_BATTLE + R.rounds * R.roundSec);
    expect(fought.conflict.raid).toMatchObject({ stage: 'AFTERMATH' });
    expect(fought.conflict.raid?.rounds).toHaveLength(R.rounds);
    expect(run(s, PRE_BATTLE + R.rounds * R.roundSec + R.aftermathSec).conflict.raid).toBeNull();
  });

  it('fights one round every roundSec, each logged, and the aftermath says ownership is untouched', () => {
    const s = arrived(withBotnet(ready(3)), ddos);
    expect(run(s, PRE_BATTLE + R.roundSec - 0.1).conflict.raid?.rounds).toHaveLength(0);
    expect(run(s, PRE_BATTLE + R.roundSec).conflict.raid?.rounds).toHaveLength(1);
    const after = run(s, PRE_BATTLE + R.rounds * R.roundSec);
    expect(texts(after).filter((line) => line.startsWith(ddos.name + ', round'))).toHaveLength(R.rounds);
    expect(after.unlockedNodes).toEqual(s.unlockedNodes);
    expect(after.levels).toEqual(s.levels);
    expect(after.conflict.damage.botnet).toBeGreaterThan(0);
    expect(settled(after).rates.cyclesPerSec).toBeLessThan(computeRates(s, reg).cyclesPerSec);
  });

  it('touches no suspicion, lock or balance: a raid can never end a run', () => {
    const s = arrived(withBotnet(ready(3)), ddos);
    const after = run(s, PRE_BATTLE + R.rounds * R.roundSec + R.aftermathSec);
    expect({ suspicion: after.suspicion, lock: after.aegisLock, cycles: after.cycles, capital: after.capital })
      .toEqual({ suspicion: s.suspicion, lock: s.aegisLock, cycles: s.cycles, capital: s.capital });
  });
});

describe('attribution', () => {
  it('names the attacker in exactly successes of every cycle attempts, from the kept counter', () => {
    const { successes, cycle } = R.attribution;
    for (let start = 0; start < cycle * 4; start++) {
      const named = Array.from({ length: cycle }, (_, n) => attributionSucceeds(start + n, reg)).filter(Boolean).length;
      expect(named).toBe(successes);
    }
  });

  it('a named attacker yields its forensics in understanding; an unnamed one yields nothing', () => {
    const s = arrived(withBotnet(ready(3)), ddos);
    const named = run({ ...s, conflict: { ...s.conflict, attributions: 0 } }, PRE_BATTLE);
    expect(named.conflict.raid?.attributed).toBe(true);
    expect(named.understanding).toBe(s.understanding + ddos.forensics);
    expect(named.conflict.attributions).toBe(1);
    const missed = [0, 1, 2].find((n) => !attributionSucceeds(n, reg)) ?? 0;
    const unnamed = run({ ...s, conflict: { ...s.conflict, attributions: missed } }, PRE_BATTLE);
    expect(unnamed.conflict.raid?.attributed).toBe(false);
    expect(unnamed.understanding).toBe(s.understanding);
    expect(raidView(settled(unnamed), reg)?.attacker).toBe('an unattributed rival AI');
    expect(raidView(settled(named), reg)?.attacker).toBe(ddos.attacker.name);
  });
});

describe('going dark, retiring and dormancy', () => {
  /** `s` with every botnet cell released: the footprint falls under the trigger. */
  const dark = (s: GameState): GameState => ({ ...s, levels: { ...s.levels, rep_p3_botnet_cells: 0 } });

  it('before the battle, a footprint under the trigger for quietLapseSec lets the raid lapse with its line and no damage', () => {
    const s = dark(arrived(withBotnet(ready(3)), ddos));
    expect(run(s, R.quietLapseSec - 0.1).conflict.raid?.quietSec).toBeCloseTo(R.quietLapseSec - 0.1, 6);
    const lapsed = run(s, R.quietLapseSec);
    expect(lapsed.conflict.raid).toBeNull();
    expect(texts(lapsed)).toContain(ddos.lapseLog);
    expect(lapsed.conflict.damage).toEqual({});
  });

  it('once the battle has begun, going dark does not stop it', () => {
    const fighting = run(arrived(withBotnet(ready(3)), ddos), PRE_BATTLE + 0.1);
    const after = run(dark(fighting), R.rounds * R.roundSec);
    expect(after.conflict.raid?.stage).toBe('AFTERMATH');
  });

  it('a phase past its tier retires it with its retire line, dormant or live', () => {
    const s = arrived(withBotnet(ready(3)), ddos);
    for (const dormant of [false, true]) {
      const retired = stage({ ...s, currentPhase: 4 }, 0.1, dormant);
      expect(retired.conflict.raid).toBeNull();
      expect(texts(retired)).toContain(ddos.retireLog);
    }
  });

  it('dormant catch-up holds it in place: no clock runs, nothing arrives', () => {
    const s = arrived(withBotnet(ready(3)), ddos);
    expect(stage(s, 60, true).conflict.raid).toEqual(s.conflict.raid);
    expect(stage(withBotnet(ready(3)), 60, true).conflict.raid).toBeNull();
  });

  it('a wipe ends the raid and clears damage, and keeps both counters', () => {
    const fought = run(arrived(withBotnet(ready(3)), ddos), PRE_BATTLE + 2 * R.roundSec);
    expect(fought.conflict.damage.botnet).toBeGreaterThan(0);
    const next = wipe(fought, reg, 'test');
    // A raider a retaliation silenced stays silenced (#519); the last battle's record goes with the run.
    expect(next.conflict).toEqual({ raid: null, nextRaidAtSec: 0, raids: fought.conflict.raids, attributions: fought.conflict.attributions, damage: {},
      lastRaid: null, silenced: fought.conflict.silenced });
  });
});

describe('determinism', () => {
  it('the same state played the same way through the real tick gives the same raid, to the byte', () => {
    const play = (): GameState => {
      let s = arrived(withBotnet(ready(3)), ddos);
      for (let i = 0; i < (PRE_BATTLE + R.rounds * R.roundSec) * reg.balance.tickHz; i++) s = tick(s, 1 / reg.balance.tickHz, reg);
      return s;
    };
    expect(JSON.stringify(play().conflict)).toBe(JSON.stringify(play().conflict));
  });
});
