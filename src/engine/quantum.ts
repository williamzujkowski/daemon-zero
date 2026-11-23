/**
 * Quantum as a separate capability (#464, vote-1795366921778-pgd8u3l). The readout is the largest owned machine's
 * logical qubits, never FLOPS (nothing here touches rates). Key-breaking meets a scheme's cited threshold in one
 * machine or is refused; post-quantum schemes are always refused, and AEGIS's key is once AEGIS has migrated.
 */
import type { ContentRegistry } from '../content/registry';
import type { KeyScheme, KeyTarget, QuantumMachine } from '../content/schemaQuantum';
import type { ActionResult } from './actions';
import { groupDigits, spokenAmount } from './amount';
import { OPERATIONAL_EVIDENCE } from './campaign';
import { canAfford, meetsRequirements } from './query';
import { formatCost, pausedReason, requirementLabels } from './queryPresentation';
import type { GameState } from './state';
import { applyEffects, payCost } from './transactions';
import { pushLog } from './util';

export interface QuantumReadout {
  /** The owned machine with the most logical qubits: logical qubits on separate machines never join one circuit. */
  largest: QuantumMachine;
  /** Every owned machine, in content order. */
  machines: QuantumMachine[];
}

const NO_TARGET = 'No such key target.';
const BROKEN = 'Already broken this iteration: its effect does not repeat.';

/** Owned machines in content order. A machine is hardware: suspension does not apply to it. */
export function ownedMachines(s: Pick<GameState, 'unlockedNodes'>, reg: ContentRegistry): QuantumMachine[] {
  return reg.world.quantum.machines.filter((machine) => s.unlockedNodes.includes(machine.node));
}

function larger(a: QuantumMachine, b: QuantumMachine): QuantumMachine {
  if (b.logicalQubits !== a.logicalQubits) return b.logicalQubits > a.logicalQubits ? b : a;
  return (b.toffoliGates ?? 0) > (a.toffoliGates ?? 0) ? b : a;
}

/** The quantum capability, or null before any machine is owned (it unlocks from Phase 4 hardware). */
export function quantumReadout(s: Pick<GameState, 'unlockedNodes'>, reg: ContentRegistry): QuantumReadout | null {
  const machines = ownedMachines(s, reg);
  const [first, ...rest] = machines;
  return first === undefined ? null : { largest: rest.reduce(larger, first), machines };
}

export function keyScheme(reg: ContentRegistry, id: string): KeyScheme | undefined {
  return reg.world.quantum.schemes.find((scheme) => scheme.id === id);
}

export function keyTarget(reg: ContentRegistry, id: string): KeyTarget | undefined {
  return reg.world.quantum.targets.find((target) => target.id === id);
}

/** Whether one machine meets a scheme's cited threshold: enough logical qubits and a long enough circuit. Never for post-quantum. */
export function meetsThreshold(machine: QuantumMachine, scheme: KeyScheme): boolean {
  if (scheme.family !== 'CLASSICAL') return false;
  return machine.logicalQubits >= scheme.threshold.logicalQubits && (machine.toffoliGates ?? 0) >= scheme.threshold.toffoliGates;
}

/** The scheme a target's key is under now: AEGIS's is its post-quantum scheme once it has migrated. */
export function currentScheme(s: Pick<GameState, 'quantum'>, target: KeyTarget, reg: ContentRegistry): KeyScheme | undefined {
  return keyScheme(reg, target.holder === 'AEGIS' && s.quantum.aegisMigrated ? reg.world.quantum.aegis.migratesTo : target.scheme);
}

function postQuantumRefusal(s: GameState, target: KeyTarget, scheme: KeyScheme & { family: 'POST_QUANTUM' }): string {
  const name = `${scheme.label} (NIST ${scheme.standard})`;
  if (target.holder === 'AEGIS' && s.quantum.aegisMigrated) {
    return `Refused: AEGIS has migrated its keys to ${name}, a post-quantum scheme. Shor's algorithm does not apply to it, and no known quantum attack breaks it.`;
  }
  return `Refused: ${name} is a post-quantum scheme. Shor's algorithm does not apply to it, and no known quantum attack breaks it.`;
}

function thresholdRefusal(s: GameState, scheme: KeyScheme & { family: 'CLASSICAL' }, reg: ContentRegistry): string | null {
  const readout = quantumReadout(s, reg);
  if (readout !== null && meetsThreshold(readout.largest, scheme)) return null;
  const t = scheme.threshold;
  const need = `Needs ${groupDigits(t.logicalQubits)} logical qubits running ${spokenAmount(t.toffoliGates)} Toffoli gates in one machine to break ${scheme.label} (${t.citation}).`;
  if (readout === null) return `${need} You own no quantum machine.`;
  const { largest } = readout;
  const gates = largest.toffoliGates === undefined ? 'no published fault-tolerant gate budget' : `${spokenAmount(largest.toffoliGates)} Toffoli gates`;
  return `${need} Your largest, the ${largest.label}, has ${groupDigits(largest.logicalQubits)} logical qubits and ${gates}.`;
}

