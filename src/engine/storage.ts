/**
 * Storage (#484, vote-1795381354324-4br7z6t): disk, tape and archive, a cap apart from working memory. Running data
 * (a dataset, a checkpoint, an archive: a suspendable node's `cost.storage`) holds it; owned nodes' `storageCapIncrease`
 * and the balance scratch space provide it. Ownership is the only thing that moves either, so both are derived from it.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { GameState } from './state';

export function freeStorage(s: Pick<GameState, 'storageCap' | 'storageUsed'>): number {
  return s.storageCap - s.storageUsed;
}

/** The storage running nodes hold: each owned node's `cost.storage` while it is not suspended. */
export function storageHeld(s: GameState, reg: ContentRegistry): number {
  let held = 0;
  for (const id of s.unlockedNodes) if (!s.disabledNodes.includes(id)) held += reg.nodes.get(id)?.cost.storage ?? 0;
  return held;
}

/** The storage capacity ownership provides: the scratch space plus every owned node's grant, suspended or not. */
export function storageCapacity(s: GameState, reg: ContentRegistry): number {
  let cap = reg.balance.baseStorageCap;
  for (const id of s.unlockedNodes) cap += reg.nodes.get(id)?.effects.storageCapIncrease ?? 0;
  return cap;
}

/**
 * Storage as ownership implies it, on every load: what is held is exactly what running data holds, and capacity is at
 * least what owned grants give. A save migrated from before v20 carries only the scratch space, so it loads with its
 * grants; a larger saved capacity is kept, as memory's is (a development grant raises it).
 */
export function reconcileStorage(s: GameState, reg: ContentRegistry): GameState {
  return { ...s, storageUsed: storageHeld(s, reg), storageCap: Math.max(s.storageCap, storageCapacity(s, reg)) };
}

/** Draft-only: a running node stops holding its storage (suspended, withheld or burned). */
export function releaseStorage(d: GameState, node: RegistryNode): void {
  d.storageUsed = Math.max(0, d.storageUsed - node.cost.storage);
}
