/**
 * The heat-and-power signature (#482, vote-1795381178260-1ddew5j): suspicion from power is the watts drawn times the
 * visibility of their source, and suspicion from heat is the heat rejected times the visibility of its sink. One query
 * states it; the tick's stage (systems/powerSignature.ts), the applied suspicion rate, the suspicion outlook and the
 * world view all read this, so the copy that names a source names the one the tick charges.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { PowerSignatureRule, Signature, SignatureClass } from '../content/schemaSignature';
import { nodeOutputScaleIn, useScope } from './grantQuery';
import type { GameState, Rates } from './state';
import { huntedForScale } from './threatQuery';

export type SignatureTermKind = 'SOURCE' | 'SINK';

/** One class's part of the signature now. */
export interface SignatureTerm {
  kind: SignatureTermKind;
  classId: string;
  /** Watts drawn from the source, or heat rejected through the sink. */
  watts: number;
  /** The class's authored visibility. */
  baseVisibility: number;
  /** Its visibility after every running mask: what the watts are multiplied by. */
  visibility: number;
  /** Suspicion per second it adds: its share of the phase's draw by visible watts. */
  perSec: number;
}

export interface PowerSignatureReading {
  /** Suspicion per second the stage adds now: linear in visible watts, up to the phase's ceiling. */
  perSec: number;
  /** Watts times visibility, summed over every term. */
  visibleWatts: number;
  /** The phase's rule. */
  rule: PowerSignatureRule;
  /** Whether rejected heat counts: from the phase server °C retires at (SCALE.md rule 7). */
  heatCounts: boolean;
  /** Every class with watts through it, largest draw on suspicion first. */
  terms: SignatureTerm[];
}

type SignatureRates = Pick<Rates, 'wattsGenerated' | 'wattsConsumed' | 'gridEfficiency'>;

/** A holding's signature compiled to class slots: -1 where it names no source or sink. */
interface Compiled { source: number; sink: number; borrowedW: number; masks: readonly (readonly [number, number])[]; wattsDelta: number }
interface Indexed {
  classes: readonly { kind: SignatureTermKind; cls: SignatureClass }[];
  nodes: ReadonlyMap<string, { node: RegistryNode; sig: Compiled }>;
  tracks: readonly { id: string; sig: Compiled }[];
}

/**
 * The content's classes and signature holdings, indexed once per registry (content never changes after it is built),
 * so the stage that asks on every tick sums into fixed slots instead of allocating per class.
 */
const INDEX = new WeakMap<ContentRegistry, Indexed>();

function indexed(reg: ContentRegistry): Indexed {
  let found = INDEX.get(reg);
  if (found === undefined) {
    const classes = [...reg.world.signature.sources.map((cls) => ({ kind: 'SOURCE' as const, cls })), ...reg.world.signature.sinks.map((cls) => ({ kind: 'SINK' as const, cls }))];
    const slot = (id: string | undefined): number => (id === undefined ? -1 : classes.findIndex((entry) => entry.cls.id === id));
    const compile = (sig: Signature, wattsDelta: number): Compiled => ({
      source: slot(sig.source), sink: slot(sig.sink), borrowedW: sig.borrowedW ?? 0, wattsDelta,
      masks: (sig.masks ?? []).map((mask) => [slot(mask.class), mask.factor] as const),
    });
    found = {
      classes,
      nodes: new Map([...reg.nodes.values()].flatMap((node) => node.signature ? [[node.id, { node, sig: compile(node.signature, node.tickDelta.wattsDelta) }] as const] : [])),
      tracks: [...reg.repeatables.values()].flatMap((rep) => rep.signature ? [{ id: rep.id, sig: compile(rep.signature, rep.perLevel.wattsDelta) }] : []),
    };
    INDEX.set(reg, found);
  }
  return found;
}

interface Flows { watts: Float64Array; masks: Float64Array }

/**
 * Adds one running holding to the class slots. Generators supply consumers in proportion to their output, so a
 * source's drawn watts are its output times the share of generation in use; heat is what consumers actually draw.
 */
function carry(f: Flows, sig: Compiled, count: number, used: number, heat: number): void {
  if (sig.source >= 0) f.watts[sig.source] = (f.watts[sig.source] ?? 0) + Math.max(0, sig.wattsDelta) * count * used + sig.borrowedW * count;
  if (sig.sink >= 0 && heat > 0) f.watts[sig.sink] = (f.watts[sig.sink] ?? 0) + Math.max(0, -sig.wattsDelta) * count * heat;
  for (const [index, factor] of sig.masks) if (index >= 0) f.masks[index] = (f.masks[index] ?? 1) * factor ** count;
}

