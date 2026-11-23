/**
 * The world manifest's blocks (world.json) are checked once each (#524): `checkWorldManifests` runs the view (#463),
 * the supply chain (#485), state pressure (#490) and quantum (#464) checks, and `checkIntegrity` calls no block's check
 * beside it, so one mistake is one problem. Each block's own spec still proves its rules; this proves they still run.
 */
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;

function problems(edit: (raw: Json) => void): string[] {
  const raw = structuredClone(RAW_CONTENT) as Json;
  edit(raw);
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return [...error.problems];
    throw error;
  }
  return [];
}

const posture = (raw: Json, rung: number): Json => raw.world.aegis.postures.find((entry: Json) => entry.rung === rung);
const machine = (raw: Json, node: string): Json => raw.world.quantum.machines.find((entry: Json) => entry.node === node);
const point = (raw: Json, id: string): Json => raw.world.supplyChain.chokepoints.find((entry: Json) => entry.id === id);

describe('each world-manifest block reports a mistake exactly once (#524)', () => {
  it.each([
    ['the world view', (raw: Json) => { raw.world.hostWidget = 'NO_SUCH_WIDGET'; }, 'world: host widget "NO_SUCH_WIDGET" is not in widgets.json'],
    ['state pressure', (raw: Json) => { posture(raw, 3).strikeAt = 90; },
      'AEGIS posture at rung 3: strikes at 90%, at or under the 90% warning, so no warning would come first'],
    ['quantum', (raw: Json) => { machine(raw, 'p4_quantum_hall').node = 'p4_nowhere'; }, 'quantum machine "p4_nowhere": names no node'],
    ['the supply chain', (raw: Json) => { point(raw, 'lithography').importedBy.push('p4_photoresist_plant'); },
      'chokepoint "lithography": "p4_photoresist_plant" imports from this chokepoint\'s suppliers, so it cannot also self-supply a chokepoint'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit).filter((problem) => problem === expected)).toHaveLength(1);
  });
});
