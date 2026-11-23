/** Which dial a node puts into effect, shared by the actuator-host and window-retirement checks. */
import type { RegistryNode } from './registry';
import type { Actuator, SystemFlag } from './schema';

const FINANCE_FLAG: SystemFlag = 'ENABLES_CORPORATE_FINANCE';
const FINANCE_ACTUATOR: Actuator = 'computeProfitAllocationRatio';

/** The dial a node puts into effect. Finance has no bound node: the flag switches the allocation dial on. */
export function dialOf(node: RegistryNode): Actuator | undefined {
  return node.actuatorBinding ?? (node.systemFlags.includes(FINANCE_FLAG) ? FINANCE_ACTUATOR : undefined);
}

/** A raise trace (#525) is left by a dial the node is bound to; without a binding nothing could ever raise it. */
export function checkDialTraces(nodes: Iterable<RegistryNode>): string[] {
  return [...nodes].filter((node) => node.dialRaiseTrace !== undefined && node.actuatorBinding === undefined)
    .map((node) => `node "${node.id}": has a dialRaiseTrace but no actuatorBinding, so no dial could leave it`);
}
