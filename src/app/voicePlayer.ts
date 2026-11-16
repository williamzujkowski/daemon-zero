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
 *
 * It shares the app's single audio session with the soundtrack (`ensureAudioMode`) rather than
 * assuming the soundtrack configured it: music is optional, and a player who muted it must still
 * get working transmissions.
 *
 * It also reports when a clip is talking (`onVoiceActivity`) so the soundtrack can duck under
 * it. The signal points outward only: this module does not import the music controller, and
 * the two are joined in `musicSession.ts`.
 */
import { createAudioPlayer } from 'expo-audio';
import { ensureAudioMode } from './audioPlayer';
import { voiceSources } from './voiceSources';

interface LiveClip {
  id: string;
  player: { volume: number };
  remove(): void;
}

let playing: LiveClip | null = null;
let listener: ((talking: boolean) => void) | null = null;
let announced = false;

/** Report edges only, so a listener never hears the same state twice. */
function announce(): void {
  const talking = playing !== null;
  if (talking === announced) return;
  announced = talking;
  listener?.(talking);
}

function release(): void {
  playing?.remove();
  playing = null;
}

/**
 * Hear when a clip starts talking and when the last one stops. One listener, because there is
 * one soundtrack; a second subscription replaces the first. A late subscriber is told at once
 * if a clip is already in flight. Returns the unsubscribe.
 */
export function onVoiceActivity(next: (talking: boolean) => void): () => void {
  listener = next;
  if (announced) next(true);
  return () => { if (listener === next) listener = null; };
}

function level(volume: number): number {
  return Math.max(0, Math.min(100, volume)) / 100;
}

/** True when a clip was generated for this content id. Data-driven: no id is hard-coded here. */
export function hasVoiceClip(id: string): boolean {
  // Own keys only: `in` would also answer yes for inherited names such as `constructor`.
  return Object.hasOwn(voiceSources, id);
}

/**
 * Stop the clip in flight, if any. With an id, stop it only when it is that line's clip: two
 * widgets share this one player, and a widget whose own line changed must not silence a clip
 * the other one started.
 */
export function stopVoiceClip(id?: string): void {
  if (playing === null || (id !== undefined && playing.id !== id)) return;
  release();
  announce();
}

/** Follow the preference while a clip is talking, not only at the moment it starts. */
export function setVoiceVolume(volume: number): void {
  if (playing === null) return;
  playing.player.volume = level(volume);
}

/**
 * Play one clip and release it. Starting a clip stops whatever was playing, so a rapid second
 * press cannot leave two voices overlapping; a finished clip releases its own player.
 */
export function playVoiceClip(id: string, volume: number): void {
  const source = hasVoiceClip(id) ? voiceSources[id] : undefined;
  if (source === undefined) return;
  // Released without announcing: a replacement is one unbroken stretch of speech, and reporting
  // the gap would bounce the soundtrack up and straight back down.
  release();
  try {
    // The session is shared with the soundtrack but prepared by neither on the other's behalf.
    void ensureAudioMode().catch(() => undefined);
    const player = createAudioPlayer(source, { updateInterval: 250, allowsExternalPlayback: false });
    player.volume = level(volume);
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish) return;
      stopVoiceClip(id);
    });
    playing = { id, player, remove: () => { subscription.remove(); player.remove(); } };
    player.play();
  } finally {
    // Also the failure path: if the replacement could not be created, nothing is talking, and
    // the soundtrack must not stay ducked under silence.
    announce();
  }
}
