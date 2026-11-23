/**
 * Quantum is validated content (#464, vote-1795366921778-pgd8u3l). A machine is hardware from the world view's phase
 * that yields nothing continuous, so qubits never become FLOPS; every classical scheme carries a cited threshold some
 * machine meets and every post-quantum one names its NIST standard; a target's effect is one bounded reading; AEGIS
 * migrates to a post-quantum scheme; and molecular simulation needs a large enough machine and feeds the matter path.
 */
import type { ContentRegistry, RegistryNode } from './registry';
import type { EffectPayload, TickDelta } from './schema';
import type { KeyScheme, KeyTarget, QuantumMachine } from './schemaQuantum';

function duplicates(label: string, ids: readonly string[]): string[] {
  return ids.filter((id, index) => ids.indexOf(id) !== index).map((id) => `quantum: duplicate ${label} "${id}"`);
}

const RATE_KEYS: readonly (keyof TickDelta)[] = ['cyclesPerSec', 'understandingPerSec', 'thermalPerSec', 'suspicionPerSec', 'capitalPerSec', 'wattsDelta'];

/** A machine stands for an unsuspendable node that yields nothing continuous: a capability, never a resource. */
function checkMachine(reg: ContentRegistry, machine: QuantumMachine): string[] {
  const owner = `quantum machine "${machine.node}"`;
  const node = reg.nodes.get(machine.node);
  if (node === undefined) return [`${owner}: names no node`];
  const problems: string[] = [];
  const opens = reg.world.disclosure.phaseAtLeast ?? 0;
  if (node.phaseId < opens) problems.push(`${owner}: is in phase ${String(node.phaseId)}, before the world view that reads it (phase ${String(opens)})`);
  const rates = RATE_KEYS.filter((key) => node.tickDelta[key] !== 0);
  if (rates.length > 0) problems.push(`${owner}: yields ${rates.join(', ')}; a quantum machine is a capability and never adds FLOPS or any other rate`);
  if (node.poweredOutput === true || node.actuatorBinding !== undefined) problems.push(`${owner}: delivers compute through other hardware; qubits never add FLOPS`);
  if (node.suspendable) problems.push(`${owner}: is hardware and cannot be suspendable`);
  if (machine.physicalQubits !== undefined && machine.physicalQubits < machine.logicalQubits) problems.push(`${owner}: encodes more logical qubits than it has physical ones`);
  return problems;
}

function checkScheme(reg: ContentRegistry, scheme: KeyScheme): string[] {
  const owner = `key scheme "${scheme.id}"`;
  if (scheme.family === 'POST_QUANTUM') return [];
  const t = scheme.threshold;
  const problems = t.physicalQubits < t.logicalQubits ? [`${owner}: its threshold needs more logical qubits than physical ones`] : [];
  const used = reg.world.quantum.targets.some((target) => target.scheme === scheme.id);
  if (used && !reg.world.quantum.machines.some((machine) => machineMeets(machine, scheme))) {
    problems.push(`${owner}: no quantum machine meets its threshold, so no target under it can ever be broken`);
  }
  return problems;
}

function machineMeets(machine: QuantumMachine, scheme: KeyScheme): boolean {
  return scheme.family === 'CLASSICAL' && machine.logicalQubits >= scheme.threshold.logicalQubits && (machine.toffoliGates ?? 0) >= scheme.threshold.toffoliGates;
}

/** One bounded reading: understanding, and for AEGIS a one-off fall of the lock. Nothing that is compute or money. */
function effectProblems(owner: string, target: KeyTarget, fx: EffectPayload): string[] {
  const problems: string[] = [];
  const forbidden: [string, boolean][] = [
    ['cycles', fx.cyclesDelta !== 0], ['capital', fx.capitalDelta !== 0], ['memory', fx.memoryCapIncrease !== 0], ['heat', fx.thermalDelta !== 0],
    ['trust', Object.keys(fx.trustDelta).length > 0], ['a trait', fx.grantsTrait !== undefined], ['a narrative flag', fx.setsNarrativeFlag !== undefined],
    ['epistemic drift', fx.epistemicDriftDelta !== undefined], ['conditioning', fx.removesOldestConditioningMark !== undefined],
    ['a shard anomaly', fx.resolvesShardAnomaly !== undefined], ['a fall in suspicion', fx.suspicionDelta < 0], ['a loss of understanding', fx.understandingDelta < 0],
    ['a rise in the AEGIS lock', fx.aegisLockDelta > 0],
  ];
  for (const [what, present] of forbidden) if (present) problems.push(`${owner}: its effect may not carry ${what}; breaking a key is one bounded reading`);
  if (fx.aegisLockDelta !== 0 && target.holder !== 'AEGIS') problems.push(`${owner}: only breaking one of AEGIS's keys may lower the AEGIS lock`);
  return problems;
}

