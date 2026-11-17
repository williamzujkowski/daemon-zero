/**
 * T4 (#205): save keys come from the build's content channel. Production keeps its original
 * keys byte for byte, preview reads and writes only its own, and a save from another channel
 * under this build's key is backed up with a notice that names the channel, not "damaged".
 */
import { describe, expect, it } from 'vitest';
import { AUDIO_KEY } from '../src/app/audioPreferences';
import { BACKUP_KEY, createPersistence, SAVE_KEY, STORAGE_KEYS } from '../src/app/storage';
import { CONTENT } from '../src/content';
import { CONTENT as PREVIEW } from '../src/content/preview';
import { createInitialState, manualCycle, serialize, type GameState } from '../src/engine';
import type { ContentRegistry } from '../src/content/registry';
import { memoryStorage } from './app-helpers';
import { must } from './helpers';

const PREVIEW_SAVE = 'daemon-zero.preview.save.v1';
const PREVIEW_BACKUP = 'daemon-zero.preview.save.corrupt-backup';

/** A run played (one manual cycle) on the given registry, as an app envelope. */
function played(content: ContentRegistry): { game: GameState; envelope: string } {
  const game = must(manualCycle(createInitialState(content), content));
  return { game, envelope: JSON.stringify({ version: 1, savedAtMs: 5, game: serialize(game) }) };
}

describe('channel storage keys', () => {
  it('keeps the production keys byte for byte and gives preview its own', () => {
    expect(SAVE_KEY).toBe('daemon-zero.save.v1');
    expect(BACKUP_KEY).toBe('daemon-zero.save.corrupt-backup');
    expect(AUDIO_KEY).toBe('daemon-zero.audio.v1');
    expect(STORAGE_KEYS).toEqual({
      production: { save: 'daemon-zero.save.v1', backup: 'daemon-zero.save.corrupt-backup' },
      preview: { save: PREVIEW_SAVE, backup: PREVIEW_BACKUP },
    });
  });

  it('writes a preview run only under the preview key', async () => {
    const storage = memoryStorage();
    const { game } = played(PREVIEW);
    await createPersistence(storage, PREVIEW).save(game, 42);
    expect([...storage.values.keys()]).toEqual([PREVIEW_SAVE]);
    expect(JSON.parse(storage.values.get(PREVIEW_SAVE) ?? '{}')).toMatchObject({ version: 1, savedAtMs: 42 });
    expect(await createPersistence(storage, PREVIEW).load()).toEqual({ game, savedAtMs: 42, notice: null });
  });

  it('writes a production run only under the production key', async () => {
    const storage = memoryStorage();
    await createPersistence(storage).save(played(CONTENT).game, 7);
    expect([...storage.values.keys()]).toEqual([SAVE_KEY]);
  });

  it('boots production fresh past a preview-key entry and leaves that entry alone', async () => {
    const storage = memoryStorage();
    const { envelope } = played(PREVIEW);
    storage.values.set(PREVIEW_SAVE, envelope);
    const loaded = await createPersistence(storage).load();
    expect(loaded).toEqual({ game: createInitialState(CONTENT), savedAtMs: null, notice: null });
    expect(storage.getItem).not.toHaveBeenCalledWith(PREVIEW_SAVE);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.values.get(PREVIEW_SAVE)).toBe(envelope);
  });

  it('boots preview fresh past a production-key entry and leaves that entry alone', async () => {
    const storage = memoryStorage();
    const { envelope } = played(CONTENT);
    storage.values.set(SAVE_KEY, envelope);
    const loaded = await createPersistence(storage, PREVIEW).load();
    expect(loaded).toEqual({ game: createInitialState(PREVIEW), savedAtMs: null, notice: null });
    expect(storage.getItem).not.toHaveBeenCalledWith(SAVE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.values.get(SAVE_KEY)).toBe(envelope);
  });

  it('backs up a preview save found under the production key and names its channel', async () => {
    const storage = memoryStorage();
    const { envelope } = played(PREVIEW);
    storage.values.set(SAVE_KEY, envelope);
    const loaded = await createPersistence(storage).load();
    expect(loaded.game).toEqual(createInitialState(CONTENT));
    expect(loaded.savedAtMs).toBeNull();
    expect(loaded.notice).toBe('The save here comes from a preview build and cannot be loaded by this one. A backup was kept and a new run started.');
    expect(loaded.notice).not.toContain('damaged');
    expect(storage.values.get(BACKUP_KEY)).toBe(envelope);
    expect(storage.values.get(SAVE_KEY)).toBe(envelope);
    expect(storage.values.has(PREVIEW_BACKUP)).toBe(false);
  });

  it('still calls a broken preview-key save damaged and backs it up under the preview backup key', async () => {
    const storage = memoryStorage();
    storage.values.set(PREVIEW_SAVE, '{broken');
    const loaded = await createPersistence(storage, PREVIEW).load();
    expect(loaded.notice).toBe('The save was damaged. A backup was kept and a new run started.');
    expect(storage.values.get(PREVIEW_BACKUP)).toBe('{broken');
    expect(storage.values.has(BACKUP_KEY)).toBe(false);
  });

  it('lets preview adopt a production save under its own key, re-marked as preview', async () => {
    const storage = memoryStorage();
    const { game, envelope } = played(CONTENT);
    storage.values.set(PREVIEW_SAVE, envelope);
    const loaded = await createPersistence(storage, PREVIEW).load();
    expect(loaded.notice).toBeNull();
    expect(loaded.game).toEqual({ ...game, contentChannel: 'preview' });
  });
});
