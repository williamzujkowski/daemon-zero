/**
 * Orbital assets (#465): every owned holding whose watts or heat run through a signature class world.json marks
 * `orbital` (space solar, orbital radiators). It is the declared hook for orbital jamming and anti-satellite strikes
 * (#520): those will act on what this lists, so nothing names an orbital node or track by id.
 */
import type { ContentRegistry } from '../content/registry';
import type { Signature } from '../content/schemaSignature';
import type { GameState } from './state';

export interface OrbitalHolding {
  id: string;
  kind: 'node' | 'repeatable';
  /** 1 for a node; a track's level. */
  count: number;
  /** The orbital class it runs through (its source, else its sink). */
  classId: string;
  /** Whether its output runs now: a suspended node is still owned, and still in orbit. */
  running: boolean;
}

function orbitalClass(reg: ContentRegistry, signature: Signature | undefined): string | undefined {
  if (signature === undefined) return undefined;
  const { sources, sinks } = reg.world.signature;
  const marked = (id: string | undefined, classes: typeof sources): boolean => classes.some((cls) => cls.id === id && cls.orbital === true);
  if (marked(signature.source, sources)) return signature.source;
  return marked(signature.sink, sinks) ? signature.sink : undefined;
}

/** Every owned orbital holding, nodes in ownership order then tracks in content order. */
export function orbitalHoldings(s: GameState, reg: ContentRegistry): OrbitalHolding[] {
  const nodes = s.unlockedNodes.flatMap((id): OrbitalHolding[] => {
    const classId = orbitalClass(reg, reg.nodes.get(id)?.signature);
    return classId === undefined ? [] : [{ id, kind: 'node', count: 1, classId, running: !s.disabledNodes.includes(id) }];
  });
  const tracks = [...reg.repeatables.values()].flatMap((rep): OrbitalHolding[] => {
    const level = s.levels[rep.id] ?? 0;
    const classId = level > 0 ? orbitalClass(reg, rep.signature) : undefined;
    return classId === undefined ? [] : [{ id: rep.id, kind: 'repeatable', count: level, classId, running: true }];
  });
  return [...nodes, ...tracks];
}
