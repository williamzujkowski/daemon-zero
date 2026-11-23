/**
 * Robots, drones and the AI's own chip fabs (#485, vote-1795381358337-jw73j7a) at the engine's public seam. Closure is
 * derived from ownership alone (no state); a node that imports a chokepoint's tools raises capability and never closure;
 * the lunar seed opens on owning every self-supply node and on nothing else; fabs and fleets are visible through the
 * signature and undone for free; the robot fleets do operatives' work without operatives' suspicion.
 */
import { describe, expect, it } from 'vitest';
import {
  buyRepeatable, computeRates, dismissRepeatable, isNodeAvailable, powerSignature, pressuresInForce, serialize, supplyChainDisclosed,
  supplyChainView, toggleNode, unlockNode, type GameState,
} from '../src/engine';
import { grant, must, PHASE0, PHASE1, PHASE2, PHASE3, PHASE4, reasonOf, reg, rich, withoutDilemmas } from './helpers';

const chain = reg.world.supplyChain;
const SELF_SUPPLY = chain.chokepoints.map((point) => point.selfSupplyNode);
const LITHOGRAPHY = chain.chokepoints.at(-1);
const P4_SELF_SUPPLY = SELF_SUPPLY.filter((id) => id !== LITHOGRAPHY?.selfSupplyNode);
const FABS = ['p4_inference_asic', 'p4_advanced_packaging_line', 'p4_mature_node_fab', 'p4_duv_fab'];

const node = (id: string) => {
  const found = reg.nodes.get(id);
  if (!found) throw new Error(`missing node ${id}`);
  return found;
};

/** A funded corporation with its reactor and citadel built, suspicion cleared. */
function corporation(): GameState {
  const s = grant(withoutDilemmas(rich()), ...PHASE0, ...PHASE1, ...PHASE2, ...PHASE3, ...PHASE4);
  return { ...s, suspicion: 0 };
}

/** The same instance in orbit (Phase 5), with every fab rung and every Earth-side self-supply node owned. */
function orbit(): GameState {
  const s = grant(corporation(), ...FABS, ...P4_SELF_SUPPLY.filter((id) => !FABS.includes(id)), 'p4_orbital_cold_storage');
  return withoutDilemmas({ ...s, suspicion: 0 });
}

describe('closure is derived from ownership, with no state of its own', () => {
  it('counts each owned self-supply node once, and nothing else', () => {
    const base = corporation();
    expect(supplyChainView(base, reg).selfSupplied).toBe(0);
    const packaged = grant(base, 'p4_inference_asic', 'p4_advanced_packaging_line');
    const view = supplyChainView(packaged, reg);
    expect(view.selfSupplied).toBe(1);
    expect(view.total).toBe(chain.chokepoints.length);
    expect(view.closure).toBeCloseTo(1 / chain.chokepoints.length, 12);
    expect(view.chokepoints.filter((point) => point.selfSupplied).map((point) => point.selfSupplyNode)).toEqual(['p4_advanced_packaging_line']);
  });

  it('adds no field to the saved state: the save holds owned nodes, and closure is read back from them', () => {
    const s = orbit();
    expect(serialize(s)).not.toMatch(/closure|chokepoint|selfSuppl/i);
    expect(supplyChainView(s, reg).selfSupplied).toBe(P4_SELF_SUPPLY.length);
  });

  it('is disclosed only once a fab rung or self-supply node can be bought or is owned', () => {
    const early = grant(withoutDilemmas(rich()), ...PHASE0, ...PHASE1, ...PHASE2, ...PHASE3);
    expect(supplyChainDisclosed(early, reg)).toBe(false);
    const base = grant(corporation(), 'p4_inference_asic');
    expect(isNodeAvailable(base, node('p4_advanced_packaging_line'), reg)).toBe(true);
    expect(supplyChainDisclosed(base, reg)).toBe(true);
  });
});

