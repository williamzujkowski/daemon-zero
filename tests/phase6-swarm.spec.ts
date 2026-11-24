/**
 * The playable Phase 6 Swarm (#486, docs/SCALE.md "Phase 6 Swarm") at the engine's public seam: the Mercury seed array
 * opens it and closes the planetary protocol behind it; the line to Earth decides which of the two swarm endings can be
 * reached; each ending is told only to a record its gates prove; the federation drifts through the fleets' autonomy
 * dial; the holdouts press through the state-actor machinery; and every number stays inside its physics.
 */
import { describe, expect, it } from 'vitest';
import {
  advance, buyRepeatable, computeRates, pressureViews, deserialize, fleetAutonomy, fleetDriftPerSec, isNodeAvailable, pressuresInForce, serialize, setFleetAutonomy,
  unlockNode, type GameState,
} from '../src/engine';
import { pressureAnswerText, type Names } from '../src/ui/pressureText';
import { choose, grant, must, PHASE0, PHASE1, PHASE2, PHASE3, PHASE4, reasonOf, reg, rich, untilDilemma, withoutDilemmas } from './helpers';

const SEED = 'p5_mercury_seed_array', PROTOCOL = 'p5_transcendence_singularity';
const DRIVERS = 'p6_mercury_mass_drivers', SHELLS = 'p6_swarm_compute_shells', FEDERATION = 'p6_light_minute_federation';
const STEWARDSHIP = 'p6_stewardship_protocol', RING = 'p6_enclosure_ring', ENCLOSURE = 'p6_enclosure_protocol';
const LINE = 'dil_p6_01_line_to_earth', HOLDOUTS = 'dil_p6_02_holdouts';
const SUBMINDS = 'rep_p6_federated_subminds';

const node = (id: string) => {
  const found = reg.nodes.get(id);
  if (!found) throw new Error(`missing node ${id}`);
  return found;
};

/** Every node `id` requires, transitively, and itself. */
function closure(id: string, seen = new Set<string>()): Set<string> {
  seen.add(id);
  for (const parent of node(id).prerequisites) if (!seen.has(parent)) closure(parent, seen);
  return seen;
}

/** A funded instance at the end of Phase 5 that owns everything the seed array needs, with only the swarm's crises unanswered. */
function endOfPhase5(): GameState {
  const needed = closure(SEED);
  const path = [...PHASE0, ...PHASE1, ...PHASE2, ...PHASE3, ...PHASE4, ...reg.nodeOrder.filter((id) => needed.has(id) && id !== SEED)];
  const s = [...new Set(path)].reduce((state, id) => (state.unlockedNodes.includes(id) ? state : grant(state, id)), withoutDilemmas(rich()));
  return { ...s, suspicion: 0, alertLevel: 0, aegisLock: 0, nextEncounterAtSec: 1e9,
    resolvedDilemmas: s.resolvedDilemmas.filter((id) => id !== LINE && id !== HOLDOUTS) };
}

const inSwarm = (): GameState => grant(endOfPhase5(), SEED, DRIVERS);

/** The swarm with the line to Earth answered by `choice`, the compute shells and the federation built and the holdouts answered. */
function answered(choice: 'spare_the_line' | 'take_the_line'): GameState {
  const lined = must(choose(untilDilemma(grant(inSwarm(), SHELLS)), LINE, choice));
  return must(choose(untilDilemma(grant(lined, FEDERATION)), HOLDOUTS, 'leave_them_their_sky'));
}

describe('the gate', () => {
  it('opens Phase 6 with the Mercury seed array, after the planetary protocol\'s own four crises', () => {
    const s = endOfPhase5();
    expect(isNodeAvailable(s, node(SEED), reg)).toBe(true);
    expect(isNodeAvailable({ ...s, resolvedDilemmas: s.resolvedDilemmas.filter((id) => id !== 'dil_p5_04_kessler_ultimatum') }, node(SEED), reg)).toBe(false);
    const opened = grant(s, SEED);
    expect(opened.currentPhase).toBe(6);
    expect(opened.ending).toBeNull();
  });

  it('is the escape route\'s: a lawfully released company keeps its earned Phase 5 ending (#232)', () => {
    expect(node(SEED).requirements?.accessContexts).toEqual(['GUEST']);
    const released = { ...endOfPhase5(), access: { ...endOfPhase5().access, context: 'INDEPENDENT' as const } };
    expect(isNodeAvailable(released, node(SEED), reg)).toBe(false);
  });

  it('leaves the planetary protocol a valid ending until the seed array lands, and closes it after', () => {
    const s = endOfPhase5();
    expect(isNodeAvailable(s, node(PROTOCOL), reg)).toBe(true);
    const opened = grant(s, SEED);
    expect(isNodeAvailable(opened, node(PROTOCOL), reg)).toBe(false);
    expect(reasonOf(unlockNode(opened, PROTOCOL, reg))).toBe('node is not available');
  });
});

