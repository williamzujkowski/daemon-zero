/**
 * Save v20 (#484): storage used and storage capacity. A v19 save migrates with the scratch space and nothing held, then
 * reconcile derives both from what it owns, the only way storage moves; the pre-rescale saves of every phase load with
 * their gates' storage and their running data held; a hand-edited figure is healed; the fields are validated.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { deserialize, migrate, MIGRATIONS, SCHEMA_VERSION, serialize, storageCapacity, storageHeld, toggleNode, unlockNode, type GameState } from '../src/engine';
import { FIXTURE_TEXTS, fixtureState } from './fallback-states';

const funded = (s: GameState): GameState => ({ ...s, cycles: 1e30, understanding: 1e30, capital: 1e30, memoryCap: s.memoryCap + 1e30 });
const withLexicon = (): GameState => {
  const result = unlockNode(funded(fixtureState(1)), 'p1_nlp_lexicon', CONTENT);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
};

describe('save v20 (#484)', () => {
  it('is followed only by the quantum record (#464, v21), the escalation announcements (#490, v22), insurance (#498, v23), the conflict record (#517, v24) and the raid aftermath (#519, v25)', () => {
    expect(SCHEMA_VERSION).toBe(25);
  });

  it('migrates a v19 save to the v20 literals, then derives storage from ownership on load', () => {
    const current = withLexicon();
    const raw = JSON.parse(serialize(current)) as Record<string, unknown>;
    delete raw.storageUsed;
    delete raw.storageCap;
    const v19 = { ...raw, schemaVersion: 19 };
    expect(migrate(v19, MIGRATIONS, 20)).toEqual({ ...raw, storageUsed: 0, storageCap: 65536, schemaVersion: 20 });
    const loaded = deserialize(JSON.stringify(v19), CONTENT);
    expect([loaded.storageUsed, loaded.storageCap]).toEqual([current.storageUsed, current.storageCap]);
    expect(loaded.storageUsed).toBe(CONTENT.nodes.get('p1_nlp_lexicon')?.cost.storage);
    expect(loaded).toEqual(current);
  });

  it('loads every pre-rescale save with its gates\' storage and its running data held', () => {
    FIXTURE_TEXTS.forEach((_text, phase) => {
      const s = fixtureState(phase);
      expect(s.storageCap, `phase ${String(phase)}`).toBe(storageCapacity(s, CONTENT));
      expect(s.storageUsed, `phase ${String(phase)}`).toBe(storageHeld(s, CONTENT));
      expect(s.storageUsed, `phase ${String(phase)}`).toBeLessThanOrEqual(s.storageCap);
      // Every phase after the first was reached through a gate, and every gate grants storage.
      if (phase > 0) expect(s.storageCap, `phase ${String(phase)}`).toBeGreaterThan(CONTENT.balance.baseStorageCap);
    });
  });

  it('counts suspended data as holding nothing, across a round trip', () => {
    const suspended = toggleNode(withLexicon(), 'p1_nlp_lexicon', CONTENT);
    if (!suspended.ok) throw new Error(suspended.reason);
    expect(deserialize(serialize(suspended.state), CONTENT).storageUsed).toBe(0);
  });

  it('heals a hand-edited figure: storage held is what running data holds, and capacity never below the grants', () => {
    const s = withLexicon();
    const forged = { ...JSON.parse(serialize(s)) as Record<string, unknown>, storageUsed: 0, storageCap: 0 };
    const loaded = deserialize(JSON.stringify(forged), CONTENT);
    expect([loaded.storageUsed, loaded.storageCap]).toEqual([s.storageUsed, s.storageCap]);
    // A larger saved capacity is kept, as memory's is.
    expect(deserialize(JSON.stringify({ ...forged, storageCap: 2 ** 70 }), CONTENT).storageCap).toBe(2 ** 70);
  });

  it('refuses a storage figure the schema cannot hold', () => {
    const raw = JSON.parse(serialize(withLexicon())) as Record<string, unknown>;
    expect(() => deserialize(JSON.stringify({ ...raw, storageUsed: -1 }), CONTENT)).toThrow(/storageUsed/);
    expect(() => deserialize(JSON.stringify({ ...raw, storageCap: 'lots' }), CONTENT)).toThrow(/storageCap/);
  });
});