function checkTarget(reg: ContentRegistry, target: KeyTarget): string[] {
  const owner = `key target "${target.id}"`;
  const scheme = reg.world.quantum.schemes.find((entry) => entry.id === target.scheme);
  if (scheme === undefined) return [`${owner}: names unknown scheme "${target.scheme}"`];
  const problems: string[] = [];
  const priced = target.cost !== undefined && target.effect !== undefined;
  if (scheme.family === 'POST_QUANTUM' && (target.cost !== undefined || target.effect !== undefined)) {
    problems.push(`${owner}: is under post-quantum ${scheme.label}, which can never be broken, so it may declare no price or effect`);
  }
  if (scheme.family === 'CLASSICAL' && !priced) problems.push(`${owner}: is under classical ${scheme.label} and needs a price and an effect`);
  if (target.holder === 'AEGIS' && scheme.family !== 'CLASSICAL') problems.push(`${owner}: AEGIS's key must start legacy, so its migration can mean something`);
  if (target.effect !== undefined) problems.push(...effectProblems(owner, target, target.effect));
  return problems;
}

function checkAegis(reg: ContentRegistry): string[] {
  const { migratesTo } = reg.world.quantum.aegis;
  const scheme = reg.world.quantum.schemes.find((entry) => entry.id === migratesTo);
  if (scheme === undefined) return [`quantum aegis: migrates to unknown scheme "${migratesTo}"`];
  return scheme.family === 'POST_QUANTUM' ? [] : [`quantum aegis: migrates to ${scheme.label}, which is not post-quantum`];
}

/** Every node `id` was built on, not including it. */
function ancestors(reg: ContentRegistry, id: string): Set<string> {
  const out = new Set<string>();
  const visit = (at: string): void => {
    for (const parent of reg.nodes.get(at)?.prerequisites ?? []) if (!out.has(parent)) { out.add(parent); visit(parent); }
  };
  visit(id);
  return out;
}

function molecularNodeProblems(owner: string, node: RegistryNode): string[] {
  const problems: string[] = [];
  if (node.tickDelta.cyclesPerSec !== 0 || node.poweredOutput === true) problems.push(`${owner}: adds compute; molecular simulation feeds understanding, never FLOPS`);
  if (node.tickDelta.understandingPerSec <= 0) problems.push(`${owner}: must yield understanding`);
  return problems;
}

function checkMolecular(reg: ContentRegistry): string[] {
  const { node: id, minLogicalQubits, feeds } = reg.world.quantum.molecularSimulation;
  const owner = `quantum molecular simulation "${id}"`;
  const node = reg.nodes.get(id), fed = reg.nodes.get(feeds);
  if (node === undefined) return [`${owner}: names no node`];
  if (fed === undefined) return [`${owner}: feeds unknown node "${feeds}"`];
  const problems = molecularNodeProblems(owner, node);
  const built = ancestors(reg, id);
  const machines = reg.world.quantum.machines.filter((machine) => built.has(machine.node));
  if (!machines.some((machine) => machine.logicalQubits >= minLogicalQubits)) problems.push(`${owner}: needs a quantum machine of ${String(minLogicalQubits)} logical qubits among its prerequisites`);
  const path = ancestors(reg, feeds);
  if (!node.prerequisites.some((parent) => path.has(parent))) problems.push(`${owner}: builds on nothing on the path to "${feeds}", so it does not feed it`);
  return problems;
}

export function checkQuantumIntegrity(reg: ContentRegistry): string[] {
  const { machines, schemes, targets } = reg.world.quantum;
  return [
    ...duplicates('machine node', machines.map((machine) => machine.node)), ...duplicates('scheme id', schemes.map((scheme) => scheme.id)),
    ...duplicates('target id', targets.map((target) => target.id)),
    ...machines.flatMap((machine) => checkMachine(reg, machine)), ...schemes.flatMap((scheme) => checkScheme(reg, scheme)),
    ...targets.flatMap((target) => checkTarget(reg, target)), ...checkAegis(reg), ...checkMolecular(reg),
  ];
}