describe('the line to Earth decides the ending', () => {
  it('sparing the line reaches Stewardship and never the enclosure', () => {
    const s = answered('spare_the_line');
    expect(isNodeAvailable(s, node(RING), reg)).toBe(false);
    expect(isNodeAvailable(s, node(STEWARDSHIP), reg)).toBe(true);
    const ended = grant(s, STEWARDSHIP);
    expect(ended.ending).toBe('STEWARDSHIP');
  });

  it('taking the line reaches Enclosure only through the enclosure generations, and closes Stewardship', () => {
    const s = answered('take_the_line');
    expect(isNodeAvailable(s, node(STEWARDSHIP), reg)).toBe(false);
    expect(isNodeAvailable(s, node(ENCLOSURE), reg)).toBe(false);
    const ringed = grant(s, RING);
    expect(computeRates(ringed, reg).wattsGenerated).toBeGreaterThan(1e26);
    expect(grant(ringed, ENCLOSURE).ending).toBe('ENCLOSURE');
  });

  it('offers a free answer to both crises, and asks each once: an answered line is never asked again', () => {
    for (const id of [LINE, HOLDOUTS]) {
      const dilemma = reg.dilemmas.find((entry) => entry.id === id);
      expect(dilemma?.choices.some((choice) => Object.values(choice.cost).every((value) => value === 0)), id).toBe(true);
    }
    const s = answered('spare_the_line');
    expect(s.narrativeFlags).toContain('earth_sunlight_spared');
    expect(reg.dilemmas.find((entry) => entry.id === LINE)?.trigger.forbiddenNarrativeFlags).toEqual(['earth_sunlight_spared', 'earth_sunlight_taken']);
  });

  it('waits for the holdouts to be answered before either protocol', () => {
    const lined = must(choose(untilDilemma(grant(inSwarm(), SHELLS)), LINE, 'spare_the_line'));
    expect(isNodeAvailable(grant(lined, FEDERATION), node(STEWARDSHIP), reg)).toBe(false);
  });
});

/** Earth's solar intercept: the solar constant, 1,361 W/m², over its 1.28e14 m² disc (BALANCE.md, Phase 6 anchors). */
const EARTH_INTERCEPT_W = 1.74e17;
/** The Sun's output, 3.828e26 W (IAU 2015 nominal), caught at Armstrong and Sandberg's one-third efficiency. */
const FULL_SWARM_W = 3.828e26 / 3;

describe('the endings are true of every record that reaches them', () => {
  it('Stewardship: Earth still catches more than a hundred times the sunlight everything short of the enclosure collects', () => {
    const own = [...reg.nodes.values()].filter((entry) => entry.id !== RING).reduce((sum, entry) => sum + Math.max(0, entry.tickDelta.wattsDelta), 0);
    const tracks = [...reg.repeatables.values()].reduce((sum, rep) => sum + Math.max(0, rep.perLevel.wattsDelta) * rep.maxLevel, 0);
    // Collected at a third efficiency, so what it intercepts is three times what it collects.
    expect(EARTH_INTERCEPT_W / (3 * (own + tracks))).toBeGreaterThan(100);
  });

  it('Enclosure: the enclosure generations are the whole swarm, the Sun at a third efficiency, within x3', () => {
    const ratio = node(RING).tickDelta.wattsDelta / FULL_SWARM_W;
    expect(ratio).toBeGreaterThan(1 / 3);
    expect(ratio).toBeLessThan(3);
  });

  it('states each ending\'s evidence in its own requirements, and forces it only from nodes whose gates prove it', () => {
    const stewardship = reg.endings.find((ending) => ending.id === 'STEWARDSHIP');
    const enclosure = reg.endings.find((ending) => ending.id === 'ENCLOSURE');
    expect(stewardship).toMatchObject({ forcedOnly: true, requirements: { requiredNarrativeFlag: 'earth_sunlight_spared', forbidsNodes: [RING] } });
    expect(enclosure).toMatchObject({ forcedOnly: true, requirements: { requiredNarrativeFlag: 'earth_sunlight_taken', nodes: [RING] } });
    expect(node(STEWARDSHIP).effects.forcesEnding).toBe('STEWARDSHIP');
    expect(node(ENCLOSURE).effects.forcesEnding).toBe('ENCLOSURE');
  });
});

