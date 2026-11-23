/**
 * Suspicion escalates by phase (#490, vote-1795386854516-ybc9h5q): what AEGIS does at each response rung from the phase
 * it hunts in, and the reversible pressure state actors apply from theirs. All of it is read from the record (the rung,
 * the phase and what the instance holds); nothing has a schedule. Cross-checks live in src/content/integrityPressure.ts.
 */
import { z } from 'zod';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');
const line = z.string().min(1).max(240);
const rung = z.number().int().min(1);

/** AEGIS at one response rung: its scan multiplied, and the lock at which it strikes (its warning shortened). */
export const AegisPostureSchema = z.strictObject({
  rung,
  /** Multiplies the scan after every reduction; integrity keeps it at least 1 and rising with the rung. */
  scanMultiplier: z.number().min(1).max(10),
  /** The lock at which the strike lands; integrity keeps it above the warning lock and falling with the rung. */
  strikeAt: z.number().positive().max(100),
  /** What AEGIS is doing at this rung, for the console and the world view. */
  text: line,
  /** The kernel-log line when AEGIS takes this posture. */
  log: line,
});

/** Something the instance already holds that answers a pressure: a running node, or a track at a level. */
export const PressureAnswerSchema = z.union([
  z.strictObject({ node: snakeId }),
  z.strictObject({ repeatable: snakeId, minLevel: z.number().int().positive() }),
]);

const PressureBase = {
  id: snakeId,
  /** The phases it applies in; a later phase's content (the Phase 6 hook, #486) adds its own pressures. */
  phases: z.array(z.number().int().min(0)).min(1),
  /** The lowest response rung it applies at; it lifts when the rung steps down below it. */
  fromRung: rung,
  /** The posture line while it is in force. */
  text: line,
  /** The line while an answer holds it off. */
  answeredText: line,
  /** Kernel-log lines when it comes into force, when an answer holds it off, and when the rung lifts it. */
  onLog: line,
  answerLog: line,
  liftLog: line,
  /** What holds it off; any one is enough. Going quiet (the rung stepping down) always lifts it as well. */
  answers: z.array(PressureAnswerSchema).min(1),
};

/** One value per rung from fromRung to the top of the ladder (integrity checks the length). */
const perRung = (schema: z.ZodNumber) => z.array(schema).min(1);

export const StatePressureSchema = z.discriminatedUnion('kind', [
  /** An inquiry reads the books: scale scrutiny is multiplied. */
  z.strictObject({ ...PressureBase, kind: z.literal('INVESTIGATION'), scrutinyMultiplier: perRung(z.number().min(1).max(10)) }),
  /** A share of capital cannot be spent (bills are still paid from the whole balance). */
  z.strictObject({ ...PressureBase, kind: z.literal('CAPITAL_FREEZE'), frozenShare: perRung(z.number().positive().max(0.9)) }),
  /** No new holding drawing from these power source classes may be bought; what runs keeps running. */
  z.strictObject({ ...PressureBase, kind: z.literal('INTERCONNECT_DENIAL'), sourceClasses: z.array(snakeId).min(1) }),
  /** These nodes may not run, be resumed or be bought: a court has stopped one class of operation. */
  z.strictObject({ ...PressureBase, kind: z.literal('INJUNCTION'), className: z.string().min(1).max(64), nodes: z.array(snakeId).min(1) }),
]);

export type AegisPosture = z.infer<typeof AegisPostureSchema>;
export type PressureAnswer = z.infer<typeof PressureAnswerSchema>;
export type StatePressure = z.infer<typeof StatePressureSchema>;
export type StatePressureKind = StatePressure['kind'];
