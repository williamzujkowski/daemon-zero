/** Shared presentation-only soundtrack session; game save replacement never owns it. */
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { getPlatform } from './platform';
import { gameStore } from './session';
import { MusicController } from './musicController';
import { onVoiceActivity } from './voicePlayer';

const platform = getPlatform();
export const music = new MusicController(gameStore, platform.lifecycle, platform.storage);
// The voice player and the soundtrack know nothing of each other; this is the one joint. It
// lasts for the process, like the controller it feeds, so a clip started before the terminal
// mounts still finds the score ducked.
onVoiceActivity((talking) => { music.setDucked(talking); });
export function useMusicRuntime(): void { useEffect(() => music.start(), []); }
export function useMusic() { return useStore(music.state); }
/**
 * Only the speech half of the preference, so a transmission widget re-renders when its own
 * switch or level moves and not on every soundtrack status change.
 */
export function useSpeechPreference() {
  return useStore(music.state, useShallow((state) => ({ enabled: state.speechEnabled, volume: state.speechVolume })));
}
