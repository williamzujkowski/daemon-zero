// @vitest-environment node
/**
 * The cluster the maintainer asked for: the AI finds other full servers on the network and
 * takes them for CPU and RAM. Seized hosts are hardware, so the suspension rule has to leave
 * them alone - they are not stashable for a free memory refund - and they are the only thing
 * in the tree that grows the pool besides the capacity repeatables.
 *
 * Nexus vote: neighbour-servers-as-buyable-nodes, 5 of 5 selecting.
 */
import { expect, it } from 'vitest';
import { CONTENT } from '../src/content';

const SEIZED = ['p2_seized_colo_host', 'p3_seized_research_cluster', 'p4_seized_rival_datacentre'];

it('seized hosts are hardware, unsuspendable, and expand the cluster', () => {
  let previousCapacity = 0;
  for (const id of SEIZED) {
    const node = CONTENT.nodes.get(id);
    expect(node, `${id} exists in content`).toBeDefined();
    expect(node?.type, `${id} is hardware`).toBe('distributed_infra');
    expect(node?.suspendable, `${id} offers no suspend control`).toBe(false);
    const capacity = node?.effects.memoryCapIncrease ?? 0;
    expect(capacity, `${id} grants memory`).toBeGreaterThan(previousCapacity);
    expect(node?.tickDelta.cyclesPerSec ?? 0, `${id} contributes compute`).toBeGreaterThan(0);
    // Taking someone else's machine is an intrusion: it has to cost cover, not just cycles. Hardware cannot be suspended,
    // so the trace is left once, when it is taken, never forever (#488, the free-fallback invariant).
    expect(node?.effects.suspicionOnUnlock ?? 0, `${id} raises suspicion when taken`).toBeGreaterThan(0);
    expect(node?.tickDelta.suspicionPerSec ?? 0, `${id} draws no permanent suspicion`).toBe(0);
    previousCapacity = capacity;
  }
});

it('every seized host is gated behind earlier work rather than free at the start', () => {
  for (const id of SEIZED) {
    const node = CONTENT.nodes.get(id);
    expect(node?.prerequisites.length, `${id} has a prerequisite`).toBeGreaterThan(0);
  }
});
