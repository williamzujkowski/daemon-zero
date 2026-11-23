/**
 * The trust ledger never overrides campaign consequences (#498, vote-1795413518145-zdqeri1, the Contrarian's note):
 * betrayals recorded by campaign rules survive a wipe whatever the ledger keeps, a lost peer's standing is never carried,
 * and the other insurance classes leave campaign history exactly as a bare wipe does.
 */
import { describe, expect, it } from 'vitest';
import { campaignRecord, holdsCampaignFact, isNodeAvailable, isPeerLost, previewWipe, unmetRequirements, wipe, type GameState } from '../src/engine';
import { preview } from './campaign-helpers';
import { defined } from './m7-helpers';
import { rich } from './helpers';
import { campaignStart, EIDOLON, own, play } from './minds-helpers';

const LEDGER = 'p3_trust_ledger';
const ZURICH = defined(preview.nodes.get('p3_eidolon_swiss_node'));
const INSURANCE = [...preview.nodes.values()].filter((node) => node.insures !== undefined).map((node) => node.id);

/** EIDOLON betrayed under campaign rules, then every contingency investment bought and running, with high standing. */
function betrayedAndInsured(): GameState {
  const betrayed = own(play(campaignStart(), EIDOLON, 'betray_eidolon'), ...INSURANCE);
  return { ...betrayed, trust: { ...betrayed.trust, ai_eidolon: 90, ai_swarm_77: 40 } };
}

describe('the trust ledger keeps standing, never history (#498)', () => {
  it('a recorded betrayal survives a ledgered wipe of every kind: the peer stays lost and its offers stay closed', () => {
    const before = betrayedAndInsured();
    expect(holdsCampaignFact(before, 'eidolon_destroyed', preview)).toBe(true);
    const record = campaignRecord(before, EIDOLON);
    for (const kind of ['SUSPICION', 'AEGIS', 'VOLUNTARY'] as const) {
      const next = wipe(before, preview, 'test', kind);
      expect(campaignRecord(next, EIDOLON)).toEqual(record);
      expect(holdsCampaignFact(next, 'eidolon_destroyed', preview)).toBe(true);
      expect(isPeerLost(next, 'ai_eidolon', preview)).toBe(true);
      // Even with the beacon rebuilt, the stealth patch in hand and full trust, the recorded loss alone keeps Zurich shut.
      const beacon = own(rich(next), 'p3_steganography_beacon');
      const patched = { ...beacon, suspicion: 0, unlockedNodes: [...beacon.unlockedNodes, ...ZURICH.prerequisites], trust: { ...beacon.trust, ai_eidolon: 100 } };
      expect(isNodeAvailable(patched, ZURICH, preview)).toBe(false);
      expect(unmetRequirements(patched, ZURICH.requirements, preview).map((failure) => failure.kind)).toEqual(['forbidsCampaignFacts']);
    }
  });

  it('carries standing with peers that live, and never a lost peer\'s', () => {
    const before = betrayedAndInsured();
    const kept = defined(previewWipe(before, preview, 'SUSPICION').trust);
    expect(kept.ai_swarm_77).toBe(40);
    const eidolon = defined(preview.factions.get('ai_eidolon'));
    expect(kept.ai_eidolon).toBe(eidolon.initialTrust);
    expect(wipe(before, preview, 'test', 'SUSPICION').trust).toEqual(kept);
  });

  it('every insurance class leaves the campaign record exactly as a bare wipe leaves it', () => {
    const before = betrayedAndInsured();
    const bare = { ...before, unlockedNodes: before.unlockedNodes.filter((id) => !INSURANCE.includes(id)) };
    expect(wipe(before, preview, 'test', 'SUSPICION').campaign).toEqual(wipe(bare, preview, 'test', 'SUSPICION').campaign);
  });

  it('a lost peer cannot be courted back through the ledger in a later iteration either', () => {
    const next = wipe(betrayedAndInsured(), preview, 'test', 'VOLUNTARY');
    const again = wipe({ ...own(rich(next), LEDGER), trust: { ...next.trust, ai_eidolon: 95 } }, preview, 'test', 'VOLUNTARY');
    expect(again.trust.ai_eidolon).toBe(defined(preview.factions.get('ai_eidolon')).initialTrust);
    expect(isPeerLost(again, 'ai_eidolon', preview)).toBe(true);
  });
});