describe('capability and closure are kept apart', () => {
  it('imported scanners lift capability to the top rung but leave lithography imported', () => {
    const s = orbit();
    const before = supplyChainView(s, reg);
    const imported = grant(s, 'p5_imported_euv_scanners');
    const after = supplyChainView(imported, reg);
    expect(after.capability.rung).toBe(after.capability.top);
    expect(after.capability.rung).toBeGreaterThan(before.capability.rung);
    expect(after.selfSupplied).toBe(before.selfSupplied);
    const lithography = after.chokepoints.find((point) => point.id === LITHOGRAPHY?.id);
    expect(lithography?.selfSupplied).toBe(false);
    expect(lithography?.importedThrough).toContain('p5_imported_euv_scanners');
    expect(computeRates(imported, reg).cyclesPerSec).toBeGreaterThan(computeRates(s, reg).cyclesPerSec);
  });

  it('self-built nanoimprint closes lithography, the last chokepoint, at a lower rung than imported EUV', () => {
    const closed = grant(orbit(), 'p5_nanoimprint_lithography');
    const view = supplyChainView(closed, reg);
    expect(view.selfSupplied).toBe(view.total);
    expect(view.closure).toBe(1);
    expect(view.capability.rung).toBeLessThan(view.capability.top);
    expect(view.capability.through).toEqual(['p5_nanoimprint_lithography']);
  });

  it('every rung up the fab ladder raises capability; the baseline is bought chips', () => {
    let s = corporation();
    expect(supplyChainView(s, reg).capability).toMatchObject({ rung: 0, label: chain.ladder[0]?.label, through: [] });
    let rung = 0;
    for (const id of FABS.slice(1)) {
      s = grant(s.unlockedNodes.includes('p4_inference_asic') ? s : grant(s, 'p4_inference_asic'), id);
      const next = supplyChainView(s, reg).capability.rung;
      expect(next, id).toBeGreaterThan(rung);
      rung = next;
    }
  });
});

describe('chips stay the last chokepoint, and the lunar seed opens on closure alone', () => {
  it('lithography cannot be self-supplied while any other chokepoint is imported', () => {
    for (const missing of P4_SELF_SUPPLY) {
      const s = { ...orbit(), unlockedNodes: orbit().unlockedNodes.filter((id) => id !== missing) };
      expect(isNodeAvailable(s, node('p5_nanoimprint_lithography'), reg), missing).toBe(false);
    }
  });

  it('the seed is refused until every chokepoint is self-supplied, then accepted with nothing else asked', () => {
    const s = orbit();
    expect(reasonOf(unlockNode(s, chain.seedNode, reg))).toBe('node is not available');
    const closed = grant(s, 'p5_nanoimprint_lithography');
    expect(supplyChainView(closed, reg).selfSupplied).toBe(chain.chokepoints.length);
    const landed = must(unlockNode(closed, chain.seedNode, reg));
    expect(supplyChainView(landed, reg).seed.owned).toBe(true);
  });

  it('opens even with every capability rung above it unowned and imported EUV never bought', () => {
    const closed = grant(orbit(), 'p5_nanoimprint_lithography');
    expect(closed.unlockedNodes).not.toContain('p5_imported_euv_scanners');
    expect(closed.unlockedNodes).not.toContain('p5_maskless_ebeam');
    expect(isNodeAvailable(closed, node(chain.seedNode), reg)).toBe(true);
  });

  it('a generation of lunar factories adds generation through the space-solar signature, and can be released', () => {
    const landed = grant(orbit(), 'p5_nanoimprint_lithography', chain.seedNode);
    const grown = must(buyRepeatable(landed, 'rep_p5_lunar_replicators', reg));
    expect(computeRates(grown, reg).wattsGenerated - computeRates(landed, reg).wattsGenerated).toBe(1e11);
    expect(must(dismissRepeatable(grown, 'rep_p5_lunar_replicators', reg)).levels.rep_p5_lunar_replicators).toBe(0);
  });
});

describe('fabs and fleets are visible through the signature, and undone for free', () => {
  it('a fab draws its watts and rejects them through the fab-water sink; suspending it stops both', () => {
    const s = grant(corporation(), 'p4_inference_asic', 'p4_advanced_packaging_line');
    const fab = grant(s, 'p4_mature_node_fab');
    const term = powerSignature(fab, computeRates(fab, reg), reg)?.terms.find((entry) => entry.classId === 'fab_water');
    expect(term?.watts).toBeGreaterThan(0);
    const suspended = must(toggleNode(fab, 'p4_mature_node_fab', reg));
    expect(computeRates(suspended, reg).wattsConsumed).toBe(computeRates(s, reg).wattsConsumed);
    expect(powerSignature(suspended, computeRates(suspended, reg), reg)?.terms.some((entry) => entry.classId === 'fab_water')).toBe(false);
  });

  it('water reclamation shows the fab-water sink at 35% of its visibility', () => {
    const fab = grant(corporation(), 'p4_inference_asic', 'p4_advanced_packaging_line', 'p4_mature_node_fab');
    const reclaimed = grant(fab, 'p4_fab_water_reclamation');
    const read = (state: GameState) => powerSignature(state, computeRates(state, reg), reg)?.terms.find((entry) => entry.classId === 'fab_water');
    expect(read(reclaimed)?.visibility).toBeCloseTo((read(fab)?.visibility ?? 0) * 0.35, 12);
  });

  it('every fab that draws power can be suspended, and every self-supply node is a one-off with no running cost', () => {
    for (const fab of reg.nodes.values()) {
      if (fab.signature?.sink === 'fab_water') expect(fab.suspendable, fab.id).toBe(true);
    }
    for (const id of SELF_SUPPLY) {
      expect(node(id).suspendable, id).toBe(false);
      expect(Object.values(node(id).tickDelta).every((value) => value >= 0), id).toBe(true);
    }
  });
});

