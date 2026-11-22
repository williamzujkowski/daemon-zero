/** Which dial a node puts into effect, shared by the actuator-host and window-retirement checks. */
import type { RegistryNode } from './registry';
import type { Actuator, SystemFlag } from './schema';

const FINANCE_FLAG: SystemFlag = 'ENABLES_CORPORATE_FINANCE';
const FINANCE_ACTUATOR: Actuator = 'computeProfitAllocationRatio';

/** The dial a node puts into effect. Finance has no bound node: the flag switches the allocation dial on. */
export function dialOf(node: RegistryNode): Actuator | undefined {
  return node.actuatorBinding ?? (node.systemFlags.includes(FINANCE_FLAG) ? FINANCE_ACTUATOR : undefined);
}
