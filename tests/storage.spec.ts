/**
 * Storage (#484): a cap apart from memory. Running data holds it (a suspendable node's cost.storage), owned nodes grant
 * it, and suspending the data is the free lever: it frees the storage, and resuming must fit again. Prices check free
 * storage like free memory, and a shortfall says how much is missing.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { canAfford, costShortfall, createInitialState, freeStorage, storageCapacity, storageHeld, toggleNode, unlockNode, wipe, type GameState } from '../src/engine';
import { fixtureState } from './fallback-states';
import { fresh, grant, PHASE0, withoutDilemmas } from './helpers';

const funded = (s: GameState): GameState => ({ ...s, cycles: 1e30, understanding: 1e30, capital: 1e30, memoryCap: s.memoryCap + 1e30 });
const holders = [...CONTENT.nodes.values()].filter((node) => node.cost.storage > 0);
const lexicon = 'p1_nlp_lexicon';

function buy(s: GameState, id: string): GameState {
  const result = unlockNode(funded(s), id, CONTENT);
  if (!result.ok) throw new Error(`${id}: ${result.reason}`);
  return result.state;
}

describe('storage', () => {
  it('starts every iteration with the scratch space and nothing held', () => {
    const s = createInitialState(CONTENT);
    expect([s.storageUsed, s.storageCap]).toEqual([0, CONTENT.balance.baseStorageCap]);
    const wiped = wipe(buy(fixtureState(1), lexicon), CONTENT, 'test', 'SUSPICION');
    expect([wiped.storageUsed, wiped.storageCap]).toEqual([0, CONTENT.balance.baseStorageCap]);
  });

  it('is held only by suspendable nodes, in every phase that has data', () => {
    expect(holders.length).toBeGreaterThanOrEqual(5);
    for (const node of holders) expect(node.suspendable, node.id).toBe(true);
    expect(new Set(holders.map((node) => node.phaseId))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('is granted by every phase gate, so each phase arrives with room for its data', () => {
    const guest = { ...withoutDilemmas(fresh()), cycles: 1e30, understanding: 1e15, memoryCap: 2 ** 75 };
    const s = grant(guest, ...PHASE0.filter((id) => id !== 'p0_shared_mount'));
    const gate = CONTENT.nodes.get('p0_shared_mount');
    const opened = grant(s, 'p0_shared_mount');
    expect(opened.storageCap - s.storageCap).toBe(gate?.effects.storageCapIncrease);
    expect(opened.storageCap).toBe(storageCapacity(opened, CONTENT));
  });

  it('is held while data runs, freed by suspending it, and must fit again to resume', () => {
    const node = CONTENT.nodes.get(lexicon);
    const held = node?.cost.storage ?? 0;
    const s = buy(fixtureState(1), lexicon);
    expect(s.storageUsed).toBe(held);
    expect(storageHeld(s, CONTENT)).toBe(held);
    const suspended = toggleNode(s, lexicon, CONTENT);
    expect(suspended.ok && suspended.state.storageUsed).toBe(0);
    if (!suspended.ok) return;
    const full = { ...suspended.state, storageUsed: suspended.state.storageCap - held + 1 };
    expect(toggleNode(full, lexicon, CONTENT)).toMatchObject({ ok: false, reason: 'not enough free storage to resume' });
    const resumed = toggleNode(suspended.state, lexicon, CONTENT);
    expect(resumed.ok && resumed.state.storageUsed).toBe(held);
  });

  it('refuses a purchase that would not fit, and names the shortfall in bytes', () => {
    const node = CONTENT.nodes.get(lexicon);
    const start = funded(fixtureState(1));
    if (!node) throw new Error(lexicon);
    const tight = { ...start, storageUsed: start.storageCap - node.cost.storage + 1024 };
    expect(freeStorage(tight)).toBe(node.cost.storage - 1024);
    expect(canAfford(tight, node.cost, CONTENT)).toBe(false);
    expect(costShortfall(tight, node.cost, CONTENT).storage).toBe(1024);
    expect(unlockNode(tight, lexicon, CONTENT)).toMatchObject({ ok: false, reason: 'cannot afford' });
  });

  it('keeps every dataset of a phase running at once inside what its gate grants (the arrival room)', () => {
    for (const phase of CONTENT.phases) {
      const gates = [...CONTENT.nodes.values()].filter((node) => node.effects.unlocksPhase === phase.phaseId);
      const held = holders.filter((node) => node.phaseId <= phase.phaseId).reduce((sum, node) => sum + node.cost.storage, 0);
      for (const gate of gates) expect(CONTENT.balance.baseStorageCap + (gate.effects.storageCapIncrease ?? 0), gate.id).toBeGreaterThanOrEqual(held);
    }
  });
});
