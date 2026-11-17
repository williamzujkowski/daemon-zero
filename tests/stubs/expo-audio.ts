/**
 * Test stand-in for expo-audio. The real module reads `__DEV__` and other Expo globals at import
 * time, which no spec defines, so any widget that can play a clip would fail to import. The
 * soundtrack boundary was already testable because only the app entry pulled it in; voice
 * playback is reachable from the transmission widgets, so the boundary is aliased here the same
 * way `react-native` is aliased to `react-native-web`.
 *
 * Specs that assert on the player (tests/app-audio-player.spec.ts, tests/app-voice-player.spec.ts,
 * tests/ui-speech.spec.ts) still override this with `vi.mock('expo-audio', ...)`.
 */
type Listener = (status: { playing: boolean; isBuffering: boolean; error: string | null; didJustFinish: boolean }) => void;

export interface StubPlayer {
  loop: boolean;
  volume: number;
  play(): void;
  pause(): void;
  remove(): void;
  release(): void;
  addListener(event: string, listener: Listener): { remove(): void };
}

export function createAudioPlayer(_source: unknown, _options?: unknown): StubPlayer {
  return { loop: false, volume: 1, play: () => undefined, pause: () => undefined,
    remove: () => undefined, release: () => undefined, addListener: () => ({ remove: () => undefined }) };
}

export async function setAudioModeAsync(_mode: unknown): Promise<void> { return Promise.resolve(); }
