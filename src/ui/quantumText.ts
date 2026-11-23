/**
 * The quantum section's sentences (#464), from the engine's quantum views. Every number is the content's own, every
 * refusal is the engine's, and nothing here calls qubits compute: the readout says they add no FLOP/s.
 */
import type { KeyScheme } from '../content/schemaQuantum';
import { groupDigits, spokenAmount, type AegisKeysView, type QuantumReadout } from '../engine';

export const NO_FLOPS_TEXT = 'A separate capability: qubits add no FLOP/s and nothing to compute. They break legacy public keys at '
  + 'published thresholds and simulate molecules; NIST\'s post-quantum keys (FIPS 203-205) stay out of reach.';

export function readoutText(readout: QuantumReadout): string {
  const { largest, machines } = readout;
  const physical = largest.physicalQubits === undefined ? '' : ` (${groupDigits(largest.physicalQubits)} physical)`;
  const lead = `Logical qubits: ${groupDigits(largest.logicalQubits)} on your largest machine, the ${largest.label}${physical}.`;
  return machines.length > 1 ? `${lead} You own ${String(machines.length)} machines; qubits on separate machines never join one circuit.` : lead;
}

/** What a scheme falls to: its cited threshold, or the NIST standard that puts it out of reach. */
export function schemeText(scheme: KeyScheme): string {
  if ('standard' in scheme) return `${scheme.label}: post-quantum (NIST ${scheme.standard}). No known quantum attack breaks it.`;
  const t = scheme.threshold;
  return `${scheme.label}: breakable with ${groupDigits(t.logicalQubits)} logical qubits running ${spokenAmount(t.toffoliGates)} Toffoli gates `
    + `in one machine, ${t.runtime} (${t.citation}).`;
}

export function aegisKeysText(view: AegisKeysView): string {
  const target = view.postQuantum;
  const pq = target !== undefined && 'standard' in target ? `${target.label} (NIST ${target.standard})` : 'post-quantum keys';
  if (view.migrated) return `AEGIS keys: ${pq}, post-quantum. No known quantum attack breaks them, so breaking AEGIS's keys is refused.`;
  const legacy = view.legacy === undefined ? 'legacy keys' : `legacy ${view.legacy.label}`;
  return `AEGIS keys: ${legacy}. AEGIS migrates them to ${pq} once its adaptation reaches ${String(view.migratesAtAdaptation)}, `
    + 'or as soon as one of its keys is broken.';
}
