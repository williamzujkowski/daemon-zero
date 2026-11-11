/**
 * Encodes app timestamps around engine saves and treats both layers as untrusted.
 * Invalid saves are backed up before replacement; writes use an ordered queue.
 */
import { z } from 'zod';
import { CONTENT } from '../content';
import type { ContentRegistry } from '../content/registry';
import { createInitialState, deserialize, SaveError, serialize, type GameState } from '../engine';
import { createSaveQueue } from './saveQueue';

export const SAVE_KEY = 'daemon-zero.save.v1';
export const BACKUP_KEY = 'daemon-zero.save.corrupt-backup';
const MAX_ENVELOPE_CHARS = 2_100_000;
const SnapshotSchema = z.strictObject({
  version: z.literal(1),
  savedAtMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  game: z.string().max(1_000_000),
});

export interface KeyValueStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, text: string): void | Promise<void>;
}

export interface LoadedSave {
  game: GameState;
  savedAtMs: number | null;
  notice: string | null;
}

function decode(text: string, content: ContentRegistry): LoadedSave {
  if (text.length > MAX_ENVELOPE_CHARS) throw new SaveError('Save envelope is too large.');
  let raw: unknown;
  try { raw = JSON.parse(text); }
  catch { throw new SaveError('Save envelope is not valid JSON.'); }
  const snapshot = SnapshotSchema.safeParse(raw);
  if (!snapshot.success) throw new SaveError('Save envelope failed validation.');
  const game = deserialize(snapshot.data.game, content);
  // App snapshots carry only a small live remainder; reject untrusted queued time before catch-up.
  if (game.tickAccumulatorSec > content.balance.liveCatchUpThresholdSec) {
    throw new SaveError('Save contains excessive pending live time.');
  }
  return {
    game,
    savedAtMs: snapshot.data.savedAtMs,
    notice: null,
  };
}

export function createPersistence(adapter: KeyValueStorage, content: ContentRegistry = CONTENT) {
  const write = createSaveQueue((text) => adapter.setItem(SAVE_KEY, text));
  return {
    async load(): Promise<LoadedSave> {
      const raw = await adapter.getItem(SAVE_KEY);
      if (raw === null) return { game: createInitialState(content), savedAtMs: null, notice: null };
      try { return decode(raw, content); }
      catch (error) {
        if (!(error instanceof SaveError)) throw error;
        // A failed backup must stop loading, rather than overwrite the only recoverable copy.
        await adapter.setItem(BACKUP_KEY, raw);
        return {
          game: createInitialState(content), savedAtMs: null,
          notice: 'The save was damaged. A backup was kept and a new run started.',
        };
      }
    },
    save(game: GameState, savedAtMs: number): Promise<void> {
      return write(JSON.stringify({ version: 1, savedAtMs, game: serialize(game) }));
    },
  };
}

export type Persistence = ReturnType<typeof createPersistence>;
