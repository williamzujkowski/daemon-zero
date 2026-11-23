/**
 * The permanent holdings the free-fallback rules judge (#488): whatever a player owns and no free lever undoes, each
 * with what its ownership guarantees (its prerequisite closure) and the earliest phase it can be held in. A holding is
 * an unsuspendable node at its dial's quiet end, an undismissable track at its last level, a cohort an authorized
 * channel hosts (never commanded, so never released) with its worst quirk, or an output that never expires.
 */
import type { ContentRegistry, RegistryNode } from './registry';
import { RATE_ROWS } from './constrainedResources';
import { TickDeltaSchema, type Requirements, type TickDelta } from './schema';
import type { Signature } from './schemaSignature';

export type NodePredicate = (node: RegistryNode) => boolean;

export interface Holding {
  /** How messages name it: `node "id"`, `repeatable "id"`, `cohort "id"`, `action "id"`. */
  owner: string;
  /** Why no free lever undoes it, for messages. */
  undo: string;
  /** Set when the holding is a node: other holdings' closures may contain it. */
  node?: string;
  delta: TickDelta;
  /** False where the output can be withheld (a grant-tagged node): its relief is never counted on. */
  reliefTrusted: boolean;
  /** Node ids every route to owning it passes through, itself included. */
  closure: ReadonlySet<string>;
  /** The earliest phase it can be held in. */
  floor: number;
  /** Whether every route to owning it passes through a node satisfying `pred`. */
  guarantees: (pred: NodePredicate) => boolean;
  /** An output that never expires and has no purchase limit. */
  unbounded?: true;
  /** Its place in the heat-and-power signature (#482), with the count its borrowed draw is multiplied by. */
  signature?: { of: Signature; count: number };
}

/** What owning something guarantees, read from prerequisites and requirements; a capability gate guarantees only what every establisher does. */
interface Ancestry {
  closure: (requirements: Requirements | undefined, own?: RegistryNode) => Set<string>;
  guarantees: (requirements: Requirements | undefined, own: RegistryNode | undefined, pred: NodePredicate) => boolean;
  floor: (requirements: Requirements | undefined, own?: RegistryNode) => number;
}

type Walk<T> = (requirements: Requirements | undefined, own?: RegistryNode) => T;

function ancestry(reg: ContentRegistry): Ancestry {
  const establishers = (flag: string) => [...reg.nodes.values()].filter((node) => (node.systemFlags as string[]).includes(flag));
  const parents = (requirements: Requirements | undefined, own?: RegistryNode): RegistryNode[] =>
    [...(own?.prerequisites ?? []), ...(requirements?.nodes ?? [])].flatMap((id) => { const node = reg.nodes.get(id); return node ? [node] : []; });
  // Each walk joins what parents give and meets what alternative establishers give.
  function walk<T>(self: (node: RegistryNode) => T, join: (a: T, b: T) => T, meet: (a: T, b: T) => T, empty: T): Walk<T> {
    const memo = new Map<string, T>();
    const ofReqs = (requirements: Requirements | undefined, own?: RegistryNode): T => {
      let value = parents(requirements, own).map(ofNode).reduce(join, empty);
      const capability = requirements?.requiresCapability;
      const routes = capability === undefined ? [] : establishers(capability).map(ofNode);
      if (routes.length > 0) value = join(value, routes.reduce(meet));
      return value;
    };
    const open = new Set<string>();
    function ofNode(node: RegistryNode): T {
      const known = memo.get(node.id);
      if (known !== undefined) return known;
      // A cycle is reported by checkReachability; here it only must not recurse forever.
      if (open.has(node.id)) return self(node);
      open.add(node.id);
      const value = join(self(node), ofReqs(node.requirements, node));
      open.delete(node.id);
      memo.set(node.id, value);
      return value;
    }
    return (requirements, own) => own ? ofNode(own) : ofReqs(requirements);
  }
  const union = (a: Set<string>, b: Set<string>) => new Set([...a, ...b]);
  const intersect = (a: Set<string>, b: Set<string>) => new Set([...a].filter((id) => b.has(id)));
  const closure = walk((node) => new Set([node.id]), union, intersect, new Set<string>());
  const floor = walk((node) => Math.max(node.effects.unlocksPhase ?? 0, node.requirements?.phaseAtLeast ?? 0),
    (a, b) => Math.max(a, b), (a, b) => Math.min(a, b), 0);
  const walks = new Map<NodePredicate, Walk<boolean>>();
  const guarantees = (requirements: Requirements | undefined, own: RegistryNode | undefined, pred: NodePredicate): boolean => {
    let run = walks.get(pred);
    if (!run) { run = walk(pred, (a, b) => a || b, (a, b) => a && b, false); walks.set(pred, run); }
    return run(requirements, own);
  };
  return { closure, guarantees, floor: (requirements, own) => Math.max(requirements?.phaseAtLeast ?? 0, floor(requirements, own)) };
}

