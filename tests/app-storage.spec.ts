/**
 * Verifies untrusted envelopes, engine validation, corrupt backups and write order.
 * Adapters deliberately fail to prove saves cannot silently overwrite recovery data.
 */
import { describe, expect, it, vi } from 'vitest';
import { createPersistence, BACKUP_KEY, SAVE_KEY } from '../src/app/storage';
import { createInitialState, manualCycle, serialize } from '../src/engine';
import { CONTENT } from '../src/content';
import { memoryStorage } from './app-helpers';
import { must } from './helpers';

describe('app save envelopes', () => {
  it('round trips the engine state and wall timestamp without changing GameState', async () => {
    const storage = memoryStorage();
    const saves = createPersistence(storage);
    expect((await saves.load()).savedAtMs).toBeNull();
    const game = must(manualCycle(createInitialState(CONTENT), CONTENT));
    await saves.save(game, 123456);
    expect(await saves.load()).toEqual({ game, savedAtMs: 123456, notice: null });
    expect(game).not.toHaveProperty('savedAtMs');
  });

  it.each([
    '{broken',
    JSON.stringify({ version: 1, game: '{}', savedAtMs: 1 }),
    JSON.stringify({ version: 1, game: serialize(createInitialState(CONTENT)), savedAtMs: -1 }),
    JSON.stringify({ version: 1, game: serialize(createInitialState(CONTENT)), savedAtMs: 1, extra: true }),
    JSON.stringify({ version: 99, game: serialize(createInitialState(CONTENT)), savedAtMs: 1 }),
    JSON.stringify({ version: 1, game: serialize({ ...createInitialState(CONTENT), tickAccumulatorSec: 1e100 }), savedAtMs: 1 }),
    'x'.repeat(2_100_001),
  ])('preserves invalid input under the backup key before starting fresh (%#)', async (raw) => {
    const storage = memoryStorage();
    storage.values.set(SAVE_KEY, raw);
    const recovered = await createPersistence(storage).load();
    expect(recovered.game).toEqual(createInitialState(CONTENT));
    expect(recovered.savedAtMs).toBeNull();
    expect(recovered.notice).toContain('backup was kept');
    expect(storage.values.get(BACKUP_KEY)).toBe(raw);
    expect(storage.values.get(SAVE_KEY)).toBe(raw);
  });

  it('does not replace the corrupt save if backup storage fails', async () => {
    const storage = memoryStorage();
    storage.values.set(SAVE_KEY, '{broken');
    storage.setItem.mockImplementation(() => { throw new Error('quota'); });
    await expect(createPersistence(storage).load()).rejects.toThrow('quota');
    expect(storage.values.get(SAVE_KEY)).toBe('{broken');
  });

  it('propagates read failures instead of treating an unread save as missing', async () => {
    const storage = memoryStorage();
    storage.getItem.mockImplementation(() => { throw new Error('denied'); });
    await expect(createPersistence(storage).load()).rejects.toThrow('denied');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('starts web writes synchronously, including a pagehide checkpoint', () => {
    const storage = memoryStorage();
    void createPersistence(storage).save(createInitialState(CONTENT), 100);
    expect(storage.values.get(SAVE_KEY)).toContain('"savedAtMs":100');
  });

  it('orders slow native writes and continues after an asynchronous failure', async () => {
    let rejectFirst: (error: Error) => void = () => undefined;
    const writes: string[] = [];
    const storage = {
      getItem: () => null,
      setItem: vi.fn((_key: string, text: string) => {
        writes.push(text);
        return writes.length === 1 ? new Promise<void>((_resolve, reject) => { rejectFirst = reject; }) : Promise.resolve();
      }),
    };
    const saves = createPersistence(storage);
    const first = saves.save(createInitialState(CONTENT), 100);
    const failure = expect(first).rejects.toThrow('disk');
    const second = saves.save(createInitialState(CONTENT), 200);
    expect(writes).toHaveLength(1);
    rejectFirst(new Error('disk'));
    await failure;
    await second;
    expect(writes.map((text) => JSON.parse(text).savedAtMs)).toEqual([100, 200]);
  });
});
