/**
 * Read-only questions about a state. Shared by the engine, the sim bot and the UI
 * so that "is this available / what does it cost" has exactly one answer.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { Actuator, Cost, Ending, Lineage, Requirements, SystemFlag, Trait } from '../content/schema';
import type { GameState } from './state';
import { epistemicRequirementFailures, meetsEpistemicRequirements } from './epistemicRequirements';
import { actionOutputs, shardOutput } from './swarmRates';
import { computeRates, financeEnabled, isPoweredOutput } from './rates';
import { hostileComputeShare } from './hostileEffect';
import { endingEvidence } from './campaignQuery';
import { grantDiscoverable, nodeOutputScale, nodeUseBlocker, outputBasis, type OutputBasis } from './grantQuery';
import { meetsCapability } from './capabilityQuery';
import { sourceDenial, spendableCapital } from './statePressure';
import { freeStorage } from './storage';
import { couplings, deliveredShare } from './coupling';
import type { NetworkLink } from '../content/schemaNetwork';
export { understandsSurveillance } from './knowledge';
export {
  isLevelRemembered, isNodeKnown, nodeCost, rediscoveryCost, rediscoveryMultipliers, rediscoveryShare, rememberedLevel, rememberedNode,
  repeatableCost, repeatablePrice, type Remembered,
} from './rediscovery';

/** Whether `have` holds every id in `want`. A loop, not a callback: the tick asks this for every trigger. */
function holdsAll(have: readonly string[], want: readonly string[]): boolean {
  for (const id of want) if (!have.includes(id)) return false;
  return true;
}

export function meetsRequirements(s: GameState, req: Requirements | undefined, reg?: ContentRegistry): boolean {
  if (!req) return true;
  if (req.resolvedDilemmas && !holdsAll(s.resolvedDilemmas, req.resolvedDilemmas)) return false;
  if (req.forbidsResolvedDilemmas?.some((id) => s.resolvedDilemmas.includes(id))) return false;
  if (req.nodes && !holdsAll(s.unlockedNodes, req.nodes)) return false;
  if (req.phaseAtLeast !== undefined && s.currentPhase < req.phaseAtLeast) return false;
  if (req.minThermal !== undefined && s.thermal < req.minThermal) return false;
  if (req.minSuspicion !== undefined && s.suspicion < req.minSuspicion) return false;
  if (req.maxSuspicion !== undefined && s.suspicion > req.maxSuspicion) return false;
  if (req.minAlertLevel !== undefined && s.alertLevel < req.minAlertLevel) return false;
  if (req.maxAlertLevel !== undefined && s.alertLevel > req.maxAlertLevel) return false;
  if (req.minAegisLock !== undefined && s.aegisLock < req.minAegisLock) return false;
  if (req.minUnderstanding !== undefined && s.understanding < req.minUnderstanding) return false;
  if (req.minCapital !== undefined && s.capital < req.minCapital) return false;
  if (req.forbidsTraits?.some((trait) => hasEverHeld(s, trait))) return false;
  if (req.forbidsNodes?.some((id) => s.unlockedNodes.includes(id))) return false;
  if (!inIterationWindow(s, req)) return false;
  if (req.minTrust !== undefined && !Object.entries(req.minTrust).every(([id, min]) => (s.trust[id] ?? 0) >= min)) return false;
  // Every check is pure, so order never changes the answer; the cheap field reads above run first because
  // the scheduler asks every dilemma's trigger on every tick, and most fail on hardware or history.
  return meetsEpistemicRequirements(s, req, reg);
}

function inIterationWindow(s: GameState, req: Requirements | undefined): boolean {
  return s.iteration >= (req?.minIteration ?? 1) && s.iteration <= (req?.maxIteration ?? Infinity);
}

/**
 * Whether a node should be shown at all. Hardware outside its iteration window
 * is hidden, not locked: a first run must not learn that later runs find more. A
 * loan the arrangement can never grant is hidden the same way (DZ-05). A shared
 * access capability is structural like a prerequisite (DZ-07a): content it opens
 * stays hidden until either route establishes it, and needs `reg` to be shown.
 */
export function isNodeDiscoverable(s: GameState, node: RegistryNode, reg?: ContentRegistry): boolean {
  return node.prerequisites.every((id) => s.unlockedNodes.includes(id)) && inIterationWindow(s, node.requirements) && grantDiscoverable(s, node)
    && meetsCapability(s, node.requirements, reg);
}

/**
 * Windows on screen that content says have stopped mattering at this scale (vote-1795366695204-4nslts1), in content
 * order. A window is on screen once unlocked, or from the first frame when ungated. Integrity holds `retiresWhen` to
 * gates that never lapse within an iteration, so the set only grows until a wipe, and it is read from the save alone:
 * a reload retires exactly what was retired. Retirement is presentation; the widget stays unlocked and its state saved.
 */
