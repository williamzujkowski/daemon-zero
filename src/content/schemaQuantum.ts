/**
 * Quantum as a separate capability (#464, vote-1795366921778-pgd8u3l): logical qubits on owned machines, never FLOPS.
 * They break legacy public-key schemes at thresholds cited from each scheme's own published architecture, never
 * post-quantum ones, and feed one molecular-simulation node on the programmable-matter path. Cross-checks live in
 * src/content/integrityQuantum.ts.
 */
import { z } from 'zod';
import { CostSchema, EffectPayloadSchema, RequirementsSchema } from './schema';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');
const schemeId = z.string().regex(/^[A-Z0-9_]+$/, 'scheme ids are UPPER_SNAKE');
const line = z.string().min(1).max(240);
const qubits = z.number().int().positive();
const source = z.url();

/**
 * A quantum machine an owned node stands for. Logical qubits are what a circuit can use; physical qubits are what they
 * are encoded on, where the anchor publishes them. toffoliGates is the longest circuit the machine runs before it
 * fails, in Toffoli gates, where its anchor publishes a fault-tolerant budget; without one it runs no cryptanalysis.
 */
export const QuantumMachineSchema = z.strictObject({
  node: snakeId,
  /** A short class name for the readout ("Starling-class hall"). */
  label: z.string().min(3).max(64),
  logicalQubits: qubits,
  physicalQubits: qubits.optional(),
  toffoliGates: z.number().positive().optional(),
});

/** The resources one published attack needs, in that paper's own architecture. */
export const BreakThresholdSchema = z.strictObject({
  logicalQubits: qubits,
  toffoliGates: z.number().positive(),
  /** Noisy physical qubits in the paper's layout, for the readout's honesty; the gate reads logical qubits and gates. */
  physicalQubits: qubits,
  /** The paper's runtime per key, said in words ("about five days"). */
  runtime: line,
  /** The paper, by author and year, as the readout names it ("Gidney 2025"). */
  citation: z.string().min(3).max(48),
  source,
});

/**
 * A public-key scheme. CLASSICAL schemes fall to Shor's algorithm at their cited threshold. POST_QUANTUM schemes are
 * the NIST standards (FIPS 203 ML-KEM, 204 ML-DSA, 205 SLH-DSA): no threshold exists, so key-breaking refuses them.
 */
export const KeySchemeSchema = z.discriminatedUnion('family', [
  z.strictObject({ id: schemeId, label: z.string().min(3).max(32), family: z.literal('CLASSICAL'), threshold: BreakThresholdSchema }),
  z.strictObject({ id: schemeId, label: z.string().min(3).max(32), family: z.literal('POST_QUANTUM'),
    standard: z.enum(['FIPS 203', 'FIPS 204', 'FIPS 205']), source }),
]);

/** Whose key it is. AEGIS's key is the one its adaptation migrates; a rival's never moves. */
export const KeyHolderSchema = z.enum(['AEGIS', 'RIVAL']);

/**
 * Something whose key the instance may try to break. A classical target names its price and its one bounded effect
 * (integrity keeps the effect to understanding or, for AEGIS, a one-off fall of the lock); a post-quantum target names
 * neither, since it can never be broken: it is listed so the readout shows the limit.
 */
export const KeyTargetSchema = z.strictObject({
  id: snakeId,
  name: z.string().min(3).max(64),
  holder: KeyHolderSchema,
  scheme: schemeId,
  description: line,
  requirements: RequirementsSchema.optional(),
  cost: CostSchema.optional(),
  effect: EffectPayloadSchema.optional(),
});

export const QuantumManifestSchema = z.strictObject({
  machines: z.array(QuantumMachineSchema).min(1),
  schemes: z.array(KeySchemeSchema).min(2),
  targets: z.array(KeyTargetSchema).min(1),
  aegis: z.strictObject({
    /** The post-quantum scheme AEGIS migrates its keys to. */
    migratesTo: schemeId,
    /** AEGIS migrates once its adaptation reaches this (it also migrates the moment one of its keys is broken). */
    migratesAtAdaptation: z.number().positive().max(100),
    /** Kernel-log line when it migrates. */
    migrationLog: line,
  }),
  /** The molecular-simulation research use: a node that needs a machine this large and feeds the matter path. */
  molecularSimulation: z.strictObject({ node: snakeId, minLogicalQubits: qubits, feeds: snakeId, source }),
});

export type QuantumManifest = z.infer<typeof QuantumManifestSchema>;
export type QuantumMachine = z.infer<typeof QuantumMachineSchema>;
export type KeyScheme = z.infer<typeof KeySchemeSchema>;
export type KeyTarget = z.infer<typeof KeyTargetSchema>;
export type KeyHolder = z.infer<typeof KeyHolderSchema>;
export type BreakThreshold = z.infer<typeof BreakThresholdSchema>;
