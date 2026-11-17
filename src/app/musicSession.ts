/** Shared presentation-only soundtrack session; game save replacement never owns it. */
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { getPlatform } from './platform';
import { gameStore } from './session';
import { MusicController } from './musicController';
import { onVoiceActivity } from './voicePlayer';
import { bindScoreSession, browserSessionHost } from './scoreSession';

const platform = getPlatform();
export const music = new MusicController(gameStore, platform.lifecycle, platform.storage);
// The voice player and the soundtrack know nothing of each other; this is the one joint. It
// lasts for the process, like the controller it feeds, so a clip started before the terminal
// mounts still finds the score ducked.
onVoiceActivity((talking) => { music.setDucked(talking); });
// The second joint: the platform's media session follows the controller and its play and pause
// come back through it. Process-long for the same reason, and absent where there is no such
// API (every native build, older browsers).
const sessionHost = browserSessionHost();
if (sessionHost) bindScoreSession(music, sessionHost);
export function useMusicRuntime(): void { useEffect(() => music.start(), []); }
export function useMusic() { return useStore(music.state); }
/**
 * Only the speech half of the preference, so a transmission widget re-renders when its own
 * switch or level moves and not on every soundtrack status change.
 */
export function useSpeechPreference() {
  return useStore(music.state, useShallow((state) => ({ enabled: state.speechEnabled, volume: state.speechVolume })));
}
