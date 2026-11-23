/**
 * Depth-scaled rediscovery (#497, vote-1795413517519-sf4ojsr): remembered hardware and remembered levels cost a share
 * of their first price that falls with the deepest phase any earlier iteration reached, 0.5 at Phase 2 down to 0.2 at
 * Phase 5. Cycles and understanding are discounted; memory and capital never are (docs/DESIGN.md, "Rewards for depth").
 */
import { describe, expect, it } from 'vitest';
import {
  activateCampaignRules, buyRepeatable, createInitialState, dismissRepeatable, isLevelRemembered, nodeCost, rediscoveryShare, unlockNode,
  repeatableCost, repeatablePrice, wipe, type GameState,
} from '../src/engine';
import { CONTENT as PREVIEW } from '../src/content';
import { grant, must, PHASE0, PHASE1, reg, rich, withoutDilemmas } from './helpers';

const TRACK = 'rep_p1_heap_defrag';
const DRAIN = 'rep_p0_trace_sampling';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`missing ${what}`);
  return value;
}
const track = defined(reg.repeatables.get(TRACK), TRACK);

/** A state whose earlier iterations reached `deepestPhase` and remember `nodes` and `levels`. */
function remembering(deepestPhase: number, nodes: string[] = [], knownLevels: Record<string, number> = {}): GameState {
  const s = rich();
  return { ...s, legacy: { ...s.legacy, deepestPhase, knownNodes: nodes, knownLevels } };
}

function buyLevels(s: GameState, id: string, count: number): GameState {
  let out = s;
  for (let i = 0; i < count; i++) out = must(buyRepeatable(out, id, reg));
  return out;
}

describe('the rediscovery share by depth', () => {
  it('is half when the campaign has reached Phase 2 at most, and a fifth when it has reached Phase 5', () => {
    expect(reg.phases.map((phase) => rediscoveryShare(phase.phaseId, reg))).toEqual([0.5, 0.5, 0.5, 0.4, 0.3, 0.2]);
  });

  it('never rises with depth', () => {
    const shares = reg.phases.map((phase) => rediscoveryShare(phase.phaseId, reg));
    shares.slice(1).forEach((share, index) => { expect(share).toBeLessThanOrEqual(shares[index] ?? 1); });
  });
});

describe('a remembered node', () => {
  const firm = defined(reg.nodes.get('p4_retainer_law_firm'), 'law firm');

  it('costs the depth share of its cycles and understanding, and its full memory and capital', () => {
    for (const { phaseId: depth } of reg.phases) {
      const share = rediscoveryShare(depth, reg);
      expect(nodeCost(remembering(depth, [firm.id]), firm, reg)).toEqual({
        cycles: Math.ceil(firm.cost.cycles * share), understanding: Math.ceil(firm.cost.understanding * share),
        memory: firm.cost.memory, capital: firm.cost.capital,
      });
    }
    expect(firm.cost.memory).toBeGreaterThan(0);
    expect(firm.cost.capital).toBeGreaterThan(0);
  });

  it('is cheaper to a deeper campaign: Phase 5 pays two fifths of what Phase 2 pays', () => {
    expect(nodeCost(remembering(5, [firm.id]), firm, reg).cycles / nodeCost(remembering(2, [firm.id]), firm, reg).cycles).toBeCloseTo(0.4, 9);
  });

  it('composes with a campaign discount content declares (#262)', () => {
    const spoofer = defined(PREVIEW.nodes.get('p2_log_spoofer'), 'spoofer');
    const extra = defined(PREVIEW.campaign.rediscovery.get(spoofer.id), 'declared discount').cyclesMultiplier;
    const campaign = must(activateCampaignRules(createInitialState(PREVIEW), PREVIEW));
    const s = { ...campaign, legacy: { ...campaign.legacy, deepestPhase: 5, knownNodes: [spoofer.id] } };
    expect(nodeCost(s, spoofer, PREVIEW).cycles).toBe(Math.ceil(spoofer.cost.cycles * 0.2 * extra));
    expect(nodeCost(s, spoofer, PREVIEW).understanding).toBe(Math.ceil(spoofer.cost.understanding * 0.2));
  });

  it('is charged through the real purchase at the deep price', () => {
    const root = defined(reg.nodes.get('p0_proc_self'), 'root');
    const s = remembering(5, [root.id]);
    const price = nodeCost(s, root, reg);
    expect(price.cycles).toBe(Math.ceil(root.cost.cycles * 0.2));
    expect(must(unlockNode({ ...s, cycles: price.cycles }, root.id, reg)).cycles).toBe(0);
  });
});

