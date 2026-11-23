/**
 * The heat-and-power signature (#482, vote-1795381178260-1ddew5j): suspicion from power is the watts drawn times the
 * visibility of their source, and suspicion from heat is the heat rejected times the visibility of its sink. Classes
 * (world.json) carry the visibility and what makes it visible; holdings say which class their watts use; each phase
 * states how visible watts become suspicion. The engine stage is src/engine/systems/powerSignature.ts.
 */
import { z } from 'zod';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');
const line = z.string().min(1).max(240);

/** A power source or heat sink, and what makes it visible to the people who look (permits, filings, chillers). */
export const SignatureClassSchema = z.strictObject({
  id: snakeId,
  name: z.string().min(1).max(48),
  /** The share of the watts through it that someone could attribute, 0 to 1 (BALANCE.md gives each rationale). */
  visibility: z.number().min(0).max(1),
  /** What is visible, and why: the world view reads this line. */
  tell: line,
  /**
   * A sink where heat leaves only as light (#465): it sheds at most this many watts a square kilometre of deployed
   * radiator, so compute whose heat leaves through it runs at the share its radiator area sheds (engine radiators.ts).
   */
  wattsPerKm2: z.number().positive().optional(),
  /**
   * In orbit (#465): holdings on this class are orbital assets, the hook for orbital jamming and anti-satellite strikes
   * (#520). The engine's orbitalHoldings query lists them; nothing acts on them yet.
   */
  orbital: z.literal(true).optional(),
});

export const SignatureClassesSchema = z.strictObject({
  sources: z.array(SignatureClassSchema).min(1),
  sinks: z.array(SignatureClassSchema).min(1),
});

/** A mitigation: while the holding runs, a class's visibility is multiplied by `factor` (per level on a track). */
export const SignatureMaskSchema = z.strictObject({
  class: snakeId,
  factor: z.number().min(0).lt(1),
});

/** Where a holding's watts come from and where its heat goes. Integrity keeps each field to the holdings it fits. */
export const SignatureSchema = z.strictObject({
  /** The source class of its watts: its own generation (wattsDelta > 0), or with borrowedW a supply it does not own. */
  source: snakeId.optional(),
  /**
   * Watts drawn from a supply the player does not own (a host's socket, a building's mains, victims' devices), never in
   * the power budget; negative on a mitigation that lowers the draw (undervolting, a rack cap).
   */
  borrowedW: z.number().refine((value) => value !== 0, 'a borrowed draw must move the draw').optional(),
  /** The sink class its rejected heat leaves through: a consumer's draw (wattsDelta < 0) once heat leaves server °C. */
  sink: snakeId.optional(),
  masks: z.array(SignatureMaskSchema).min(1).optional(),
  /** Square kilometres of radiator it deploys into its sink (per level on a track): only on a sink that declares wattsPerKm2. */
  radiatorKm2: z.number().positive().optional(),
});

/** How a phase turns visible watts into suspicion: linear in the visible watts, up to a ceiling. */
export const PowerSignatureRuleSchema = z.strictObject({
  /** Suspicion per second at exactly the reference visible watts. */
  suspicionPerSecAtReference: z.number().positive(),
  /** Visible watts (watts times visibility) at which the draw is stated: a size typical of the phase (BALANCE.md). */
  referenceVisibleWatts: z.number().positive(),
  /** The ceiling, so the phase's answers can always keep pace. */
  maxSuspicionPerSec: z.number().positive(),
});

export type SignatureClass = z.infer<typeof SignatureClassSchema>;
export type SignatureClasses = z.infer<typeof SignatureClassesSchema>;
export type Signature = z.infer<typeof SignatureSchema>;
export type PowerSignatureRule = z.infer<typeof PowerSignatureRuleSchema>;
