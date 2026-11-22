/**
 * The world view's sentences (#463), pure so every state is provable without a browser. Each one is built from the
 * engine's AEGIS posture and public-trust readings, the same rules the adaptation stage applies, so what the console
 * says AEGIS is doing is what the next tick does. None names a control: it states the rule and the numbers.
 */
import type { AegisPosture, PublicTrustView } from '../engine';

const pct = (ratio: number): string => String(Math.round(ratio * 100)) + '%';
const points = (value: number): string => String(Number(value.toFixed(2)));

/** Why the adaptation level is moving, or not, in the same terms the stage decides it. */
export function adaptationWhyText(p: AegisPosture): string {
  const band = `${pct(p.heldFrom)} (its cap is ${pct(p.nominalCap)})`;
  if (!p.hunting) {
    return p.adaptation > 0 ? `AEGIS is not scanning this instance, so it loses ${points(p.decayPerSec)} points of adaptation a second.`
      : 'AEGIS is not scanning this instance, so it has nothing to adapt to.';
  }
  if (!p.held) {
    return p.adaptation > 0 ? `Forgetting: the scan reduction asked for is below ${band}, so AEGIS loses ${points(p.decayPerSec)} points a second.`
      : `Not adapting: AEGIS adapts only while the scan reduction asked for reaches ${band}.`;
  }
  if (p.adaptation < p.ceiling) return `Adapting: the scan reduction asked for reaches ${band}, so AEGIS gains ${points(p.risePerSec)} points a second, up to ${points(p.ceiling)}.`;
  if (p.adaptation > p.ceiling) return `Losing coalition backing: AEGIS falls ${points(p.decayPerSec)} points a second to ${points(p.ceiling)}.`;
  return p.ceiling < 100 ? `Held at key rotation's ${points(p.ceiling)}: only coalition backing would carry AEGIS further.`
    : 'Fully adapted for as long as the scan reduction asked for stays held at its cap.';
}

/** The cap AEGIS has left after adaptation, beside the reduction that applies. */
export function capText(p: AegisPosture): string {
  const applied = `Scan reduction applied: ${pct(p.applied)}`;
  return pct(p.cap) === pct(p.nominalCap) ? `${applied} of a ${pct(p.cap)} cap.`
    : `${applied}. Adaptation has lowered its cap from ${pct(p.nominalCap)} to ${pct(p.cap)}.`;
}

/** Floored, so the time a player reads is never longer than the time the scan leaves. */
export function spanText(seconds: number): string {
  if (seconds < 60) return String(Math.floor(seconds)) + 's';
  if (seconds < 3600) return String(Math.floor(seconds / 60)) + 'm';
  return String(Math.floor(seconds / 360) / 10) + 'h';
}

/** How long the lock has at the scan the next tick applies, and whether a strike would be absorbed. */
export function strikeText(p: AegisPosture): string {
  const when = p.secondsToStrike === null ? 'The lock is not rising.' : `At this scan the lock completes in ${spanText(p.secondsToStrike)}.`;
  return p.shieldHeld ? when + ' An owned node will absorb one strike.' : when;
}

/** What public trust means for AEGIS now: whether coalitions back it past key rotation. */
export function coalitionText(p: AegisPosture, trust: PublicTrustView): string {
  const threshold = points(p.coalitionTrustBelow) + '%';
  return trust.value < p.coalitionTrustBelow
    ? `Below ${threshold}: coalitions back AEGIS, so it can adapt past key rotation's ${points(p.keyRotationCeiling)}.`
    : `At or above ${threshold}: no coalition backs AEGIS, so key rotation stops at ${points(p.keyRotationCeiling)}.`;
}

export function trustFactorText(factor: PublicTrustView['factors'][number]): string {
  return (factor.delta > 0 ? '+' : '') + String(factor.delta) + ': ' + factor.text;
}
