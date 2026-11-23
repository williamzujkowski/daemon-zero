/**
 * What quantum key-breaking has done this iteration (#464): which targets' keys were broken, and whether AEGIS has
 * migrated to post-quantum keys. A wipe starts both over, as it starts AEGIS's adaptation over. Rules are in quantum.ts.
 */
import { z } from 'zod';

export const QuantumStateSchema = z.strictObject({
  /** Targets broken this iteration, in the order broken: each is broken at most once. */
  broken: z.array(z.string()),
  /** AEGIS has re-keyed under its post-quantum scheme this iteration; it never reverts within it. */
  aegisMigrated: z.boolean(),
});

export type QuantumState = z.infer<typeof QuantumStateSchema>;

export function initialQuantum(): QuantumState {
  return { broken: [], aegisMigrated: false };
}
