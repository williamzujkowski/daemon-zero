/**
 * Joins the voice autoplay policy to the app: the game's run state, the speech preference, the
 * platform lifecycle, open modals, the clip in flight, the first gesture and the stored heard set.
 * Process-long, like the soundtrack session it sits beside, so a remounted terminal keeps its queue.
 */
import { useEffect } from 'react';
import type { AppState } from './store';
import type { Lifecycle } from './platform';
import { getPlatform } from './platform';
import { gameStore } from './session';
import { music } from './musicSession';
import { attachMusicGestureResume, type GestureDocument } from './musicGesture';
import { overlayPresence } from './overlayPresence';
import { hasVoiceClip, playVoiceClip, voiceSpeaking } from './voicePlayer';
import { voiceSources } from './voiceSources';
import { VoiceAutoplay } from './voiceAutoplay';
import { heardLines } from './voiceHeard';

interface Readable<T> { getState(): T; subscribe(listener: (state: T) => void): () => void }

export interface VoiceSources {
  game: Readable<Pick<AppState, 'ready' | 'paused'> & { game: { ending: unknown } }>;
  speech: Readable<{ speechEnabled: boolean; speechVolume: number }>;
  lifecycle: Lifecycle;
  overlays: Readable<{ open: number }>;
  speaking: Readable<{ id: string | null }>;
}

/** Feed every condition the policy waits on, now and on each change. Returns the teardown. */
export function bindVoiceAutoplay(autoplay: VoiceAutoplay, sources: VoiceSources): () => void {
  const read = () => {
    const { ready, paused, game } = sources.game.getState();
    const { speechEnabled, speechVolume } = sources.speech.getState();
    autoplay.update({ running: ready && !paused && game.ending === null, speechEnabled, speechVolume,
      foreground: sources.lifecycle.current(), overlays: sources.overlays.getState().open });
  };
  read();
  const subscriptions = [sources.game.subscribe(read), sources.speech.subscribe(read), sources.overlays.subscribe(read),
    sources.lifecycle.subscribe((foreground) => { autoplay.update({ foreground }); }),
    // The next queued line starts only into silence, so the end of any clip is a chance to start it.
    sources.speaking.subscribe((state) => { if (state.id === null) autoplay.pump(); })];
  return () => { for (const unsubscribe of subscriptions) unsubscribe(); };
}

/** The first gesture opens the gate for good; the listeners go with it. */
export function armVoiceUnlock(autoplay: VoiceAutoplay, doc: GestureDocument): () => void {
  const detach = attachMusicGestureResume(() => { detach(); autoplay.update({ unlocked: true }); }, doc);
  return detach;
}

const platform = getPlatform();
const known = Object.keys(voiceSources);
const heard = heardLines(platform.storage, known);
export const voiceAutoplay = new VoiceAutoplay({
  hasClip: hasVoiceClip,
  talking: () => voiceSpeaking.getState().id !== null,
  play: playVoiceClip,
  // A failed write keeps the line heard for this session; the next session may hear it once more.
  remember: (lines) => { void heard.save(lines).catch(() => undefined); },
});
let started = false;
/**
 * Bind and read the heard set once per process, on the first mount rather than at import: reading the
 * lifecycle touches the document, which a module import must not. Unreadable storage counts every line
 * heard (silence). Until this runs the gate is closed, so a line shown earlier simply waits.
 */
function startOnce(): void {
  if (started) return;
  started = true;
  bindVoiceAutoplay(voiceAutoplay, { game: gameStore.store, speech: music.state, lifecycle: platform.lifecycle,
    overlays: overlayPresence, speaking: voiceSpeaking });
  void heard.load().then((lines) => { voiceAutoplay.load(lines); }, () => { voiceAutoplay.load(known); });
}

/** Mounted by the terminal root with the same gesture source as the soundtrack's first-input resume. */
export function useVoiceAutoplay(gestures?: () => GestureDocument | undefined): void {
  useEffect(() => {
    startOnce();
    const doc = gestures?.();
    return doc ? armVoiceUnlock(voiceAutoplay, doc) : undefined;
  }, [gestures]);
}