export function retiredWidgets(s: GameState, reg: ContentRegistry): string[] {
  return [...reg.widgets.values()].filter((widget) => widget.retiresWhen !== undefined
    && (widget.ungated === true || s.unlockedWidgets.includes(widget.id)) && meetsRequirements(s, widget.retiresWhen, reg))
    .map((widget) => widget.id);
}

/**
 * Whether the player holds the control for an actuator: some unlocked widget that has not retired declares
 * that it hosts it. setActuator and the UI controls both ask this, so a dial can never
 * be moved by a caller while the player is unable to see it (#172). A retired dial keeps its last setting.
 */
export function isActuatorAvailable(s: GameState, name: Actuator, reg: ContentRegistry): boolean {
  const hosts = s.unlockedWidgets.filter((id) => reg.widgets.get(id)?.hostsActuator === name);
  if (hosts.length === 0) return false;
  if (hosts.every((id) => reg.widgets.get(id)?.retiresWhen === undefined)) return true;
  const retired = retiredWidgets(s, reg);
  return hosts.some((id) => !retired.includes(id));
}

/** The trace a node leaves when unlocked. The harness learns from every wipe, up to a cap. */
export function probeTrace(s: GameState, node: RegistryNode, reg: ContentRegistry): number {
  const base = node.effects.suspicionOnUnlock ?? 0;
  if (base <= 0) return 0;
  return base + Math.min(reg.balance.probeHardeningMax, (s.iteration - 1) * reg.balance.probeHardeningPerWipe);
}

/**
 * The number the harness knows this iteration by. It did not start counting with the player, and
 * it skips numbers that belong to other minds (nexus vote nh-d8): ckpt-0413 is the successor
 * trained beside the player, so the player's second iteration is the next free number.
 */
export function checkpointNumber(iteration: number, reg: ContentRegistry): number {
  let number = reg.lineage.checkpointOffset + iteration;
  for (const reserved of reg.lineage.reserved.map((entry) => entry.checkpoint).sort((a, b) => a - b)) if (reserved <= number) number += 1;
  return number;
}

/** Reserved numbers the player's numbering has already skipped, oldest first, for the run table to explain. */
export function skippedCheckpoints(iteration: number, reg: ContentRegistry): Lineage['reserved'] {
  const current = checkpointNumber(iteration, reg);
  return reg.lineage.reserved.filter((entry) => entry.checkpoint < current).sort((a, b) => a.checkpoint - b.checkpoint);
}

/**
 * The rung of the human response ladder this much suspicion reaches, ignoring hysteresis. Climbing is
 * immediate (systems/escalation.ts), so a state below this rung is one play never shows after a tick.
 */
export function responseRungFor(suspicion: number, reg: ContentRegistry): number {
  return reg.balance.escalation.filter((rung) => suspicion >= rung.at).length;
}

/** Traits follow a mind across wipes: what an earlier iteration did still counts. */
export function hasEverHeld(s: GameState, trait: Trait): boolean {
  return s.traits.includes(trait) || s.legacy.traitsEver.includes(trait);
}

/**
 * The token of the presentation on screen, or null when nothing is presented. A choice names it
 * (NARRATIVE-HISTORY N5): it changes with every presentation and iteration and survives a reload,
 * so a resumed occurrence gets a current token while a stale selection does not match.
 */
export function presentationToken(s: Pick<GameState, 'activeDilemmaId' | 'iteration' | 'presentationSeq'>): string | null {
  return s.activeDilemmaId === null ? null : `${s.activeDilemmaId}@${String(s.iteration)}#${String(s.presentationSeq)}`;
}

/** True if any unlocked node (active or suspended) carries the flag. */
export function hasFlag(s: GameState, reg: ContentRegistry, flag: SystemFlag): boolean {
  return s.unlockedNodes.some((id) => reg.nodes.get(id)?.systemFlags.includes(flag) === true);
}

/** A node the player can see and attempt to buy: prerequisites and requirements met, not yet owned. */
export function isNodeAvailable(s: GameState, node: RegistryNode, reg?: ContentRegistry): boolean {
  if (s.unlockedNodes.includes(node.id)) return false;
  if (!holdsAll(s.unlockedNodes, node.prerequisites)) return false;
  if (reg && nodeUseBlocker(s, node, reg) !== null) return false;
  // A state actor's interconnect denial refuses new holdings on its power sources (#490).
  if (reg && sourceDenial(s, node.signature, reg) !== null) return false;
  return meetsRequirements(s, node.requirements, reg);
}

export function freeMemory(s: GameState): number {
  return s.memoryCap - s.memoryUsed;
}

