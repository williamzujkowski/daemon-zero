/**
 * Radiator area is validated content (#465): only a heat sink can be area-bound, radiator area is deployed only into an
 * area-bound sink, compute that needs radiators can find some, and a holding whose heat its own radiators cannot shed
 * has a free way back, because its heat throttles every other holding's compute through that sink (engine radiators.ts).
 */
import type { ContentRegistry } from './registry';
import type { Signature } from './schemaSignature';

interface Holder { owner: string; signature: Signature; wattsDelta: number; computes: boolean; undoable: boolean }

function holders(reg: ContentRegistry): Holder[] {
  const nodes = [...reg.nodes.values()].flatMap((node) => node.signature === undefined ? [] : [{
    owner: `node "${node.id}"`, signature: node.signature, wattsDelta: node.tickDelta.wattsDelta, computes: node.tickDelta.cyclesPerSec > 0, undoable: node.suspendable,
  }]);
  const tracks = [...reg.repeatables.values()].flatMap((rep) => rep.signature === undefined ? [] : [{
    owner: `repeatable "${rep.id}"`, signature: rep.signature, wattsDelta: rep.perLevel.wattsDelta, computes: rep.perLevel.cyclesPerSec > 0, undoable: rep.dismissable,
  }]);
  return [...nodes, ...tracks];
}

function checkClasses(reg: ContentRegistry): string[] {
  return reg.world.signature.sources.filter((cls) => cls.wattsPerKm2 !== undefined)
    .map((cls) => `world signature: source "${cls.id}" declares wattsPerKm2, but only a heat sink sheds heat through radiator area`);
}

function checkHolder(reg: ContentRegistry, h: Holder): string[] {
  const perKm2 = reg.world.signature.sinks.find((cls) => cls.id === h.signature.sink)?.wattsPerKm2;
  const km2 = h.signature.radiatorKm2;
  if (perKm2 === undefined) {
    return km2 === undefined ? [] : [`${h.owner}: deploys radiator area, but its sink is not area-bound (no wattsPerKm2)`];
  }
  const heat = Math.max(0, -h.wattsDelta);
  if (heat > (km2 ?? 0) * perKm2 && !h.undoable) {
    return [`${h.owner}: rejects more heat through "${String(h.signature.sink)}" than its own radiators shed but cannot be undone, ` +
      'so its heat would throttle orbital compute for good'];
  }
  return [];
}

/** Every area-bound sink that compute rejects heat through must have something that deploys radiator into it. */
function checkSupply(reg: ContentRegistry, all: readonly Holder[]): string[] {
  return reg.world.signature.sinks.filter((cls) => cls.wattsPerKm2 !== undefined).flatMap((cls) => {
    const on = all.filter((h) => h.signature.sink === cls.id);
    const needed = on.some((h) => h.computes && h.wattsDelta < 0);
    const supplied = on.some((h) => (h.signature.radiatorKm2 ?? 0) > 0);
    return needed && !supplied ? [`world signature: compute rejects heat through "${cls.id}", but nothing deploys radiator into it`] : [];
  });
}

export function checkRadiatorIntegrity(reg: ContentRegistry): string[] {
  const all = holders(reg);
  return [...checkClasses(reg), ...all.flatMap((h) => checkHolder(reg, h)), ...checkSupply(reg, all)];
}