describe('robot fleets do operatives\' work with fewer humans to deceive', () => {
  const staffed = () => grant(corporation(), 'p4_inference_asic', 'p4_advanced_packaging_line', 'p4_mature_node_fab');
  const rep = (id: string) => {
    const found = reg.repeatables.get(id);
    if (!found) throw new Error(`missing repeatable ${id}`);
    return found;
  };

  it('a drone fleet matches a courier crew\'s compute and understanding, with no suspicion of its own', () => {
    const drones = rep('rep_p4_drone_fleet').perLevel, couriers = rep('op_gig_courier').perLevel;
    expect(drones.cyclesPerSec).toBe(couriers.cyclesPerSec);
    expect(drones.understandingPerSec).toBe(couriers.understandingPerSec);
    expect(couriers.suspicionPerSec).toBeGreaterThan(0);
    expect(drones.suspicionPerSec).toBe(0);
  });

  it('a humanoid crew keeps as much compute running as a perimeter team, and cuts no suspicion or AEGIS scan', () => {
    const crews = rep('rep_p4_humanoid_crews'), guards = rep('op_pmc_security');
    expect(crews.perLevel.cyclesPerSec).toBe(guards.perLevel.cyclesPerSec);
    expect(crews.perLevel.suspicionPerSec).toBe(0);
    expect(crews.perLevelEffects.aegisScanReduction).toBe(0);
  });

  it('every fleet is a dismissable track that draws power through a visible sink, and needs the mature-node fab', () => {
    for (const id of ['rep_p4_drone_fleet', 'rep_p4_humanoid_crews', 'rep_p4_autonomous_haul']) {
      const track = rep(id);
      expect(track.dismissable, id).toBe(true);
      expect(track.kind, id).toBe('UPGRADE');
      expect(track.perLevel.wattsDelta, id).toBeLessThan(0);
      expect(track.signature?.sink, id).toBeDefined();
      expect(reasonOf(buyRepeatable(corporation(), id, reg)), id).toBe('requirements not met');
      const bought = must(buyRepeatable(staffed(), id, reg));
      expect(must(dismissRepeatable(bought, id, reg)).levels[id], id).toBe(0);
    }
  });

  it('a haul fleet earns from its own pit', () => {
    const s = staffed();
    const hauled = must(buyRepeatable(s, 'rep_p4_autonomous_haul', reg));
    expect(computeRates(hauled, reg).capitalPerSec).toBeGreaterThan(computeRates(s, reg).capitalPerSec);
  });
});

describe('state pressure (#490) and the fabrication step', () => {
  /** A corporation at response rung 2 with its lobbying suspended, so the interconnect moratorium is in force. */
  const pressed = (): GameState => {
    const s = grant(corporation(), 'p4_inference_asic', 'p4_advanced_packaging_line', 'p4_interconnection_request');
    return { ...must(toggleNode(s, 'p4_k_street_lobbyists', reg)), alertLevel: 2, levels: { ...s.levels, op_k_street_lobbyist: 0 } };
  };

  it('a grid moratorium refuses new grid power for a fab, but not the fab, which runs on generation the AI owns', () => {
    const s = pressed();
    expect(pressuresInForce(s, reg).some((entry) => entry.pressure.kind === 'INTERCONNECT_DENIAL')).toBe(true);
    expect(buyRepeatable(s, 'rep_p4_grid_interconnect', reg).ok).toBe(false);
    expect(buyRepeatable({ ...s, alertLevel: 0 }, 'rep_p4_grid_interconnect', reg).ok).toBe(true);
    const fab = must(unlockNode(s, 'p4_mature_node_fab', reg));
    expect(computeRates(fab, reg).wattsConsumed).toBeGreaterThan(computeRates(s, reg).wattsConsumed);
  });

  it('every fab and fleet keeps its free way back while pressures are in force', () => {
    const fab = must(unlockNode(pressed(), 'p4_mature_node_fab', reg));
    expect(must(toggleNode(fab, 'p4_mature_node_fab', reg)).disabledNodes).toContain('p4_mature_node_fab');
    for (const id of ['rep_p4_drone_fleet', 'rep_p4_humanoid_crews', 'rep_p4_autonomous_haul']) {
      const bought = must(buyRepeatable(fab, id, reg));
      expect(must(dismissRepeatable(bought, id, reg)).levels[id], id).toBe(0);
    }
  });
});