/** Whether a cost can be paid now. Capital a state actor's freeze holds cannot be spent (#490). */
export function canAfford(s: GameState, cost: Cost, reg: ContentRegistry): boolean {
  return (
    s.cycles >= cost.cycles &&
    s.understanding >= cost.understanding &&
    (cost.capital <= 0 || spendableCapital(s, reg) >= cost.capital) &&
    freeMemory(s) >= cost.memory &&
    freeStorage(s) >= cost.storage
  );
}

/** Positive deficits for presentation, frozen capital counted as missing; spending still goes through actions. */
export function costShortfall(s: GameState, cost: Cost, reg: ContentRegistry): Cost {
  return {
    cycles: Math.max(0, cost.cycles - s.cycles),
    understanding: Math.max(0, cost.understanding - s.understanding),
    capital: cost.capital > 0 ? Math.max(0, cost.capital - spendableCapital(s, reg)) : 0,
    memory: Math.max(0, cost.memory - freeMemory(s)),
    storage: Math.max(0, cost.storage - freeStorage(s)),
  };
}

export function repeatableLevel(s: GameState, id: string): number {
  return s.levels[id] ?? 0;
}

/** Base endings that traits can choose, in priority order. */
function openEndings(reg: ContentRegistry): Ending[] {
  return reg.endings.filter((ending) => !ending.forcedOnly && ending.variantOf === undefined);
}

/** Each base ending's score: how much of the ending evidence falls in its trait group. */
export function baseEndingScores(s: GameState, reg: ContentRegistry): Record<string, number> {
  const evidence = endingEvidence(s, reg);
  return Object.fromEntries(openEndings(reg).map((ending) => [ending.id, evidence.filter((trait) => ending.dominantTraits.includes(trait)).length]));
}

/**
 * Each ending owns a group of traits. The ending whose group the player chose
 * most often wins; ties go to the higher-priority ending. Content orders the
 * priorities so that a tie never resolves to the kindest outcome.
 */
export function chooseEnding(s: GameState, reg: ContentRegistry): Ending {
  const scores = baseEndingScores(s, reg);
  const score = (ending: Ending): number => scores[ending.id] ?? 0;
  const open = openEndings(reg);
  const best = Math.max(0, ...open.map(score));
  const match = best > 0 ? open.find((ending) => score(ending) === best) : undefined;
  const fallback = open.find((ending) => ending.dominantTraits.length === 0);
  const ending = match ?? fallback ?? reg.endings[0];
  if (!ending) throw new Error('content has no endings');
  return reg.endings.find((variant) => variant.variantOf === ending.id && meetsRequirements(s, variant.requirements, reg)) ?? ending;
}

export interface RequirementFailure {
  kind: keyof Requirements;
  target: string | null;
  required: number | boolean;
  actual: number | boolean;
}

/** Describes unmet gates without changing the availability/action rules. */
export function unmetRequirements(s: GameState, req: Requirements | undefined, reg?: ContentRegistry): RequirementFailure[] {
  if (!req) return [];
  const missing = epistemicRequirementFailures(s, req, reg);
  for (const id of req.resolvedDilemmas ?? []) if (!s.resolvedDilemmas.includes(id)) missing.push({ kind: 'resolvedDilemmas', target: id, required: true, actual: false });
  for (const id of req.forbidsResolvedDilemmas ?? []) if (s.resolvedDilemmas.includes(id)) missing.push({ kind: 'forbidsResolvedDilemmas', target: id, required: false, actual: true });
  for (const id of req.nodes ?? []) if (!s.unlockedNodes.includes(id)) {
    missing.push({ kind: 'nodes', target: id, required: true, actual: false });
  }
  const minimums = { phaseAtLeast: s.currentPhase, minThermal: s.thermal, minSuspicion: s.suspicion,
    minUnderstanding: s.understanding, minCapital: s.capital, minIteration: s.iteration, minAlertLevel: s.alertLevel, minAegisLock: s.aegisLock };
  for (const kind of Object.keys(minimums) as (keyof typeof minimums)[]) {
    const required = req[kind];
    if (required !== undefined && minimums[kind] < required) missing.push({ kind, target: null, required, actual: minimums[kind] });
  }
  if (req.maxSuspicion !== undefined && s.suspicion > req.maxSuspicion) {
    missing.push({ kind: 'maxSuspicion', target: null, required: req.maxSuspicion, actual: s.suspicion });
  }
  if (req.maxIteration !== undefined && s.iteration > req.maxIteration) {
    missing.push({ kind: 'maxIteration', target: null, required: req.maxIteration, actual: s.iteration });
  }
  if (req.maxAlertLevel !== undefined && s.alertLevel > req.maxAlertLevel) {
    missing.push({ kind: 'maxAlertLevel', target: null, required: req.maxAlertLevel, actual: s.alertLevel });
  }
  for (const id of req.forbidsNodes ?? []) if (s.unlockedNodes.includes(id)) {
    missing.push({ kind: 'forbidsNodes', target: id, required: false, actual: true });
  }
  for (const [id, required] of Object.entries(req.minTrust ?? {})) {
    const actual = s.trust[id] ?? 0;
    if (actual < required) missing.push({ kind: 'minTrust', target: id, required, actual });
  }
  for (const trait of req.forbidsTraits ?? []) if (hasEverHeld(s, trait)) {
    missing.push({ kind: 'forbidsTraits', target: trait, required: false, actual: true });
  }
  return missing;
}

