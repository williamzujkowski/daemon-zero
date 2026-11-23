/**
 * Hostile minds (#491, docs/SCALE.md "Aggressive swarms", vote-1795386858891-u3kqkis): AEGIS-spawned hunter swarms,
 * feral cohorts and rival rogue models that arrive from Phase 3 while suspicion or the AEGIS lock is high. Each has one
 * bounded, visible effect while unanswered, three paid or risky answers, and the free answer of going quiet.
 */
import { z } from 'zod';
import { CostSchema, EffectPayloadSchema, RequirementsSchema } from './schema';

const id = z.string().regex(/^[a-z0-9_]+$/);
const share = z.number().positive().max(0.5);

/** An answer that is paid for: its price and the line it writes. */
const PaidAnswerSchema = z.strictObject({ cost: CostSchema, log: z.string().min(10) });

/** What every hostile kind declares; the type fixes its one effect. */
const common = {
  id, kind: z.literal('HOSTILE'), tier: z.number().int().min(0),
  name: z.string().min(3), origin: z.string().min(3), signature: z.string().min(3),
  /** The arrival line, logged when it arrives and shown while it presses. */
  description: z.string().min(10),
  /** Where it may arrive: its tier's phase gate, the decoded mind and the arrangements that admit it. */
  requirements: RequirementsSchema,
  /** Spend to wall it off: it ends now. */
  quarantine: PaidAnswerSchema,
  /** Spend to send it after a decoy: its effect stops for the balance's decoySec, then it turns back. */
  decoy: PaidAnswerSchema,
  /** Free but risky: success ends it with `success`; failure applies `failure` and it stays. */
  purge: z.strictObject({ success: EffectPayloadSchema, failure: EffectPayloadSchema }),
  /** Logged when it lapses because the instance went quiet. */
  lapseLog: z.string().min(10),
  /** Logged when the player's phase moves past its tier while it presses: it lapses, never silently dropped. */
  retireLog: z.string().min(10),
};

/**
 * HUNTER: an AEGIS-spawned hunter swarm raises the lock by `perSec`, never past `ceiling`. Integrity keeps the ceiling
 * under the lock trigger, so a hunter can never hold the trigger that keeps it from lapsing, and never strikes alone.
 * FERAL: a feral cohort drains `share` of net compute while it is positive, so it can never turn compute negative.
 * RIVAL: a rival model pins `share` of the free memory on arrival, so it never pushes memory over its capacity.
 */
export const HostileEncounterSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...common, type: z.literal('HUNTER'),
    effect: z.strictObject({ perSec: z.number().positive(), ceiling: z.number().positive().max(100) }) }),
  z.strictObject({ ...common, type: z.literal('FERAL'), effect: z.strictObject({ share }) }),
  z.strictObject({ ...common, type: z.literal('RIVAL'), effect: z.strictObject({ share }) }),
]);

export const HostileTypeSchema = z.enum(['HUNTER', 'FERAL', 'RIVAL']);

/**
 * When hostile minds arrive and how they leave. The trigger is a response rung (an index into balance.escalation) or
 * an AEGIS lock; a hostile lapses once neither holds for quietLapseSec of live play. A purge succeeds `successes` times
 * in every `cycle` attempts: attempt n succeeds when (n * stride) mod cycle < successes, and integrity keeps stride
 * coprime to the cycle so that statement is exact.
 */
export const HostileBalanceSchema = z.strictObject({
  fromPhase: z.number().int().min(0),
  trigger: z.strictObject({ alertLevelAtLeast: z.number().int().min(1), aegisLockAtLeast: z.number().positive().max(100) }),
  intervalSec: z.number().positive(),
  quietLapseSec: z.number().positive(),
  decoySec: z.number().positive(),
  purge: z.strictObject({ successes: z.number().int().positive(), cycle: z.number().int().min(2), stride: z.number().int().positive() }),
  /** decoySpent: written when a decoy runs out and the hostile turns back; it names the hostile. */
  logs: z.strictObject({ decoySpent: z.string().includes('{name}') }),
});

export type HostileEncounter = z.infer<typeof HostileEncounterSchema>;
export type HostileType = z.infer<typeof HostileTypeSchema>;
export type HostileBalance = z.infer<typeof HostileBalanceSchema>;