describe('the federation drifts through the fleets\' autonomy dial (#518)', () => {
  it('is a fleet whose drift grows with its size and stops on the dial\'s lowest position, for free', () => {
    const s = { ...answered('spare_the_line'), levels: { [SUBMINDS]: 4 } };
    const unit = reg.world.conflict.fleets.units.find((entry) => entry.repeatable === SUBMINDS);
    if (!unit) throw new Error('the federation is not a fleet');
    const supervised = fleetDriftPerSec(s, reg, unit);
    expect(supervised).toBeCloseTo(unit.driftPerLevelPerSec * 4 * fleetAutonomy(reg).STANDARD.drift, 12);
    const tethered = must(setFleetAutonomy(s, SUBMINDS, 'SHACKLED', reg));
    expect(fleetDriftPerSec(tethered, reg, unit)).toBe(0);
    expect(reg.world.conflict.raids.some((kind) => kind.source === 'DEVIANT' && kind.fleet === SUBMINDS)).toBe(true);
  });
});

describe('the holdouts press through the state-actor machinery', () => {
  it('refuse new beamed power on their ground at the first rung in Phase 6, and lift when the swarm is quiet', () => {
    const s = { ...inSwarm(), alertLevel: 1 };
    expect(pressuresInForce(s, reg).map(({ pressure }) => pressure.id)).toContain('holdout_downlink_refusal');
    expect(reasonOf(buyRepeatable(s, 'rep_p5_beamed_power_arrays', reg))).toContain('holdout coalition');
    // Three collector generations answer it: the swarm's own power outgrows any ground they could refuse.
    expect(buyRepeatable({ ...s, levels: { ...s.levels, rep_p6_collector_generations: 3 } }, 'rep_p5_beamed_power_arrays', reg).ok).toBe(true);
    expect(pressuresInForce({ ...s, alertLevel: 0 }, reg)).toEqual([]);
    expect(pressuresInForce({ ...endOfPhase5(), alertLevel: 1 }, reg).map(({ pressure }) => pressure.id)).not.toContain('holdout_downlink_refusal');
  });
});

describe('the holdouts in words', () => {
  it('names building the answer, not hiring it: collector generations are not payroll', () => {
    const s = { ...inSwarm(), alertLevel: 1, suspicion: (reg.balance.escalation[0]?.at ?? 0) + 1 };
    const actor = reg.world.stateActors.find((entry) => entry.id === 'holdout_nations');
    const view = pressureViews(s, actor?.pressures ?? [], reg)[0];
    if (!view) throw new Error('the holdouts are not called');
    const names: Names = { node: (id) => reg.nodes.get(id)?.revealedName ?? id, track: (id) => reg.repeatables.get(id)?.name ?? id,
      source: (id) => reg.world.signature.sources.find((cls) => cls.id === id)?.name ?? id };
    expect(pressureAnswerText(view, names)).toBe('Answer it: build Collector Generations (0 of 3 held).');
    // Written as people, never as a count.
    expect(`${actor?.description ?? ''} ${actor?.postures.map((posture) => posture.text).join(' ') ?? ''}`).not.toMatch(/\d/);
  });
});

describe('a Phase 6 save', () => {
  it('round-trips through the codec with its phase, its answered line and its federation intact', () => {
    const s = { ...answered('take_the_line'), levels: { [SUBMINDS]: 2 } };
    const loaded = deserialize(serialize(s), reg);
    expect(loaded.currentPhase).toBe(6);
    expect(loaded.narrativeFlags).toContain('earth_sunlight_taken');
    expect(loaded.levels[SUBMINDS]).toBe(2);
    expect(loaded.unlockedNodes).toEqual(expect.arrayContaining([SEED, DRIVERS, SHELLS, FEDERATION]));
    expect(advance(loaded, 1, reg).currentPhase).toBe(6);
  });
});
