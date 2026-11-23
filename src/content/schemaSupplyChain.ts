/**
 * The fabrication ladder and supply-chain closure (#485, vote-1795381358337-jw73j7a). Capability and closure are kept
 * apart: the ladder ranks what the AI can make, from bought chips to EUV, and any listed node reaches a rung; closure is
 * the share of listed chokepoints the AI supplies itself, each through exactly one self-supply node. Both are derived
 * from what is owned, so neither adds state. Cross-checks live in src/content/integritySupplyChain.ts.
 */
import { z } from 'zod';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');
const line = z.string().min(1).max(240);

/** A capability rung. The first is the baseline every run starts on (bought chips) and names no node. */
export const LadderRungSchema = z.strictObject({
  label: z.string().min(1).max(48),
  /** Owning any one of these reaches the rung: an imported tool and a self-built one can reach the same capability. */
  nodes: z.array(snakeId),
});

/** A supply chokepoint: who supplies it today, and the one node that makes the AI its own supplier. */
export const ChokepointSchema = z.strictObject({
  id: snakeId,
  name: z.string().min(1).max(48),
  /** The concentration it stands for, from the research (section G.3, G.6): the world view reads this line. */
  tell: line,
  /** Owning this node, and only this node, self-supplies the chokepoint. */
  selfSupplyNode: snakeId,
  /** Nodes that raise capability by buying from this chokepoint's suppliers: they never satisfy it. */
  importedBy: z.array(snakeId).default([]),
});

export const SupplyChainSchema = z.strictObject({
  ladder: z.array(LadderRungSchema).min(2),
  /** In order; the last is chips themselves (lithography), which integrity keeps the last to close. */
  chokepoints: z.array(ChokepointSchema).min(2),
  /** Requires exactly every chokepoint's self-supply node, and nothing else: no numeric threshold to tune. */
  seedNode: snakeId,
});

export type LadderRung = z.infer<typeof LadderRungSchema>;
export type Chokepoint = z.infer<typeof ChokepointSchema>;
export type SupplyChain = z.infer<typeof SupplyChainSchema>;
