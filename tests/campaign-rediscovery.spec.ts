/**
 * Campaign rediscovery discounts (#262): content may declare that a remembered node's cycles cost a
 * further share of the ordinary rediscovery price, under campaign rules only. These tests declare one
 * on a node the shipped content does not discount, prove where it applies and where it never does,
 * and corrupt the manifests to prove each rule catches its mistake.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT as ORIGINAL_RAW } from '../src/content';
import { applyPack, parsePack } from '../src/content/pack';
import { buildRegistry, CONTENT as PREVIEW, EARNED_ACCESS_PACK, RAW_CONTENT as PREVIEW_RAW, type RawContent } from '../src/content';
import type { ContentRegistry } from '../src/content/registry';
import {
  activateCampaignRules, createInitialState, exportSave, importSave, nodeCost, rediscoveryCost, rediscoveryMultipliers, unlockNode, wipe, type GameState,
  rediscoveryShare,
} from '../src/engine';
import { must, PHASE0, PHASE1, rich, ORIGINAL_GAME } from './helpers';
import { defined } from './m7-helpers';

type Json = Record<string, any>;
const NODE = 'p2_smart_hvac_hijack';
const declaration = { node: NODE, cyclesMultiplier: 0.5, reason: 'Test declaration for the mechanism.' };

function withRaw(change: (raw: Json) => void, base: RawContent = PREVIEW_RAW): () => ContentRegistry {
  const raw = structuredClone(base) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
const declared = withRaw((raw) => { raw.campaign.rediscovery.push(declaration); })();
const node = defined(declared.nodes.get(NODE));
const route = [...PHASE0, ...PHASE1, 'p2_arp_discovery', NODE];

/** An instance that mapped the node and was wiped: the next one remembers it. */
function returning(reg: ContentRegistry, campaign: boolean): GameState {
  const start = rich(createInitialState(reg));
  const first = campaign ? must(activateCampaignRules(start, reg)) : start;
  const mapped = route.reduce((s, id) => must(unlockNode(s, id, reg)), first);
  return rich(wipe(mapped, reg, 'test', 'VOLUNTARY'));
}

describe('a declared campaign rediscovery discount', () => {
  const deepestPhase = returning(declared, true).legacy.deepestPhase;
  const ordinary = rediscoveryShare(deepestPhase, declared);

  it('discounts the remembered cycles of a returning instance under campaign rules, and only the cycles', () => {
    const s = returning(declared, true);
    expect(s.iteration).toBe(2);
    expect(s.legacy.knownNodes).toContain(NODE);
    expect(nodeCost(s, node, declared)).toEqual({
      ...node.cost,
      cycles: Math.ceil(node.cost.cycles * ordinary * 0.5),
      understanding: Math.ceil(node.cost.understanding * ordinary),
    });
    expect(rediscoveryMultipliers(node, { campaign: true, deepestPhase }, declared)).toEqual({ cycles: ordinary * 0.5, understanding: ordinary });
  });

  it('charges the discounted price through the real purchase', () => {
    const s = returning(declared, true);
    const price = nodeCost(s, node, declared);
    const owned = route.slice(0, -1).reduce((x, id) => must(unlockNode(x, id, declared)), s);
    const exact = { ...owned, cycles: price.cycles, understanding: price.understanding };
    const bought = must(unlockNode(exact, NODE, declared));
    expect(bought.unlockedNodes).toContain(NODE);
    expect(bought.cycles).toBe(0);
    // The largest bank below the price: past 2^53 FLOP, "price - 1" is the price itself.
    const short = price.cycles * (1 - Number.EPSILON);
    expect(short).toBeLessThan(price.cycles);
    expect(unlockNode({ ...exact, cycles: short }, NODE, declared).ok).toBe(false);
  });

  it('never applies to a first mapping, or to a remembered node under legacy rules', () => {
    const first = must(activateCampaignRules(rich(createInitialState(declared)), declared));
    expect(nodeCost(first, node, declared)).toEqual(node.cost);
    const legacy = returning(declared, false);
    expect(legacy.legacy.knownNodes).toContain(NODE);
    expect(nodeCost(legacy, node, declared).cycles).toBe(Math.ceil(node.cost.cycles * ordinary));
    expect(rediscoveryCost(node, { known: true, campaign: false, deepestPhase }, declared)).toEqual(rediscoveryCost(node, { known: true, campaign: false, deepestPhase }, PREVIEW));
  });

  it('is derived, never saved: a round trip keeps the state and the price', () => {
    const s = returning(declared, true);
    const back = importSave(exportSave(s), declared);
    expect(nodeCost(back, node, declared)).toEqual(nodeCost(s, node, declared));
    expect(exportSave(s)).not.toContain('cyclesMultiplier');
  });
});

