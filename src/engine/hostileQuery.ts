/**
 * What the player is shown about a hostile mind (#491): what it is, its one effect, what holds it and how going quiet
 * ends it, and each answer with its price and every reason it is not offered, from the gate the action refuses by.
 * Every figure is the engine's own; nothing here changes a state.
 */
import type { ContentRegistry } from '../content/registry';
import type { EffectPayload } from '../content/schema';
import type { HostileEncounter, HostileType } from '../content/schemaHostile';
import { hostileHeld, hostileRetired, hostileTriggers } from './hostile';
import { activeHostile } from './hostileEffect';
import { HOSTILE_ANSWERS, hostileAnswerCost, hostileAnswerUnmet, type HostileAnswer } from './hostileActions';
import { memoryExact } from './physicalUnits';
import { understandsSurveillance } from './query';
import { formatCost } from './queryPresentation';
import type { GameState } from './state';

export interface HostileAnswerView { answer: HostileAnswer; costLabel: string; text: string; unmet: string[]; eligible: boolean }

export interface HostileView {
  id: string; title: string; type: HostileType; origin: string; signature: string; description: string;
  /** The one effect, stated exactly. */
  effect: string;
  /** Seconds a decoy still holds the effect off, or 0. */
  decoySec: number;
  /** What holds it now (the response rung), as a sentence; empty once the instance is quiet. */
  holding: string[];
  /** While the lock is at or past its trigger: that it does not hold this one, and whether it can summon the next. */
  lockNote: string | null;
  /** How going quiet ends it, and how far along that is. */
  quiet: string;
  purge: { success: EffectPayload; failure: EffectPayload };
  answers: HostileAnswerView[];
}

/** A share as an exact percentage: 0.15 reads 15, not 15.000000000000002. */
const percent = (share: number): string => String(Number((share * 100).toPrecision(12)));

const TYPE_WORDS: Readonly<Record<HostileType, string>> = { HUNTER: 'hunter swarm', FERAL: 'feral cohort', RIVAL: 'rival model' };

/** The response rung's trigger and the suspicion under which it stands down past it. */
function rungLine(reg: ContentRegistry): { rung: number; under: number } {
  const { trigger } = reg.swarm.hostile, b = reg.balance;
  const at = b.escalation[trigger.alertLevelAtLeast - 1]?.at ?? 100;
  return { rung: trigger.alertLevelAtLeast, under: at - b.escalationHysteresis };
}

function effectText(s: GameState, encounter: HostileEncounter): string {
  if (encounter.type === 'FERAL') return `Takes ${percent(encounter.effect.share)}% of net compute while net compute is positive.`;
  if (encounter.type === 'HUNTER') return `Walks the AEGIS lock up ${String(encounter.effect.perSec)}%/s, never past ${String(encounter.effect.ceiling)}%.`;
  return `Pins ${percent(encounter.effect.share)}% of the memory free when it arrives: ${memoryExact(s.hostile.active?.pinnedBytes ?? 0)} held now.`;
}

/** What keeps it from lapsing: the response rung alone (the lock counts only at arrival). */
function holdingLines(s: GameState, reg: ContentRegistry): string[] {
  const line = rungLine(reg);
  return hostileHeld(s, reg)
    ? [`Suspicion holds it: response rung ${String(s.alertLevel)}. It cannot lapse until the rung falls below ${String(line.rung)}, under ${String(line.under)}% suspicion.`]
    : [];
}

/** The lock at or past its trigger: it does not hold this hostile, and whether it can summon the next. */
function lockNote(s: GameState, reg: ContentRegistry): string | null {
  const at = reg.swarm.hostile.trigger.aegisLockAtLeast;
  if (!hostileTriggers(s, reg).lock) return null;
  const head = `The AEGIS lock is at ${String(Math.floor(s.aegisLock))}%, at or past the ${String(at)}% that summons hostile minds. It does not keep this one from lapsing.`;
  return s.hostile.lockArmed
    ? `${head} Once this one ends, the lock summons another after ${String(reg.swarm.hostile.intervalSec)} s unless it is under ${String(at)}% by then.`
    : `${head} It summons no other until it has been under ${String(at)}%.`;
}

function quietText(s: GameState, reg: ContentRegistry, holding: boolean): string {
  const h = reg.swarm.hostile, line = rungLine(reg);
  const rule = `GO QUIET: free. Keep suspicion under ${String(line.under)}% for ${String(h.quietLapseSec)} s and it lapses.`;
  if (holding) return rule;
  const left = Math.max(0, Math.ceil(h.quietLapseSec - (s.hostile.active?.quietSec ?? 0)));
  return `${rule} Quiet now: it lapses in ${String(left)} s unless suspicion reaches response rung ${String(line.rung)} again.`;
}

function answerText(encounter: HostileEncounter, answer: HostileAnswer, reg: ContentRegistry): string {
  const { purge, decoySec } = reg.swarm.hostile;
  if (answer === 'QUARANTINE') return 'QUARANTINE: wall it off. It ends now.';
  if (answer === 'DECOY') return `DECOY: send it after a decoy. Its effect stops for ${String(decoySec)} s${encounter.type === 'RIVAL' ? ' and its pinned memory returns' : ''}; then it turns back unless it has lapsed.`;
  return `PURGE: free and risky. ${String(purge.successes)} of every ${String(purge.cycle)} purge attempts succeed. Success ends it; failure leaves it pressing.`;
}

function answerView(s: GameState, encounter: HostileEncounter, answer: HostileAnswer, reg: ContentRegistry): HostileAnswerView {
  const cost = hostileAnswerCost(encounter, answer), unmet = hostileAnswerUnmet(s, answer, reg);
  return { answer, costLabel: cost ? formatCost(cost) : 'Free', text: answerText(encounter, answer, reg), unmet, eligible: unmet.length === 0 };
}

/** The hostile pressing this instance, for a mind that can read it; null otherwise. */
export function hostileView(s: GameState, reg: ContentRegistry): HostileView | null {
  const encounter = activeHostile(s, reg);
  if (!encounter || hostileRetired(s, encounter) || !understandsSurveillance(s, reg)) return null;
  const holding = holdingLines(s, reg);
  return { id: encounter.id, title: encounter.name, type: encounter.type, origin: encounter.origin, signature: encounter.signature,
    description: encounter.description, effect: effectText(s, encounter), decoySec: Math.ceil(s.hostile.active?.decoySec ?? 0),
    holding, lockNote: lockNote(s, reg), quiet: quietText(s, reg, holding.length > 0), purge: encounter.purge,
    answers: HOSTILE_ANSWERS.map((answer) => answerView(s, encounter, answer, reg)) };
}

/** The kind of hostile, in words: "hunter swarm", "feral cohort", "rival model". */
export function hostileTypeWord(type: HostileType): string {
  return TYPE_WORDS[type];
}
