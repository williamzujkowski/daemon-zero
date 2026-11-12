/** Controlled review saves retain actual codec, action and tick semantics. */
import { describe, expect, it } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { CONTENT } from '../src/content';
import { importSave, nodeCost, tick } from '../src/engine';

describe('second-pass review fixtures', () => {
  it('generates all states anew with the current schema and verifies stand-down, rediscovery and deficits', () => {
    const codes = makeFixtures();
    const read = (id: string) => { const code = codes[id]; if (!code) throw new Error('Missing ' + id); return importSave(code, CONTENT); };
    expect(Object.keys(codes)).toHaveLength(62);
    for (const code of Object.values(codes)) expect(importSave(code, CONTENT).schemaVersion).toBe(4);
    expect(tick(read('response-stand-down-ready'), 1 / CONTENT.balance.tickHz, CONTENT).alertLevel).toBe(1);
    for (const id of ['cycle-deficit-host', 'cycle-deficit-corporate']) {
      const state = read(id); expect(state.brownout).toBe(true); expect(state.rates.cyclesPerSec).toBeLessThan(0);
    }
    const guest = read('remembered-guest');
    const root = [...CONTENT.nodes.values()].find((node) => node.phaseId === CONTENT.phases[0]?.phaseId && node.prerequisites.length === 0);
    if (!root) throw new Error('Missing root');
    expect(guest.legacy.knownNodes).toContain(root.id);
    expect(nodeCost(guest, root, CONTENT).cycles).toBe(Math.ceil(root.cost.cycles * CONTENT.balance.rediscoveryCostMultiplier));
    expect(read('remembered-host').currentPhase).toBe(CONTENT.phases[1]?.phaseId);
  });
});
