/** Validates presentation preferences independently of every game save and import. */
import { z } from 'zod';
import type { KeyValueStorage } from './storage';
import { createSaveQueue } from './saveQueue';

// The slot keeps its original name: the `version` field inside the value is what migrates,
// the same way the save slot keeps `save.v1` across game schema versions. One slot means a
// migration can never leave two stored preferences disagreeing.
export const AUDIO_KEY = 'daemon-zero.audio.v1';
const level = z.number().int().min(0).max(100);
const AudioPreferencesV1 = z.strictObject({ version: z.literal(1), enabled: z.boolean(), volume: level });
/**
 * `enabled` and `volume` are the soundtrack's; speech has its own pair. A nexus option vote
 * split them (`split-speech-controls`, 7 of 7 seats, record `vote-1794810900116-du48mwo`):
 * one switch used to gate both, so muting the score also took the transmissions away.
 */
const AudioPreferences = z.strictObject({ version: z.literal(2), enabled: z.boolean(), volume: level,
  speechEnabled: z.boolean(), speechVolume: level });
export type AudioPreferences = z.infer<typeof AudioPreferences>;
/**
 * A fresh install starts with the soundtrack on: the board chose default-on with a
 * first-gesture resume and a header toggle at 400 and wider (3 of 5 selecting seats,
 * `default-on-gesture-resume-header-toggle-wide-only`). A stored choice always wins,
 * and unreadable storage still falls back to silence rather than surprising anyone.
 * Speech follows the same two rules: on for a fresh install (it is manual, so "on" only
 * means the READ control is offered), off with everything else when storage is unreadable.
 */
export const defaultPreferences: AudioPreferences = { version: 2, enabled: true, volume: 30, speechEnabled: true, speechVolume: 30 };
export const silentPreferences: AudioPreferences = { version: 2, enabled: false, volume: 30, speechEnabled: false, speechVolume: 30 };

/**
 * Stored preferences are untrusted input: only an exact v2 or an exact v1 is accepted, and
 * anything else is silence. A v1 value gated speech with the music switch and played it at
 * the music volume, so speech inherits both and nobody's audible behaviour changes on upgrade.
 */
export function parseAudioPreferences(value: unknown): AudioPreferences {
  const current = AudioPreferences.safeParse(value);
  if (current.success) return current.data;
  const legacy = AudioPreferencesV1.safeParse(value);
  if (!legacy.success) return { ...silentPreferences };
  const { enabled, volume } = legacy.data;
  return { version: 2, enabled, volume, speechEnabled: enabled, speechVolume: volume };
}

export function audioPreferences(storage: KeyValueStorage) {
  const write = createSaveQueue((text) => storage.setItem(AUDIO_KEY, text));
  return {
    async load(): Promise<AudioPreferences> {
      const raw = await storage.getItem(AUDIO_KEY);
      if (raw === null) return { ...defaultPreferences };
      if (raw.length > 256) return { ...silentPreferences };
      try { return parseAudioPreferences(JSON.parse(raw) as unknown); } catch { return { ...silentPreferences }; }
    },
    save(value: AudioPreferences) { return write(JSON.stringify(AudioPreferences.parse(value))); },
  };
}