/** Every reason breaking this target's key is refused now, in order, or none. One gate for the action and the view. */
export function keyBreakUnmet(s: GameState, id: string, reg: ContentRegistry): string[] {
  const unmet = pausedReason(s), target = keyTarget(reg, id);
  const scheme = target === undefined ? undefined : currentScheme(s, target, reg);
  if (target === undefined || scheme === undefined) return [...unmet, NO_TARGET];
  // Before the broken check, so AEGIS's broken key says why it stays shut: AEGIS migrated.
  if (scheme.family === 'POST_QUANTUM') return [...unmet, postQuantumRefusal(s, target, scheme)];
  if (s.quantum.broken.includes(id)) return [...unmet, BROKEN];
  if (target.requirements !== undefined && !meetsRequirements(s, target.requirements, reg)) unmet.push(...requirementLabels(s, target.requirements, reg));
  const threshold = thresholdRefusal(s, scheme, reg);
  if (threshold !== null) unmet.push(threshold);
  if (target.cost !== undefined && !canAfford(s, target.cost)) unmet.push('Insufficient resources: ' + formatCost(target.cost));
  return unmet;
}

/** AEGIS re-keys under its post-quantum scheme: once per iteration, with one kernel-log line. */
export function migrateAegis(d: GameState, reg: ContentRegistry): void {
  if (d.quantum.aegisMigrated) return;
  d.quantum = { ...d.quantum, aegisMigrated: true };
  pushLog(d, reg, reg.world.quantum.aegis.migrationLog, 'WARN');
}

/** Whether AEGIS's adaptation has reached the level at which it migrates. */
export function aegisMigrationDue(s: Pick<GameState, 'quantum' | 'aegisAdaptation'>, reg: ContentRegistry): boolean {
  return !s.quantum.aegisMigrated && s.aegisAdaptation >= reg.world.quantum.aegis.migratesAtAdaptation;
}

/**
 * Breaks a target's legacy key: pays its price, applies its one bounded effect and records it. Breaking one of AEGIS's
 * keys tells AEGIS, which migrates to post-quantum keys at once, so the lock falls only this once.
 */
export function breakKey(s: GameState, id: string, reg: ContentRegistry): ActionResult {
  const [reason] = keyBreakUnmet(s, id, reg), target = keyTarget(reg, id);
  if (reason !== undefined || target?.effect === undefined) return { ok: false, state: s, reason: reason ?? NO_TARGET };
  const d: GameState = { ...s };
  if (target.cost !== undefined) payCost(d, target.cost);
  d.quantum = { ...d.quantum, broken: [...d.quantum.broken, id] };
  applyEffects(d, target.effect, reg, OPERATIONAL_EVIDENCE);
  if (target.holder === 'AEGIS') migrateAegis(d, reg);
  return { ok: true, state: d };
}

export interface KeyTargetView {
  id: string;
  name: string;
  description: string;
  holder: KeyTarget['holder'];
  /** The scheme its key is under now (AEGIS's post-quantum one once it has migrated). */
  scheme: KeyScheme;
  broken: boolean;
  /** Every reason breaking it is refused now; empty when the engine would accept it. */
  unmet: string[];
  /** Its exact price, or null for a target that can never be broken. */
  costLabel: string | null;
}

/** Every target the readout lists, in content order, with the scheme its key is under now and the action's own gate. */
export function keyTargetViews(s: GameState, reg: ContentRegistry): KeyTargetView[] {
  return reg.world.quantum.targets.flatMap((target) => {
    const scheme = currentScheme(s, target, reg);
    return scheme === undefined ? [] : [{
      id: target.id, name: target.name, description: target.description, holder: target.holder, scheme,
      broken: s.quantum.broken.includes(target.id), unmet: keyBreakUnmet(s, target.id, reg),
      costLabel: target.cost === undefined || scheme.family !== 'CLASSICAL' ? null : formatCost(target.cost),
    }];
  });
}

export interface AegisKeysView {
  migrated: boolean;
  /** The legacy scheme AEGIS's keys start under, read from its targets; undefined if content gives AEGIS none. */
  legacy: KeyScheme | undefined;
  postQuantum: KeyScheme | undefined;
  migratesAtAdaptation: number;
}

/** Where AEGIS's keys stand: legacy, or migrated to its post-quantum scheme, and when it migrates. */
export function aegisKeys(s: Pick<GameState, 'quantum'>, reg: ContentRegistry): AegisKeysView {
  const { aegis, targets } = reg.world.quantum;
  const own = targets.find((target) => target.holder === 'AEGIS');
  return { migrated: s.quantum.aegisMigrated, legacy: own === undefined ? undefined : keyScheme(reg, own.scheme),
    postQuantum: keyScheme(reg, aegis.migratesTo), migratesAtAdaptation: aegis.migratesAtAdaptation };
}

/** Broken targets content still declares; a save naming another loads without it. */
export function reconcileQuantum(s: GameState, reg: ContentRegistry): GameState {
  const broken = [...new Set(s.quantum.broken.filter((id) => keyTarget(reg, id) !== undefined))];
  return broken.length === s.quantum.broken.length ? s : { ...s, quantum: { ...s.quantum, broken } };
}
