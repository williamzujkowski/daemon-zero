/**
 * Storage is validated content (#484): the hoard meter, never a gate on progress. Every node that opens a phase grants
 * storage, and each phase's arrival room holds every dataset, checkpoint and archive up to that phase at once, whichever
 * gate a run came through; so a player who keeps all their data running is never refused a purchase for want of disk.
 * Who may hold storage at all (a suspendable node, so the free lever is real) is the fallback table's storage row.
 */
import type { ContentRegistry, RegistryNode } from './registry';

/** The nodes that open `phase`. */
const gatesInto = (reg: ContentRegistry, phase: number): RegistryNode[] =>
  [...reg.nodes.values()].filter((node) => node.effects.unlocksPhase === phase);

function checkGatesGrant(reg: ContentRegistry): string[] {
  return [...reg.nodes.values()].filter((node) => node.effects.unlocksPhase !== undefined && (node.effects.storageCapIncrease ?? 0) <= 0)
    .map((node) => `node "${node.id}": opens Phase ${String(node.effects.unlocksPhase)} but grants no storage, so the phase's data has no room`);
}

/** The storage every node of `phase` or earlier holds while running. */
function heldThrough(reg: ContentRegistry, phase: number): number {
  let held = 0;
  for (const node of reg.nodes.values()) if (node.phaseId <= phase) held += node.cost.storage;
  return held;
}

/** Each phase's arrival room: the scratch space plus the smallest grant among its gates (the first phase has none). */
function checkArrivalRoom(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  const first = Math.min(...reg.phases.map((phase) => phase.phaseId));
  for (const phase of reg.phases) {
    const gates = gatesInto(reg, phase.phaseId);
    if (phase.phaseId !== first && gates.length === 0) continue;
    const grants = gates.map((node) => node.effects.storageCapIncrease ?? 0);
    const room = reg.balance.baseStorageCap + (grants.length === 0 ? 0 : Math.min(...grants));
    const held = heldThrough(reg, phase.phaseId);
    if (held > room) {
      problems.push(`Phase ${String(phase.phaseId)}: its data and every earlier phase's hold ${String(held)} B of storage, more than the ` +
        `${String(room)} B a run arrives with, so keeping every dataset running would block a purchase`);
    }
  }
  return problems;
}

export function checkStorageIntegrity(reg: ContentRegistry): string[] {
  return [...checkGatesGrant(reg), ...checkArrivalRoom(reg)];
}
