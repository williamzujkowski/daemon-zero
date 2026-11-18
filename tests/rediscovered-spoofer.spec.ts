/**
 * #262's decided balance change (nexus i262-return-balance, cheaper-rediscovered-spoofer): under
 * campaign rules a returning instance rediscovers the log spoofer for 6,250 cycles instead of 12,500.
 * First mappings, legacy rules, production and every other node keep their prices, and the price is
 * derived, so a save round trip neither stores nor changes it.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PREVIEW } from '../src/content';
import type { ContentRegistry } from '../src/content/registry';
import {
  activateCampaignRules, createInitialState, deserialize, exportSave, importSave, nodeCost, serialize, unlockNode, wipe, type GameState,
} from '../src/engine';
import { must, PHASE0, PHASE1, rich, ORIGINAL_GAME } from './helpers';
import { defined } from './m7-helpers';

const SPOOFER = 'p2_log_spoofer';
const route = [...PHASE0, ...PHASE1, 'p2_arp_discovery', SPOOFER];

/** An instance that mapped the spoofer, wiped: the next one remembers it. */
function returning(reg: ContentRegistry, campaign: boolean): GameState {
  const start = rich(createInitialState(reg));
  const first = campaign ? must(activateCampaignRules(start, reg)) : start;
  return rich(wipe(route.reduce((s, id) => must(unlockNode(s, id, reg)), first), reg, 'test', 'VOLUNTARY'));
}
const spoofer = (reg: ContentRegistry) => defined(reg.nodes.get(SPOOFER));

describe('the rediscovered log spoofer under campaign rules', () => {
  it('costs a returning instance 6,250 cycles, half the ordinary 12,500; understanding and memory are unchanged', () => {
    const node = spoofer(PREVIEW);
    expect(node.cost).toEqual({ cycles: 25000, understanding: 4000, memory: 64, capital: 0 });
    const s = returning(PREVIEW, true);
    expect(s.legacy.knownNodes).toContain(SPOOFER);
    expect(nodeCost(s, node, PREVIEW)).toEqual({ cycles: 6250, understanding: 2000, memory: 64, capital: 0 });
  });

  it('keeps the first mapping at the full price', () => {
    const first = must(activateCampaignRules(rich(createInitialState(PREVIEW)), PREVIEW));
    expect(nodeCost(first, spoofer(PREVIEW), PREVIEW).cycles).toBe(25000);
  });

  it('keeps the ordinary 12,500 under legacy rules, in production and in the original game', () => {
    expect(nodeCost(returning(PREVIEW, false), spoofer(PREVIEW), PREVIEW).cycles).toBe(12500);
    const production = returning(ORIGINAL_GAME, false);
    expect(nodeCost(production, spoofer(ORIGINAL_GAME), ORIGINAL_GAME).cycles).toBe(12500);
    // The original game declares no discount, so even campaign rules would read none there.
    expect(ORIGINAL_GAME.campaign.rediscovery.size).toBe(0);
  });

  it('changes no other remembered node', () => {
    const campaign = returning(PREVIEW, true);
    const legacy = { ...campaign, narrativeRules: 'legacy' as const };
    for (const id of campaign.legacy.knownNodes.filter((known) => known !== SPOOFER)) {
      const node = defined(PREVIEW.nodes.get(id));
      expect(nodeCost(campaign, node, PREVIEW)).toEqual(nodeCost(legacy, node, PREVIEW));
    }
    expect(PREVIEW.campaign.rediscovery.size).toBe(1);
  });

  it('is unaffected by a save round trip, through the save code and the storage codec', () => {
    const s = returning(PREVIEW, true);
    for (const back of [importSave(exportSave(s), PREVIEW), deserialize(serialize(s), PREVIEW)]) {
      expect(back.narrativeRules).toBe('campaign_v1');
      expect(back.legacy.knownNodes).toEqual(s.legacy.knownNodes);
      expect(nodeCost(back, spoofer(PREVIEW), PREVIEW).cycles).toBe(6250);
    }
    const legacy = returning(PREVIEW, false);
    expect(nodeCost(importSave(exportSave(legacy), PREVIEW), spoofer(PREVIEW), PREVIEW).cycles).toBe(12500);
  });
});
