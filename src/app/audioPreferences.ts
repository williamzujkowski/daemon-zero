/** Validates presentation preferences independently of every game save and import. */
import { z } from 'zod';
import type { KeyValueStorage } from './storage';
import { createSaveQueue } from './saveQueue';

export const AUDIO_KEY = 'daemon-zero.audio.v1';
const AudioPreferences = z.strictObject({ version: z.literal(1), enabled: z.boolean(), volume: z.number().int().min(0).max(100) });
export type AudioPreferences = z.infer<typeof AudioPreferences>;
export const silentPreferences: AudioPreferences = { version: 1, enabled: false, volume: 30 };

export function audioPreferences(storage: KeyValueStorage) {
  const write = createSaveQueue((text) => storage.setItem(AUDIO_KEY, text));
  return {
    async load(): Promise<AudioPreferences> {
      const raw = await storage.getItem(AUDIO_KEY);
      if (raw === null || raw.length > 256) return { ...silentPreferences };
      try {
        const parsed = AudioPreferences.safeParse(JSON.parse(raw) as unknown);
        return parsed.success ? parsed.data : { ...silentPreferences };
      } catch { return { ...silentPreferences }; }
    },
    save(value: AudioPreferences) { return write(JSON.stringify(AudioPreferences.parse(value))); },
  };
}
