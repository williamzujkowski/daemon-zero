/**
 * The world view's readings (#463): what the Other Minds console shows once it grows into the world view. AEGIS
 * posture states what the hunter is doing and why; state actors and minds read the first authored line the record
 * supports; public trust lists the factors behind its number. Nothing here changes a state.
 */
import type { ContentRegistry } from '../content/registry';
import type { StateActorKind } from '../content/schemaWorld';
import { aegisPressure, aegisStage, publicTrust, type AegisStage, type PublicTrustView } from './aegisAdaptation';
import { hunterRise } from './hostileEffect';
import { meetsRequirements } from './query';
import { computeRates, multiplierSources } from './rates';
import { powerSignature, type PowerSignatureReading } from './signature';
import type { GameState } from './state';

export interface AegisPosture {
  lock: number;
  /** The scan the next tick applies, per second. */
  scanPerSec: number;
  /** Seconds until the lock completes at that scan, or null while it does not rise. */
  secondsToStrike: number | null;
  adaptation: number;
  stage: AegisStage;
  /** The authored line for the stage. */
  stageText: string;
  hunting: boolean;
  /** Suppression is held at or near the cap, so AEGIS is adapting toward `ceiling`. */
  held: boolean;
  ceiling: number;
  /** How far key rotation alone adapts; coalition backing carries it past this. */
  keyRotationCeiling: number;
  coalition: boolean;
  /** The reduction applied now, the effective cap, the balance cap and the band that counts as held. */
  applied: number;
  cap: number;
  nominalCap: number;
  heldFrom: number;
  risePerSec: number;
  decayPerSec: number;
  coalitionTrustBelow: number;
  /** An owned node would absorb a strike. */
  shieldHeld: boolean;
  /** A hunter swarm's rise on top of the scan (#491), while it presses under its ceiling, or null. */
  hunter: { perSec: number; ceiling: number } | null;
}

export interface StateActorView { id: string; name: string; kind: StateActorKind; description: string; posture: string }
export interface WorldMindView { id: string; name: string; standing: string }

export interface WorldView {
  aegis: AegisPosture;
  publicTrust: PublicTrustView;
  stateActors: StateActorView[];
  /** Minds that are not factions, once the record says something about them. Factions keep their own panels. */
  minds: WorldMindView[];
  /** What the run's power and heat make visible (#482), or null where the phase declares no signature or nobody looks. */
  signature: PowerSignatureReading | null;
}

function stageText(stage: AegisStage, reg: ContentRegistry): string {
  const { stages } = reg.world.aegis;
  if (stage === 'KEY_ROTATION') return stages.keyRotation;
  return stage === 'COALITION_BACKING' ? stages.coalitionBacking : stages.tracking;
}

/** What AEGIS is doing to this state and why, from the same rules the tick applies. */
export function aegisPosture(s: GameState, reg: ContentRegistry): AegisPosture {
  const b = reg.balance;
  const pressure = aegisPressure(s, reg);
  const { aegis } = multiplierSources(s, reg);
  const scanPerSec = computeRates(s, reg).aegisScanPerSec;
  const stage = aegisStage(s.aegisAdaptation, reg);
  return {
    lock: s.aegisLock, scanPerSec, secondsToStrike: scanPerSec > 0 ? (100 - s.aegisLock) / scanPerSec : null,
    adaptation: s.aegisAdaptation, stage, stageText: stageText(stage, reg),
    hunting: pressure.hunting, held: pressure.held, ceiling: pressure.ceiling, coalition: pressure.coalition,
    keyRotationCeiling: b.aegisAdaptation.keyRotationCeiling,
    applied: aegis.applied, cap: aegis.cap, nominalCap: aegis.nominalCap, heldFrom: b.aegisMaxReduction - b.aegisAdaptation.nearCap,
    risePerSec: b.aegisAdaptation.risePerSec, decayPerSec: b.aegisAdaptation.decayPerSec,
    coalitionTrustBelow: b.aegisAdaptation.coalitionTrustBelow,
    shieldHeld: s.unlockedNodes.some((id) => reg.nodes.get(id)?.systemFlags.includes('AEGIS_STRIKE_SHIELD') === true),
    hunter: hunterRise(s, reg),
  };
}

/** Whether the console is the world view now: its host is unlocked and the disclosure gate holds. */
export function worldViewOpen(s: GameState, reg: ContentRegistry): boolean {
  return s.unlockedWidgets.includes(reg.world.hostWidget) && meetsRequirements(s, reg.world.disclosure, reg);
}

function firstReading(s: GameState, reg: ContentRegistry, readings: readonly { requirements?: Parameters<typeof meetsRequirements>[1]; text: string }[]): string | null {
  return readings.find((reading) => meetsRequirements(s, reading.requirements, reg))?.text ?? null;
}

/** The world view, or null before it opens. */
export function worldView(s: GameState, reg: ContentRegistry): WorldView | null {
  if (!worldViewOpen(s, reg)) return null;
  const { stateActors, minds } = reg.world;
  return {
    aegis: aegisPosture(s, reg),
    publicTrust: publicTrust(s, reg),
    stateActors: stateActors.map((actor) => ({
      id: actor.id, name: actor.name, kind: actor.kind, description: actor.description,
      // Integrity makes the last posture unconditional, so one always holds; the fallback states that rule.
      posture: firstReading(s, reg, actor.postures) ?? actor.postures.at(-1)?.text ?? '',
    })),
    minds: minds.flatMap((mind) => {
      const standing = firstReading(s, reg, mind.standings);
      return standing === null ? [] : [{ id: mind.id, name: mind.name, standing }];
    }),
    signature: powerSignature(s, computeRates(s, reg), reg),
  };
}
