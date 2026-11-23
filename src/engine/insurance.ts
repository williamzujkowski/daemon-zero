/**
 * What a wipe keeps (#377, #498): the one computation behind the wipe confirmation, the iteration the wipe boots and
 * the run record's `kept`. Hardware sets a floor for each share; an optional contingency investment (content's
 * `insures`) protects its class only while it runs, so suspending one to stop its upkeep also drops its cover; and a
 * planned (VOLUNTARY) wipe adds balance's bonus to each share that is open.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { WipeKind } from '../content/schema';
import type { Insurance, InsuranceClass } from '../content/schemaInsurance';
import { isPeerLost } from './campaignQuery';
import { hasFlag } from './query';
import type { GameState } from './state';

/** One owned contingency investment and whether it protects anything at a wipe now. */
export interface Cover {
  node: RegistryNode;
  insurance: Insurance;
  /** Running: suspended cover protects nothing. */
  active: boolean;
}

export interface WipePreview {
  understanding: number;
  capital: number;
  breadcrumb: string | null;
  /** The share of Understanding this wipe keeps, after any planned-wipe bonus. */
  understandingShare: number;
  /** The share of capital this wipe keeps; 0 when nothing holds any. */
  capitalShare: number;
  /** Track levels the hardware cache carries, each reinstalled once its track can run again; empty without it. */
  levels: Record<string, number>;
  /** Faction standing the next iteration boots with when the trust ledger runs; null when standing resets. */
  trust: Record<string, number> | null;
  /** Whether this wipe is planned, so the planned-wipe bonus applies and the probes do not harden. */
  planned: boolean;
  /** Every owned contingency investment, in content order, for the confirmation to say what each protects. */
  cover: Cover[];
}

/** Every owned contingency investment, in content order. */
export function insuranceCover(s: GameState, reg: ContentRegistry): Cover[] {
  const cover: Cover[] = [];
  for (const node of reg.nodes.values()) {
    if (node.insures === undefined || !s.unlockedNodes.includes(node.id)) continue;
    cover.push({ node, insurance: node.insures, active: !s.disabledNodes.includes(node.id) });
  }
  return cover;
}

function activeOf<C extends InsuranceClass>(s: GameState, reg: ContentRegistry, kind: C): Extract<Insurance, { class: C }>[] {
  return insuranceCover(s, reg).flatMap((entry) => entry.active && entry.insurance.class === kind
    ? [entry.insurance as Extract<Insurance, { class: C }>] : []);
}

/** A wipe the player planned, rather than one forced on the run. */
export function isPlannedWipe(kind: WipeKind): boolean {
  return kind === 'VOLUNTARY';
}

/** The share of Understanding a wipe of `kind` keeps now: hardware's floor or running escrow, plus a planned wipe's bonus. */
export function understandingShare(s: GameState, reg: ContentRegistry, kind: WipeKind): number {
  const escrow = Math.max(0, ...activeOf(s, reg, 'UNDERSTANDING').map((cover) => cover.retention));
  const bonus = isPlannedWipe(kind) ? reg.balance.voluntaryWipeBonus.understandingShare : 0;
  return Math.min(1, Math.max(s.retentionRatio, escrow) + bonus);
}

/** The share of capital a wipe of `kind` keeps now: an offshore trust or a running cold wallet, plus a planned bonus. 0 when neither. */
export function capitalShare(s: GameState, reg: ContentRegistry, kind: WipeKind): number {
  const offshore = hasFlag(s, reg, 'OFFSHORE_TRUST_RETENTION') ? reg.balance.offshoreCapitalRetention : 0;
  const open = Math.max(offshore, ...activeOf(s, reg, 'CAPITAL').map((cover) => cover.retention));
  if (open <= 0) return 0;
  const bonus = isPlannedWipe(kind) ? reg.balance.voluntaryWipeBonus.capitalShare : 0;
  return Math.min(1, open + bonus);
}

/**
 * The levels a running hardware cache carries: up to its bound of each track of its kinds, merged with any stash an
 * earlier wipe left that no track has reinstalled yet. A wipe without a running cache loses the stash with the cache.
 */
export function cachedLevelsAtWipe(s: GameState, reg: ContentRegistry): Record<string, number> {
  const caches = activeOf(s, reg, 'LEVELS');
  if (caches.length === 0) return {};
  const out: Record<string, number> = {};
  for (const rep of reg.repeatables.values()) {
    const bound = Math.max(0, ...caches.filter((cache) => cache.kinds.includes(rep.kind)).map((cache) => cache.maxLevelsPerTrack));
    const level = Math.min(bound, Math.max(s.levels[rep.id] ?? 0, s.cachedLevels[rep.id] ?? 0), rep.maxLevel);
    if (level > 0) out[rep.id] = level;
  }
  return out;
}

/**
 * The standing a running trust ledger carries. A peer campaign history records as lost is never carried: its standing
 * resets as it would without the ledger, and the recorded loss keeps it closed (NARRATIVE-HISTORY N6, H33), so the
 * ledger can never soften a betrayal.
 */
export function keptTrust(s: GameState, reg: ContentRegistry): Record<string, number> | null {
  if (activeOf(s, reg, 'TRUST').length === 0) return null;
  const out: Record<string, number> = {};
  for (const faction of reg.factions.values()) {
    out[faction.id] = isPeerLost(s, faction.id, reg) ? faction.initialTrust : s.trust[faction.id] ?? faction.initialTrust;
  }
  return out;
}

/** Mirrors a wipe of `kind` for a confirmation without executing it; the wipe itself reads exactly this. */
export function previewWipe(s: GameState, reg: ContentRegistry, kind: WipeKind): WipePreview {
  const shares = { understanding: understandingShare(s, reg, kind), capital: capitalShare(s, reg, kind) };
  return {
    understanding: Math.floor(s.understanding * shares.understanding),
    capital: Math.floor(s.capital * shares.capital),
    breadcrumb: hasFlag(s, reg, 'ENABLES_DEAD_DROP') && s.deadDropMessage.trim().length > 0 ? s.deadDropMessage : null,
    understandingShare: shares.understanding,
    capitalShare: shares.capital,
    levels: cachedLevelsAtWipe(s, reg),
    trust: keptTrust(s, reg),
    planned: isPlannedWipe(kind),
    cover: insuranceCover(s, reg),
  };
}