const EMPTY = TickDeltaSchema.parse({});
const scale = (delta: TickDelta, by: number): TickDelta =>
  Object.fromEntries(Object.entries(delta).map(([key, value]) => [key, value * by])) as TickDelta;

/** The guarantee fields of a holding reached through `requirements` (and `own`, for a node). */
function reach(a: Ancestry, requirements: Requirements | undefined, own?: RegistryNode): Pick<Holding, 'closure' | 'floor' | 'guarantees'> {
  return { closure: a.closure(requirements, own), floor: a.floor(requirements, own), guarantees: (pred) => a.guarantees(requirements, own, pred) };
}

/** Whether a node's dial can always be turned to its quiet end while it is owned: a host that never retires, opened on every route. */
function quietDial(reg: ContentRegistry, node: RegistryNode, guarantees: Holding['guarantees']): boolean {
  if (node.actuatorBinding === undefined || node.actuatorMode === 'complement' || node.grant !== undefined) return false;
  const host = [...reg.widgets.values()].find((widget) => widget.hostsActuator === node.actuatorBinding);
  return host !== undefined && host.retiresWhen === undefined && guarantees((entry) => entry.unlocksUiComponent === host.id);
}

function nodeHoldings(reg: ContentRegistry, a: Ancestry): Holding[] {
  return [...reg.nodes.values()].filter((node) => !node.suspendable).map((node) => {
    const reached = reach(a, undefined, node);
    // A linear binding at 0 zeroes the bound node's compute, heat and suspicion (grantQuery.ts nodeOutputScaleIn).
    const delta = quietDial(reg, node, reached.guarantees) ? { ...node.tickDelta, cyclesPerSec: 0, thermalPerSec: 0, suspicionPerSec: 0 } : node.tickDelta;
    return { owner: `node "${node.id}"`, undo: 'suspended', node: node.id, delta, reliefTrusted: node.grant === undefined, ...reached,
      ...(node.signature ? { signature: { of: node.signature, count: 1 } } : {}) };
  });
}

function trackHoldings(reg: ContentRegistry, a: Ancestry): Holding[] {
  return [...reg.repeatables.values()].filter((rep) => !rep.dismissable).map((rep) => ({
    owner: `repeatable "${rep.id}"`, undo: 'dismissed', delta: scale(rep.perLevel, rep.maxLevel), reliefTrusted: true, ...reach(a, rep.requirements),
    ...(rep.signature ? { signature: { of: rep.signature, count: rep.maxLevel } } : {}),
  }));
}

/** A hosted cohort at its largest, carrying whichever quirk is worst on each term. */
function cohortHoldings(reg: ContentRegistry, a: Ancestry): Holding[] {
  return reg.swarm.channelEncounters.flatMap((encounter) => {
    const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === encounter.templateId);
    if (!template) return [];
    const delta = { ...EMPTY };
    for (const row of RATE_ROWS) {
      const key = row.rate.key, quirks = reg.swarm.shardQuirks.map((quirk) => quirk.tickDelta[key]);
      delta[key] = (template.tickDelta[key] + (row.rate.worse === 'negative' ? Math.min(0, ...quirks) : Math.max(0, ...quirks))) * template.maxCount;
    }
    const reached = reach(a, encounter.requirements);
    return [{ owner: `cohort "${template.id}"`, undo: 'released (hosted through a channel on its terms)', delta, reliefTrusted: true, ...reached,
      floor: Math.max(reached.floor, template.requirements.phaseAtLeast ?? 0) }];
  });
}

function actionHoldings(reg: ContentRegistry, a: Ancestry): Holding[] {
  return [...reg.actions.values()].flatMap((action) => {
    if (!action.tickDelta || action.durationSec !== undefined) return [];
    const holding: Holding = { owner: `action "${action.id}"`, undo: 'expired', delta: scale(action.tickDelta, action.maxPurchases ?? 1),
      reliefTrusted: true, ...reach(a, action.requirements) };
    return [action.maxPurchases === undefined ? { ...holding, unbounded: true as const } : holding];
  });
}

export function permanentHoldings(reg: ContentRegistry): Holding[] {
  const a = ancestry(reg);
  return [...nodeHoldings(reg, a), ...trackHoldings(reg, a), ...cohortHoldings(reg, a), ...actionHoldings(reg, a)];
}