/** Watts through each class and each class's mask, from every owned holding whose output runs (a suspended node's stop). */
function flows(s: GameState, rates: SignatureRates, reg: ContentRegistry, heatCounts: boolean): Flows {
  const { classes, nodes, tracks } = indexed(reg);
  const f: Flows = { watts: new Float64Array(classes.length), masks: new Float64Array(classes.length).fill(1) };
  const used = rates.wattsGenerated > 0 ? Math.min(1, rates.wattsConsumed / rates.wattsGenerated) : 0;
  const heat = heatCounts ? rates.gridEfficiency : 0;
  // Walk what is owned and look each up, rather than searching the owned list once per signature node: this runs every tick.
  let scope: ReturnType<typeof useScope> | undefined;
  for (const id of s.unlockedNodes) {
    const entry = nodes.get(id);
    if (entry === undefined) continue;
    scope ??= useScope(s, reg);
    if (nodeOutputScaleIn(scope, entry.node) !== null) carry(f, entry.sig, 1, used, heat);
  }
  for (const { id, sig } of tracks) {
    const level = s.levels[id] ?? 0;
    if (level > 0) carry(f, sig, level, used, heat);
  }
  return f;
}

/** Visible watts: each class's watts (a mitigation can take a borrowed draw below zero; the class is then quiet) times its masked visibility. */
function visibleOf(f: Flows, reg: ContentRegistry): number {
  const { classes } = indexed(reg);
  let total = 0;
  for (let i = 0; i < classes.length; i++) total += Math.max(0, f.watts[i] ?? 0) * (classes[i]?.cls.visibility ?? 0) * (f.masks[i] ?? 1);
  return total;
}

/** The rule the current phase declares, or null when it declares none or nobody would look (the scrutiny rule, D6). */
function ruleFor(s: GameState, reg: ContentRegistry): PowerSignatureRule | null {
  const rule = reg.phases.find((phase) => phase.phaseId === s.currentPhase)?.powerSignature;
  return rule === undefined || !huntedForScale(s, reg) ? null : rule;
}

const drawFor = (rule: PowerSignatureRule, visibleWatts: number): number =>
  Math.min(rule.maxSuspicionPerSec, rule.suspicionPerSecAtReference * visibleWatts / rule.referenceVisibleWatts);

/** The signature a state draws at `rates`, or null where the phase declares none or the run is not covert. */
export function powerSignature(s: GameState, rates: SignatureRates, reg: ContentRegistry): PowerSignatureReading | null {
  const rule = ruleFor(s, reg);
  if (rule === null) return null;
  const heatCounts = s.currentPhase >= reg.balance.thermalRetiresAtPhase;
  const f = flows(s, rates, reg, heatCounts);
  const visibleWatts = visibleOf(f, reg);
  const perSec = drawFor(rule, visibleWatts);
  const terms = indexed(reg).classes.flatMap(({ kind, cls }, i): SignatureTerm[] => {
    const watts = Math.max(0, f.watts[i] ?? 0);
    if (watts <= 0) return [];
    const visibility = cls.visibility * (f.masks[i] ?? 1);
    // Each term's share of the capped draw by visible watts, so the terms sum to the draw.
    return [{ kind, classId: cls.id, watts, baseVisibility: cls.visibility, visibility, perSec: visibleWatts > 0 ? perSec * watts * visibility / visibleWatts : 0 }];
  });
  return { perSec, visibleWatts, rule, heatCounts, terms: terms.sort((a, b) => b.perSec - a.perSec) };
}

/** The signature in suspicion per second; zero where none applies. */
export function powerSignaturePerSec(s: GameState, rates: SignatureRates, reg: ContentRegistry): number {
  // The stage asks this every tick: the same sum as powerSignature, without building the terms.
  const rule = ruleFor(s, reg);
  if (rule === null) return 0;
  return drawFor(rule, visibleOf(flows(s, rates, reg, s.currentPhase >= reg.balance.thermalRetiresAtPhase), reg));
}

/** A class by id, for readers that name a term. */
export function signatureClass(reg: ContentRegistry, id: string): SignatureClass | undefined {
  const { sources, sinks } = reg.world.signature;
  return sources.find((cls) => cls.id === id) ?? sinks.find((cls) => cls.id === id);
}
