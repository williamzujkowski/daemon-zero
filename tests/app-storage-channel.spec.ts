/**
 * T4 (#205), rerun after the release (#233, X.3): production keeps its original keys byte for byte and
 * never reads the keys the pre-release preview build wrote, and a preview save under the production key
 * is backed up with a notice that names its channel, not "damaged".
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUDIO_KEY } from '../src/app/audioPreferences';
import { BACKUP_KEY, createPersistence, SAVE_KEY } from '../src/app/storage';
import { CONTENT } from '../src/content';
import { createInitialState, manualCycle, serialize, type GameState } from '../src/engine';
import { memoryStorage } from './app-helpers';
import { must } from './helpers';

/** The keys the pre-release preview build used; nothing in src/ names them any more. */
const PREVIEW_SAVE = 'daemon-zero.preview.save.v1';
const PREVIEW_BACKUP = 'daemon-zero.preview.save.corrupt-backup';
/** A genuine preview codec output from the last main before the release, as its app envelope. */
const PREVIEW_ENVELOPE = JSON.stringify({ version: 1, savedAtMs: 5, game: readFileSync('tests/fixtures/preview-early-v14.json', 'utf8') });

/** A run played (one manual cycle), as an app envelope. */
function played(): { game: GameState; envelope: string } {
  const game = must(manualCycle(createInitialState(CONTENT), CONTENT));
  return { game, envelope: JSON.stringify({ version: 1, savedAtMs: 5, game: serialize(game) }) };
}

describe('production storage keys', () => {
  it('keeps the production keys byte for byte', () => {
    expect(SAVE_KEY).toBe('daemon-zero.save.v1');
    expect(BACKUP_KEY).toBe('daemon-zero.save.corrupt-backup');
    expect(AUDIO_KEY).toBe('daemon-zero.audio.v1');
  });

  it('writes a run only under the production key and reads it back', async () => {
    const storage = memoryStorage();
    const { game } = played();
    await createPersistence(storage).save(game, 7);
    expect([...storage.values.keys()]).toEqual([SAVE_KEY]);
    expect(await createPersistence(storage).load()).toEqual({ game, savedAtMs: 7, paused: false, notice: null });
  });

  it('boots fresh past a preview-key entry and leaves that entry alone', async () => {
    const storage = memoryStorage();
    storage.values.set(PREVIEW_SAVE, PREVIEW_ENVELOPE);
    const loaded = await createPersistence(storage).load();
    expect(loaded).toEqual({ game: createInitialState(CONTENT), savedAtMs: null, paused: false, notice: null });
    expect(storage.getItem).not.toHaveBeenCalledWith(PREVIEW_SAVE);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.values.get(PREVIEW_SAVE)).toBe(PREVIEW_ENVELOPE);
  });

  it('backs up a preview save found under the production key and names its channel', async () => {
    const storage = memoryStorage();
    storage.values.set(SAVE_KEY, PREVIEW_ENVELOPE);
    const loaded = await createPersistence(storage).load();
    expect(loaded.game).toEqual(createInitialState(CONTENT));
    expect(loaded.savedAtMs).toBeNull();
    expect(loaded.notice).toBe('The save here comes from a preview build and cannot be loaded by this one. A backup was kept and a new run started.');
    expect(loaded.notice).not.toContain('damaged');
    expect(storage.values.get(BACKUP_KEY)).toBe(PREVIEW_ENVELOPE);
    expect(storage.values.get(SAVE_KEY)).toBe(PREVIEW_ENVELOPE);
    expect(storage.values.has(PREVIEW_BACKUP)).toBe(false);
  });

  it('still calls a broken save damaged', async () => {
    const storage = memoryStorage();
    storage.values.set(SAVE_KEY, '{broken');
    const loaded = await createPersistence(storage).load();
    expect(loaded.notice).toBe('The save was damaged. A backup was kept and a new run started.');
    expect(storage.values.get(BACKUP_KEY)).toBe('{broken');
  });
});
