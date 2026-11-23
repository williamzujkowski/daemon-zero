/**
 * The heat-and-power signature is validated content (#482). Every class a holding names exists and is the right kind,
 * each field sits on a holding it fits (a source on a generator or a borrowed draw, a sink on a consumer), borrowed
 * power stays before the AI owns power, heat counts only once server °C retires, and every signature is read under its
 * own phase's rule, so no authored visibility is silently inert.
 */
import type { ContentRegistry } from './registry';
import type { TickDelta } from './schema';
import type { Signature, SignatureClass } from './schemaSignature';

interface Carrier { owner: string; phase: number; signature: Signature; delta: TickDelta }

function carriers(reg: ContentRegistry): Carrier[] {
  const nodes = [...reg.nodes.values()].flatMap((node) => node.signature ? [{ owner: `node "${node.id}"`, phase: node.phaseId, signature: node.signature, delta: node.tickDelta }] : []);
  const tracks = [...reg.repeatables.values()].flatMap((rep) => rep.signature ? [{ owner: `repeatable "${rep.id}"`, phase: rep.phaseId, signature: rep.signature, delta: rep.perLevel }] : []);
  return [...nodes, ...tracks];
}

/** A class's visibility by id, or 0 for an unknown id (reported by checkClassRefs). */
export function classVisibility(reg: ContentRegistry, id: string): number {
  const { sources, sinks } = reg.world.signature;
  return (sources.find((cls) => cls.id === id) ?? sinks.find((cls) => cls.id === id))?.visibility ?? 0;
}

function checkClassIds(reg: ContentRegistry): string[] {
  const ids = [...reg.world.signature.sources, ...reg.world.signature.sinks].map((cls: SignatureClass) => cls.id);
  return ids.filter((id, index) => ids.indexOf(id) !== index).map((id) => `world signature: duplicate class id "${id}"`);
}

function checkClassRefs(reg: ContentRegistry, c: Carrier): string[] {
  const sources = new Set(reg.world.signature.sources.map((cls) => cls.id)), sinks = new Set(reg.world.signature.sinks.map((cls) => cls.id));
  const problems: string[] = [];
  const { source, sink, masks } = c.signature;
  if (source !== undefined && !sources.has(source)) problems.push(`${c.owner}: signature source "${source}" is not a declared power source`);
  if (sink !== undefined && !sinks.has(sink)) problems.push(`${c.owner}: signature sink "${sink}" is not a declared heat sink`);
  for (const mask of masks ?? []) {
    if (!sources.has(mask.class) && !sinks.has(mask.class)) problems.push(`${c.owner}: signature mask names unknown class "${mask.class}"`);
  }
  return problems;
}

/** Each field on a holding it fits: watts to draw for a source, a consumer for a sink, something for an empty block. */
function checkShape(c: Carrier): string[] {
  const { source, sink, borrowedW, masks } = c.signature;
  const problems: string[] = [];
  if (source === undefined && sink === undefined && masks === undefined) problems.push(`${c.owner}: signature names no source, sink or mask`);
  if (borrowedW !== undefined && source === undefined) problems.push(`${c.owner}: a borrowed draw needs the source it is drawn from`);
  if (source !== undefined && borrowedW === undefined && c.delta.wattsDelta <= 0) problems.push(`${c.owner}: signature source on a holding that neither generates power nor borrows it`);
  if (source !== undefined && borrowedW !== undefined && c.delta.wattsDelta !== 0) problems.push(`${c.owner}: a borrowed draw sits outside the power budget, so it cannot also move wattsDelta`);
  if (sink !== undefined && c.delta.wattsDelta >= 0) problems.push(`${c.owner}: signature sink on a holding that draws no power, so it rejects no heat`);
  return problems;
}

/** Borrowed power is someone else's before the AI owns any; heat is server °C's until it retires (SCALE.md rule 7). */
function checkPhaseFit(reg: ContentRegistry, c: Carrier): string[] {
  const b = reg.balance, problems: string[] = [];
  if (c.signature.borrowedW !== undefined && c.phase >= b.corporatePhase) {
    problems.push(`${c.owner}: borrows power in Phase ${String(c.phase)}, where the AI owns its power (from Phase ${String(b.corporatePhase)})`);
  }
  if (c.signature.sink !== undefined && c.phase < b.thermalRetiresAtPhase) {
    problems.push(`${c.owner}: names a heat sink in Phase ${String(c.phase)}, where server °C still carries heat (until Phase ${String(b.thermalRetiresAtPhase)})`);
  }
  if (reg.phases.find((phase) => phase.phaseId === c.phase)?.powerSignature === undefined) {
    problems.push(`${c.owner}: has a signature but Phase ${String(c.phase)} declares no powerSignature rule, so it would never count`);
  }
  return problems;
}

export function checkSignatureIntegrity(reg: ContentRegistry): string[] {
  return [...checkClassIds(reg), ...carriers(reg).flatMap((c) => [...checkClassRefs(reg, c), ...checkShape(c), ...checkPhaseFit(reg, c)])];
}