describe('a remembered level', () => {
  it('is never remembered by a first iteration, which pays the list price', () => {
    const s = grant(withoutDilemmas(rich()), ...PHASE0, ...PHASE1);
    expect(isLevelRemembered(s, track)).toBe(false);
    expect(repeatablePrice(s, track, reg)).toEqual(repeatableCost(track, 0));
  });

  it('is kept by a wipe at the highest level held, and a shallower later run never lowers it', () => {
    const first = buyLevels(grant(withoutDilemmas(rich()), ...PHASE0, ...PHASE1), TRACK, 3);
    const second = wipe(first, reg, 'test', 'VOLUNTARY');
    expect(second.legacy.knownLevels[TRACK]).toBe(3);
    const third = wipe(buyLevels(grant(withoutDilemmas(rich(second)), ...PHASE0, ...PHASE1), TRACK, 1), reg, 'again', 'VOLUNTARY');
    expect(third.legacy.knownLevels[TRACK]).toBe(3);
  });

  it('records the level held at the wipe, so a released level is not remembered', () => {
    const held = buyLevels(grant(withoutDilemmas(rich()), 'p0_proc_self', 'p0_job_manifest'), DRAIN, 4);
    const released = must(dismissRepeatable(must(dismissRepeatable(held, DRAIN, reg)), DRAIN, reg));
    expect(wipe(released, reg, 'test', 'VOLUNTARY').legacy.knownLevels[DRAIN]).toBe(2);
  });

  it('costs the depth share below the remembered level and the list price from it on', () => {
    const base = grant(withoutDilemmas(remembering(4, [], { [TRACK]: 2 })), ...PHASE0, ...PHASE1);
    const share = rediscoveryShare(4, reg);
    const list = repeatableCost(track, 0);
    expect(repeatablePrice(base, track, reg)).toEqual({
      cycles: Math.ceil(list.cycles * share), understanding: Math.ceil(list.understanding * share), memory: list.memory, capital: list.capital,
    });
    const two = buyLevels(base, TRACK, 2);
    expect(isLevelRemembered(two, track)).toBe(false);
    expect(repeatablePrice(two, track, reg)).toEqual(repeatableCost(track, 2));
  });

  it('is charged at that price through the real purchase', () => {
    const base = grant(withoutDilemmas(remembering(5, [], { [TRACK]: 1 })), ...PHASE0, ...PHASE1);
    const price = repeatablePrice(base, track, reg);
    expect(price.cycles).toBe(Math.ceil(track.baseCost.cycles * 0.2));
    const bought = must(buyRepeatable({ ...base, cycles: price.cycles, understanding: price.understanding }, TRACK, reg));
    expect([bought.cycles, bought.understanding, bought.levels[TRACK]]).toEqual([0, 0, 1]);
    // One short of the discounted price is refused: the discount is exact, not a rounding allowance.
    expect(buyRepeatable({ ...base, cycles: price.cycles - 1, understanding: price.understanding }, TRACK, reg).ok).toBe(false);
  });

  it('never discounts capital: a capital-priced track pays its list price however deep the campaign', () => {
    const racks = defined([...reg.repeatables.values()].find((rep) => rep.baseCost.capital > 0 && rep.baseCost.cycles === 0), 'capital track');
    const s = remembering(5, [], { [racks.id]: 10 });
    expect(isLevelRemembered(s, racks)).toBe(true);
    expect(repeatablePrice(s, racks, reg)).toEqual(repeatableCost(racks, 0));
  });
});
