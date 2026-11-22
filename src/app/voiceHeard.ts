/**
 * Which voiced lines this install has already heard, so a message autoplays once and a reload never
 * replays it (#462). Presentation state, like the audio preference: its own validated slot, never part
 * of `GameState`, untouched by a wipe, an import or a new run.
 */
import { z } from 'zod';
import type { KeyValueStorage } from './storage';
import { createSaveQueue } from './saveQueue';

export const HEARD_KEY = 'daemon-zero.voice-heard.v1';
/** Content ids are lower snake case; anything else in the slot is not ours. */
const LineId = z.string().regex(/^[a-z0-9_]{1,64}$/);
// Bounds: far above the 63 voiced lines today, and small enough that a hostile slot costs nothing to read.
const MAX_LINES = 1024;
const MAX_CHARS = 72_000;
const Heard = z.strictObject({ version: z.literal(1), heard: z.array(LineId).max(MAX_LINES) });

/**
 * Stored state is untrusted input. An empty slot is a fresh install: nothing heard. Anything that is
 * not an exact version 1 value counts every known clip as heard, so a damaged slot means silence, the
 * same rule the audio preference follows; READ still plays every line on demand.
 */
export function parseHeard(raw: string | null, known: readonly string[]): Set<string> {
  if (raw === null) return new Set();
  if (raw.length > MAX_CHARS) return new Set(known);
  try {
    const parsed = Heard.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? new Set(parsed.data.heard) : new Set(known);
  } catch { return new Set(known); }
}

export function heardLines(storage: KeyValueStorage, known: readonly string[]) {
  const write = createSaveQueue((text) => storage.setItem(HEARD_KEY, text));
  return {
    async load(): Promise<Set<string>> { return parseHeard(await storage.getItem(HEARD_KEY), known); },
    /** Sorted, so the slot is the same text for the same set whatever order lines were heard in. */
    save(heard: ReadonlySet<string>): Promise<void> {
      return write(JSON.stringify({ version: 1, heard: [...heard].filter((id) => LineId.safeParse(id).success).sort().slice(0, MAX_LINES) }));
    },
  };
}