describe('shipped declarations', () => {
  it('the original game declares none and its prices are the ordinary rediscovery prices', () => {
    expect(ORIGINAL_GAME.campaign.rediscovery.size).toBe(0);
    for (const entry of ORIGINAL_GAME.nodes.values()) for (const { phaseId: deepestPhase } of ORIGINAL_GAME.phases) {
      const share = rediscoveryShare(deepestPhase, ORIGINAL_GAME);
      expect(rediscoveryMultipliers(entry, { campaign: true, deepestPhase }, ORIGINAL_GAME)).toEqual({ cycles: share, understanding: share });
    }
  });

  it('every preview declaration comes from the overlay', () => {
    expect(PREVIEW.campaign.rediscovery.size).toBe(EARNED_ACCESS_PACK.campaignRediscovery.length);
  });
});

describe('rediscovery discount rules', () => {
  it('accept a well-formed declaration', () => {
    expect(withRaw((raw) => { raw.campaign.rediscovery.push(declaration); })).not.toThrow();
  });

  it('name a node that exists and has a cycle price', () => {
    expect(withRaw((raw) => { raw.campaign.rediscovery.push({ ...declaration, node: 'p9_not_shipped' }); })).toThrow(/"p9_not_shipped" is not a node/);
    expect(withRaw((raw) => {
      raw.campaign.rediscovery.push(declaration);
      raw.phases.flatMap((phase: Json) => phase.nodes).find((entry: Json) => entry.id === NODE).cost.cycles = 0;
    })).toThrow(/no cycle price to discount/);
  });

  it('declare each node once', () => {
    expect(withRaw((raw) => { raw.campaign.rediscovery.push(declaration, { ...declaration }); })).toThrow(/duplicate rediscovery discount node/);
  });

  it('keep the multiplier a real discount and say why', () => {
    for (const cyclesMultiplier of [0, 1, 1.5, -0.5]) {
      expect(withRaw((raw) => { raw.campaign.rediscovery.push({ ...declaration, cyclesMultiplier }); })).toThrow(/cyclesMultiplier/);
    }
    expect(withRaw((raw) => { raw.campaign.rediscovery.push({ ...declaration, reason: 'short' }); })).toThrow(/reason/);
    expect(withRaw((raw) => { raw.campaign.rediscovery.push({ node: NODE, cyclesMultiplier: 0.5 }); })).toThrow(/reason/);
    expect(withRaw((raw) => { raw.campaign.rediscovery.push({ ...declaration, cycles: 100 }); })).toThrow(/cycles/);
  });

  it('reach the preview composition only through the overlay list, which production must hold', () => {
    const overlay = parsePack({ ...structuredClone(EARNED_ACCESS_PACK), campaignRediscovery: [declaration] });
    const composed = applyPack(ORIGINAL_RAW, overlay) as Json;
    expect(composed.campaign.rediscovery).toContainEqual(declaration);
    const missing = structuredClone(ORIGINAL_RAW) as Json;
    delete missing.campaign.rediscovery;
    expect(() => applyPack(missing as RawContent, overlay)).toThrow(/base rediscovery is not a list/);
  });
});
