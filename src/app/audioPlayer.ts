/** SDK-compatible local music playback. Recording and background playback remain disabled. */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import source from '../../assets/audio/music/phase-0/awareness-loop.mp3';
import type { MusicPlayer } from './musicController';

export async function prepareMusic(): Promise<void> {
  await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false,
    shouldPlayInBackground: false, playsInSilentMode: false, interruptionMode: 'mixWithOthers',
    shouldRouteThroughEarpiece: false });
}

export function createMusicPlayer(changed: (playing: boolean, error: boolean) => void): MusicPlayer {
  // Metro packages this literal import under each export's asset base path.
  const player = createAudioPlayer(source, { updateInterval: 500, allowsExternalPlayback: false });
  player.loop = true;
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    changed(status.playing && !status.isBuffering, Boolean(status.error));
  });
  return { play: () => { player.play(); }, pause: () => { player.pause(); },
    volume: (value) => { player.volume = value; },
    remove: () => { subscription.remove(); player.remove(); } };
}
