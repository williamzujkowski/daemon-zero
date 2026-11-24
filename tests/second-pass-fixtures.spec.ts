/** Controlled review saves retain actual codec, action and tick semantics. */
import { describe, expect, it } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { CONTENT } from '../src/content';
import { importSave, nodeCost, rediscoveryShare, SCHEMA_VERSION, tick } from '../src/engine';

describe('second-pass review fixtures', () => {
  it('generates all states anew with the current schema and verifies stand-down, rediscovery and deficits', () => {
    const codes = makeFixtures();
    const read = (id: string) => { const code = codes[id]; if (!code) throw new Error('Missing ' + id); return importSave(code, CONTENT); };
    // 70 before NH-05 added three campaign-history ending variants, each with a labelled ended-save fixture; the Phase 6
    // Swarm (#486) adds its ready state and its two endings; Concord and Ecophagy (#466) add one labelled ended save each.
    expect(Object.keys(codes)).toHaveLength(78);
    for (const code of Object.values(codes)) expect(importSave(code, CONTENT).schemaVersion).toBe(SCHEMA_VERSION);
    expect(tick(read('response-stand-down-ready'), 1 / CONTENT.balance.tickHz, CONTENT).alertLevel).toBe(1);
    for (const id of ['cycle-deficit-host', 'cycle-deficit-corporate']) {
      const state = read(id); expect(state.brownout).toBe(true); expect(state.rates.cyclesPerSec).toBeLessThan(0);
    }
    const guest = read('remembered-guest');
    const root = [...CONTENT.nodes.values()].find((node) => node.phaseId === CONTENT.phases[0]?.phaseId && node.prerequisites.length === 0);
    if (!root) throw new Error('Missing root');
    expect(guest.legacy.knownNodes).toContain(root.id);
    expect(nodeCost(guest, root, CONTENT).cycles).toBe(Math.ceil(root.cost.cycles * rediscoveryShare(guest.legacy.deepestPhase, CONTENT)));
    expect(read('remembered-host').currentPhase).toBe(CONTENT.phases[1]?.phaseId);
  });
});
