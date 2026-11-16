/**
 * Manual playback for the committed transmission clips. Nothing autoplays and nothing queues:
 * a nexus option vote on this arm twice put the manual contract first (3 of 4 selecting seats,
 * then 4 of 6), with a real dissent arguing to defer until a device can prove the audio plays
 * at all. Both runs returned `no_quorum` on artifact inspection, so this is the answering
 * seats' direction rather than a ratification, and the dissent is recorded in
 * docs/VOICE-CLIPS.md.
 *
 * The manual contract also removes the two hazards the autoplay option carried: a press is
 * already a user gesture, so the resume rule cannot swallow a clip, and a press means there is
 * never a second line talking over the first.
 */
import { createAudioPlayer } from 'expo-audio';
import { voiceSources } from './voiceSources';

let playing: { remove(): void } | null = null;

/** True when a clip was generated for this content id. Data-driven: no id is hard-coded here. */
export function hasVoiceClip(id: string): boolean {
  return id in voiceSources;
}

/** Stop the clip in flight, if any. Called before a new one starts and when audio is disabled. */
export function stopVoiceClip(): void {
  playing?.remove();
  playing = null;
}

/**
 * Play one clip and release it. Starting a clip stops whatever was playing, so a rapid second
 * press cannot leave two voices overlapping; a finished clip releases its own player.
 */
export function playVoiceClip(id: string, volume: number): void {
  const source = voiceSources[id];
  if (source === undefined) return;
  stopVoiceClip();
  const player = createAudioPlayer(source, { updateInterval: 250, allowsExternalPlayback: false });
  player.volume = Math.max(0, Math.min(100, volume)) / 100;
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    if (!status.didJustFinish) return;
    stopVoiceClip();
  });
  playing = { remove: () => { subscription.remove(); player.remove(); } };
  player.play();
}
