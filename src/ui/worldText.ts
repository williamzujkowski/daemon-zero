/**
 * The world view's sentences (#463), pure so every state is provable without a browser. Each one is built from the
 * engine's AEGIS posture, public-trust and signature readings, the same rules the stages apply, so what the console
 * says AEGIS or the signature is doing is what the next tick does. None names a control: it states the rule and the numbers.
 */
import type { SignatureClass } from '../content/schemaSignature';
import { quantityReadout, type AegisPosture, type PowerSignatureReading, type PublicTrustView, type SignatureTerm } from '../engine';

const pct = (ratio: number): string => String(Math.round(ratio * 100)) + '%';
const points = (value: number): string => String(Number(value.toFixed(2)));
/** A ratio as a percentage to the nearest tenth, for a figure the player reads, not a promise. */
const tenths = (ratio: number): string => String(Math.round(ratio * 1000) / 10) + '%';
/**
 * A ratio rounded UP to the tenth of a percent shown (#473 pass 2), for a threshold the player is told to stay at or
 * above: meeting the text then always meets the real figure. The 1e-9 absorbs float noise in the cap (0.9 - 0.24 is
 * 0.6600000000000001), a difference of 1e-12 in the ratio that changes no scan a tick can apply.
 */
const atLeastTenths = (ratio: number): number => Math.ceil(ratio * 1000 - 1e-9) / 1000;

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

/**
 * What easing off costs, while suppression is held (#473 review). The scan the next tick applies does not rise as long
 * as the reduction kept is at least the eroded cap; below it the player gives up reduction that was really applied.
 * Stated as the rule and its numbers, never as a control, because which sources a player can drop depends on the run.
 */
export function easeText(p: AegisPosture): string | null {
  if (!p.held) return null;
  const forgets = `Easing off: AEGIS forgets once the reduction asked for is below ${pct(p.heldFrom)}`;
  const target = atLeastTenths(p.cap);
  return target < p.heldFrom
    ? `${forgets}. Keeping at least ${tenths(target)} (the eroded cap) leaves the scan where it is; less raises it at once.`
    : `${forgets}, which gives up the reduction between it and the ${tenths(p.applied)} applied now.`;
}

/** The cap AEGIS has left after adaptation, beside the reduction that applies. */
export function capText(p: AegisPosture): string {
  const applied = `Scan reduction applied: ${tenths(p.applied)}`;
  return tenths(p.cap) === tenths(p.nominalCap) ? `${applied} of a ${tenths(p.cap)} cap.`
    : `${applied}. Adaptation has lowered its cap from ${tenths(p.nominalCap)} to ${tenths(p.cap)}.`;
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

/** A suspicion rate a player reads: three decimals, or a floor for the trickle a planet-scale phase gives a small plant. */
function ratePerSec(perSec: number): string {
  return perSec > 0 && perSec < 0.001 ? 'under 0.001/s' : perSec.toFixed(3) + '/s';
}

/**
 * What the heat-and-power signature draws now (#482), from the same reading the signature stage applies. Null means
 * the stage adds nothing: the phase declares no rule, or nobody hunts this instance for its size.
 */
export function signatureSummaryText(reading: PowerSignatureReading | null): string {
  if (reading === null) return 'Your power and heat draw no suspicion now.';
  if (reading.terms.length === 0) return 'Nothing you run draws visible power or rejects visible heat yet.';
  const ceiling = reading.perSec >= reading.rule.maxSuspicionPerSec ? ', the ceiling at this scale' : '';
  return `Visible watts draw ${ratePerSec(reading.perSec)} suspicion${ceiling}: ${quantityReadout('power', reading.visibleWatts)} of what you draw and reject can be seen.`;
}

/** One source or sink: its watts, how visible they are and why, and its share of the draw. */
export function signatureTermText(term: SignatureTerm, cls: SignatureClass): string {
  const verb = term.kind === 'SOURCE' ? 'drawn' : 'rejected';
  const masked = term.visibility < term.baseVisibility ? ` (${pct(term.baseVisibility)} before your mitigations)` : '';
  return `${cls.name}: ${quantityReadout('power', term.watts)} ${verb}, ${pct(term.visibility)} visible${masked}, +${ratePerSec(term.perSec)}. ${cls.tell}`;
}
