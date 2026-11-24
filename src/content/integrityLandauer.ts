/**
 * The Landauer bound is validated content (#486, docs/SCALE.md "Phase 6 Swarm"): erasing one bit at temperature T costs at
 * least k T ln 2, so no compute whose heat leaves through a sink that declares its temperature may do more 8-bit ops a
 * joule than 1 / (bitsErasedPerOp x k T ln 2). Compute on such a sink must draw the watts that bound is read against.
 */
import type { ContentRegistry } from './registry';
import type { Signature } from './schemaSignature';

/** The Boltzmann constant in joules per kelvin (exact since the 2019 SI redefinition). */
export const BOLTZMANN_J_PER_K = 1.380649e-23;

/** The most 8-bit ops a joule a sink at `kelvin` allows when each op erases `bitsErasedPerOp` bits. */
export function landauerOpsPerJoule(kelvin: number, bitsErasedPerOp: number): number {
  return 1 / (bitsErasedPerOp * BOLTZMANN_J_PER_K * kelvin * Math.LN2);
}

interface Computer { owner: string; signature: Signature | undefined; opsPerSec: number; wattsDelta: number }

function computers(reg: ContentRegistry): Computer[] {
  const nodes = [...reg.nodes.values()].map((node) => ({ owner: `node "${node.id}"`, signature: node.signature,
    opsPerSec: node.tickDelta.cyclesPerSec, wattsDelta: node.tickDelta.wattsDelta }));
  const tracks = [...reg.repeatables.values()].map((rep) => ({ owner: `repeatable "${rep.id}"`, signature: rep.signature,
    opsPerSec: rep.perLevel.cyclesPerSec, wattsDelta: rep.perLevel.wattsDelta }));
  return [...nodes, ...tracks].filter((entry) => entry.opsPerSec > 0);
}

function checkComputer(reg: ContentRegistry, entry: Computer): string[] {
  const sink = reg.world.signature.sinks.find((cls) => cls.id === entry.signature?.sink);
  if (sink?.landauer === undefined) return [];
  const { kelvin, bitsErasedPerOp } = sink.landauer;
  if (entry.wattsDelta >= 0) return [`${entry.owner}: computes through "${sink.id}", which is Landauer-bound, but draws no watts to bound`];
  const ceiling = landauerOpsPerJoule(kelvin, bitsErasedPerOp), perJoule = entry.opsPerSec / -entry.wattsDelta;
  return perJoule > ceiling
    ? [`${entry.owner}: ${perJoule.toExponential(2)} ops a joule exceeds the Landauer bound of ${ceiling.toExponential(2)} at ${String(kelvin)} K`]
    : [];
}

/** A Landauer bound needs a temperature, which only a sink that sheds heat as light (wattsPerKm2) declares. */
function checkSinks(reg: ContentRegistry): string[] {
  return [...reg.world.signature.sources, ...reg.world.signature.sinks]
    .filter((cls) => cls.landauer !== undefined && (cls.wattsPerKm2 === undefined || reg.world.signature.sources.includes(cls)))
    .map((cls) => `world signature: "${cls.id}" declares a Landauer bound, but only an area-bound heat sink has a temperature to read it at`);
}

export function checkLandauerIntegrity(reg: ContentRegistry): string[] {
  return [...checkSinks(reg), ...computers(reg).flatMap((entry) => checkComputer(reg, entry))];
}
