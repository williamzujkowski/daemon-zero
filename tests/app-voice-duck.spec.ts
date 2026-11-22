/**
 * The score stays ducked for as long as any voice clip talks, however the clips start and replace one
 * another (#462 follow-up, found in a live run): READ over a line that started by itself, a line that
 * starts by itself after READ, and a READ over a READ. The duck lets go only when no clip is talking.
 * Real voice player and real soundtrack controller, joined as the music session joins them; each clip
 * gets its own mock player, as expo-audio gives each `createAudioPlayer` call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Status = { playing?: boolean; didJustFinish?: boolean; error?: string | null; isBuffering?: boolean };
const voice = vi.hoisted(() => ({ clips: [] as { id: number; volume: number; removed: boolean; fire: (status: Status) => void }[] }));
vi.mock('expo-audio', () => ({
  setAudioModeAsync: () => Promise.resolve(),
  createAudioPlayer: () => {
    let listener: (status: Status) => void = () => undefined;
    const clip = { id: voice.clips.length, volume: 1, removed: false, fire: (status: Status) => { listener({ didJustFinish: false, ...status }); } };
    voice.clips.push(clip);
    return {
      get volume() { return clip.volume; }, set volume(value: number) { clip.volume = value; },
      play: () => undefined, pause: () => undefined,
      remove: () => { clip.removed = true; }, release: () => { clip.removed = true; },
      addListener: (_event: string, next: (status: Status) => void) => { listener = next; return { remove: () => { listener = () => undefined; } }; },
    };
  },
}));
import { DUCK_RAMP_MS, DUCK_RATIO, FADE_IN_MS } from '../src/app/musicController';
import { OUTPUT_SCALE } from '../src/app/outputLevel';
import { onVoiceActivity, playVoiceClip, stopVoiceClip, voiceSpeaking } from '../src/app/voicePlayer';
import { VoiceAutoplay } from '../src/app/voiceAutoplay';
import { harness, run } from './music-ramp-harness';

const FULL = 0.4 * OUTPUT_SCALE;
const DUCKED = FULL * DUCK_RATIO;

beforeEach(() => { vi.useFakeTimers(); voice.clips.length = 0; });
afterEach(() => { stopVoiceClip(); vi.useRealTimers(); });

/** A score at rest, joined to the voice player as `musicSession.ts` joins them, and an autoplay policy wired to the real player. */
async function rig() {
  const h = await harness(); run(FADE_IN_MS);
  const edges: boolean[] = [];
  const unjoin = onVoiceActivity((talking) => { edges.push(talking); h.controller.setDucked(talking); });
  const autoplay = new VoiceAutoplay({ hasClip: () => true, talking: () => voiceSpeaking.getState().id !== null,
    play: playVoiceClip, remember: () => undefined });
  const unpump = voiceSpeaking.subscribe((state) => { if (state.id === null) autoplay.pump(); });
  autoplay.load([]);
  autoplay.update({ speechEnabled: true, speechVolume: 30, running: true, foreground: true, overlays: 0, unlocked: true });
  const score = () => { run(DUCK_RAMP_MS); return h.at(0).levels.at(-1); };
  const newest = () => voice.clips.at(-1);
  return { h, autoplay, score, newest, edges, done: () => { unjoin(); unpump(); h.stop(); } };
}

describe('the score stays ducked while any clip talks', () => {
  it('READ over a line that started by itself', async () => {
    const r = await rig();
    r.autoplay.show('office_01');
    r.newest()?.fire({ playing: true });
    expect(r.score()).toBe(DUCKED);
    const autoplayed = r.newest();
    playVoiceClip('office_01', 30);
    expect(autoplayed?.removed, 'the autoplayed clip was replaced').toBe(true);
    r.newest()?.fire({ playing: true });
    // The replaced clip's late statuses must not hand the score back either.
    autoplayed?.fire({ playing: false, didJustFinish: true });
    expect(r.score(), 'still ducked under the READ clip').toBe(DUCKED);
    expect(r.edges, 'the replacement reported no silence').toEqual([true]);
    r.newest()?.fire({ didJustFinish: true });
    expect(r.score(), 'released once nothing talks').toBe(FULL);
    expect(r.edges).toEqual([true, false]);
    r.done();
  });

  it('a line that starts by itself after READ, with no gap the score could rise into', async () => {
    const r = await rig();
    playVoiceClip('ambient_01', 30);
    r.newest()?.fire({ playing: true });
    expect(r.score()).toBe(DUCKED);
    r.autoplay.show('office_02');
    expect(voice.clips, 'the new line waits for silence').toHaveLength(1);
    const levels = r.h.at(0).levels;
    const from = levels.length;
    r.newest()?.fire({ didJustFinish: true });
    expect(voice.clips, 'it starts the moment the READ clip ends').toHaveLength(2);
    r.newest()?.fire({ playing: true });
    expect(r.score()).toBe(DUCKED);
    // One duck for both clips: the hand-over reports no silence, so the score never moves.
    expect(r.edges).toEqual([true]);
    expect(levels.slice(from).every((level) => level === DUCKED), 'the score never rose between the two clips').toBe(true);
    r.newest()?.fire({ didJustFinish: true });
    expect(r.score()).toBe(FULL);
    expect(r.edges).toEqual([true, false]);
    r.done();
  });

  it('READ over READ, and a failed replacement, each keep or release the duck by what is talking', async () => {
    const r = await rig();
    playVoiceClip('ambient_01', 30); r.newest()?.fire({ playing: true });
    playVoiceClip('ambient_02', 30); r.newest()?.fire({ playing: true });
    expect(r.score()).toBe(DUCKED);
    // The replacement fails to load: nothing is talking, so the score comes back.
    r.newest()?.fire({ error: 'Playback error (code 4)' });
    expect(r.score()).toBe(FULL);
    r.done();
  });
});