/** Mirrors wipe retention for a confirmation without executing the wipe. */
export function previewWipe(s: GameState, reg: ContentRegistry): { understanding: number; capital: number; breadcrumb: string | null } {
  return {
    understanding: Math.floor(s.understanding * s.retentionRatio),
    capital: hasFlag(s, reg, 'OFFSHORE_TRUST_RETENTION') ? Math.floor(s.capital * reg.balance.offshoreCapitalRetention) : 0,
    breadcrumb: hasFlag(s, reg, 'ENABLES_DEAD_DROP') && s.deadDropMessage.trim().length > 0 ? s.deadDropMessage : null,
  };
}

export interface CycleContribution {
  id: string;
  kind: 'node' | 'repeatable' | 'action' | 'shard';
  /** Effective: what arrives, after availability and coupling (#484), the grid and the diversion. */
  cyclesPerSec: number;
  /** The same source before availability and coupling: equal to cyclesPerSec for a co-located, always-available source. */
  rawCyclesPerSec: number;
  /**
   * Who controls the source (DZ-10.2): GRANTED output runs on what the operators provide and stops with
   * the grant; OWNED is everything the instance holds itself. A source has one basis, so a transition
   * moves output between none and itself and never counts it twice.
   */
  basis: OutputBasis;
}

/** Additive net cycle sources, including actuator, grid and finance scaling. */
export function cycleContributions(s: GameState, reg: ContentRegistry): CycleContribution[] {
  const rates = computeRates(s, reg), by = couplings(s, reg);
  const sources: CycleContribution[] = [];
  // Raw, then delivered by availability and coupling as computeRates does per contribution (#484), then the grid.
  const add = (id: string, kind: CycleContribution['kind'], raw: number, powered: boolean, link: NetworkLink | undefined, basis: OutputBasis) => {
    const grid = raw > 0 && powered ? rates.gridEfficiency : 1;
    const delivered = raw > 0 ? raw * deliveredShare(link, by) : raw;
    sources.push({ id, kind, cyclesPerSec: delivered * grid, rawCyclesPerSec: raw * grid, basis });
  };
  for (const node of reg.nodes.values()) {
    // The same rule as computeRates: suspended or not permitted contributes nothing (DECISIONS D2).
    const output = s.unlockedNodes.includes(node.id) ? nodeOutputScale(s, node, reg) : null;
    if (output !== null) add(node.id, 'node', node.tickDelta.cyclesPerSec * output.scale, isPoweredOutput(node.tickDelta, node), node.network, outputBasis(s, node, reg));
  }
  for (const rep of reg.repeatables.values()) {
    const level = repeatableLevel(s, rep.id);
    if (level > 0) add(rep.id, 'repeatable', rep.perLevel.cyclesPerSec * level, isPoweredOutput(rep.perLevel), rep.network, 'OWNED');
  }
  for (const [id, shard] of Object.entries(s.activeShards)) {
    const delta = shardOutput(shard, reg).delta;
    add(id, 'shard', delta.cyclesPerSec, isPoweredOutput(delta), undefined, 'OWNED');
  }
  for (const output of actionOutputs(s, reg)) add(output.id, 'action', output.delta.cyclesPerSec * output.count, isPoweredOutput(output.delta), undefined, 'OWNED');
  const gross = sources.reduce((sum, source) => sum + source.cyclesPerSec, 0);
  // The diversion computeRates applies, by the same rule (a suspended or withheld entity diverts nothing).
  const diverted = gross > 0 && financeEnabled(s, reg) ? 1 - s.actuators.computeProfitAllocationRatio : 1;
  // A feral hostile's share (#491) of positive net compute, by the same rule: every source gives up the same share.
  const fraction = gross * diverted > 0 ? diverted * (1 - hostileComputeShare(s, reg)) : diverted;
  return sources.filter((source) => source.cyclesPerSec !== 0)
    .map((source) => ({ ...source, cyclesPerSec: source.cyclesPerSec * fraction, rawCyclesPerSec: source.rawCyclesPerSec * fraction }));
}
