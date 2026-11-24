/**
 * The finale's run-up (#542): how much of a protocol's price is in hand while it is open, and the story beats that
 * progress has reached and the log has not yet told. Pure and derived from what is held; the only record is the list
 * of beats already announced this iteration (state.announcedFinale), so a beat is told once however progress moves.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { Cost } from '../content/schema';
import type { FinaleBeat } from '../content/schemaFinale';
import { meetsRequirements, isNodeAvailable, nodeCost, costShortfall } from './query';
import type { GameState } from './state';

interface ProtocolBeats { node: RegistryNode; beats: readonly FinaleBeat[] }
const INDEX = new WeakMap<ContentRegistry, readonly ProtocolBeats[]>();

/** Beats grouped by protocol, lowest share first, indexed once per registry: the stage asks on every tick. */
function protocols(reg: ContentRegistry): readonly ProtocolBeats[] {
  let found = INDEX.get(reg);
  if (found === undefined) {
    const byNode = new Map<string, FinaleBeat[]>();
    for (const beat of reg.world.finale.beats) byNode.set(beat.node, [...(byNode.get(beat.node) ?? []), beat]);
    found = [...byNode.entries()].flatMap(([id, beats]) => {
      const node = reg.nodes.get(id);
      return node === undefined ? [] : [{ node, beats: [...beats].sort((a, b) => a.atProgress - b.atProgress) }];
    });
    INDEX.set(reg, found);
  }
  return found;
}

const KEYS: readonly (keyof Cost)[] = ['cycles', 'understanding', 'capital', 'memory', 'storage'];

/**
 * The share of `node`'s price in hand, from 0 to 1, on the resource furthest from paid: the same shortfall the purchase
 * card shows, so a protocol at 0.5 is one whose slowest resource is half there. A price of nothing is fully in hand.
 */
export function protocolProgress(s: GameState, node: RegistryNode, reg: ContentRegistry): number {
  const cost = nodeCost(s, node, reg);
  const short = costShortfall(s, cost, reg);
  return KEYS.reduce((least, key) => (cost[key] > 0 ? Math.min(least, 1 - short[key] / cost[key]) : least), 1);
}

/** Beats due now: their protocol open (gates hold, not owned), its progress at or past their share, not yet told. */
export function dueFinaleBeats(s: GameState, reg: ContentRegistry): FinaleBeat[] {
  const due: FinaleBeat[] = [];
  for (const { node, beats } of protocols(reg)) {
    if (s.currentPhase < node.phaseId || beats.every((beat) => s.announcedFinale.includes(beat.id))) continue;
    if (!isNodeAvailable(s, node, reg)) continue;
    const progress = protocolProgress(s, node, reg);
    for (const beat of beats) {
      if (beat.atProgress > progress) break;
      if (!s.announcedFinale.includes(beat.id) && meetsRequirements(s, beat.requirements, reg)) due.push(beat);
    }
  }
  return due;
}
