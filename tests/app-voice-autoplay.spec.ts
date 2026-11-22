/**
 * The autoplay rule for voiced feed lines (#462): a line plays once, the first time the feed shows it,
 * only when every condition holds, one at a time, and never again on its own, not after rotation and
 * not after a reload. Driven through the policy's public seam with a recording player.
 */
import { describe, expect, it } from 'vitest';
import { VoiceAutoplay, type AutoplayGate } from '../src/app/voiceAutoplay';

const OPEN: AutoplayGate = { speechEnabled: true, speechVolume: 30, running: true, foreground: true, overlays: 0, unlocked: true };

/** A player that records what it was asked to play and lets the test say when a clip is heard and ends. */
function rig(clips = ['line_a', 'line_b', 'line_c']) {
  const played: { id: string; volume: number }[] = [];
  const saved: string[][] = [];
  let talking: { id: string; started: () => void } | null = null;
  const autoplay = new VoiceAutoplay({
    hasClip: (id) => clips.includes(id),
    talking: () => talking !== null,
    play: (id, volume, started) => { played.push({ id, volume }); talking = { id, started }; },
    remember: (heard) => { saved.push([...heard].sort()); },
  });
  return {
    autoplay, played, saved,
    /** The clip in flight reports that it is playing: the moment it counts as heard. */
    heard: () => { talking?.started(); },
    /** The clip in flight ends (finished, stopped or failed); the session then pumps the queue. */
    end: () => { talking = null; autoplay.pump(); },
    ids: () => played.map((entry) => entry.id),
  };
}

describe('voice autoplay', () => {
  it('plays a line once, the first time it is shown, at the speech volume', () => {
    const test = rig();
    test.autoplay.load([]);
    test.autoplay.update(OPEN);
    test.autoplay.show('line_a');
    expect(test.played).toEqual([{ id: 'line_a', volume: 30 }]);
    test.heard(); test.end();
    // The rotation takes it away and brings it back: nothing replays.
    test.autoplay.hide('line_a');
    test.autoplay.show('line_a');
    expect(test.ids()).toEqual(['line_a']);
    expect(test.autoplay.hasHeard('line_a')).toBe(true);
  });

  it('never plays a line that has no clip', () => {
    const test = rig();
    test.autoplay.load([]);
    test.autoplay.update(OPEN);
    test.autoplay.show('harness_01');
    expect(test.played).toEqual([]);
    expect(test.autoplay.pending()).toEqual([]);
  });

  it('does not replay after a reload: the stored heard set is honoured', () => {
    const first = rig();
    first.autoplay.load([]); first.autoplay.update(OPEN);
    first.autoplay.show('line_a'); first.heard();
    const stored = first.saved.at(-1) ?? [];
    expect(stored).toEqual(['line_a']);
    // A new process: the same line shown again after the stored set loads.
    const second = rig();
    second.autoplay.update(OPEN);
    second.autoplay.show('line_a');
    expect(second.played, 'nothing plays before the heard set has loaded').toEqual([]);
    second.autoplay.load(stored);
    expect(second.played).toEqual([]);
    expect(second.autoplay.pending()).toEqual([]);
  });

  it('a line shown before the heard set loads plays once it loads, if it was never heard', () => {
    const test = rig();
    test.autoplay.update(OPEN);
    test.autoplay.show('line_b');
    expect(test.played).toEqual([]);
    test.autoplay.load(['line_a']);
    expect(test.ids()).toEqual(['line_b']);
  });

  it('counts a line heard only when it was heard: a clip the browser refuses stays unheard and is tried on its next showing', () => {
    const test = rig();
    test.autoplay.load([]); test.autoplay.update(OPEN);
    test.autoplay.show('line_a');
    test.end(); // refused: ended without ever reporting playing
    expect(test.autoplay.hasHeard('line_a')).toBe(false);
    expect(test.saved).toEqual([]);
    expect(test.ids(), 'no retry loop while it stays on screen').toEqual(['line_a']);
    test.autoplay.hide('line_a'); test.autoplay.show('line_a');
    expect(test.ids()).toEqual(['line_a', 'line_a']);
  });

  it('queues newly shown lines and plays them one at a time, each into silence', () => {
    const test = rig();
    test.autoplay.load([]); test.autoplay.update(OPEN);
    test.autoplay.show('line_a'); test.autoplay.show('line_b'); test.autoplay.show('line_c');
    expect(test.ids()).toEqual(['line_a']);
    expect(test.autoplay.pending()).toEqual(['line_b', 'line_c']);
    test.heard(); test.end();
    expect(test.ids()).toEqual(['line_a', 'line_b']);
    test.heard(); test.end();
    test.heard(); test.end();
    expect(test.ids()).toEqual(['line_a', 'line_b', 'line_c']);
    expect(test.saved.at(-1)).toEqual(['line_a', 'line_b', 'line_c']);
  });

  it('drops a queued line that leaves the screen before it could play, unheard, so its voice never outlives its text', () => {
    const test = rig();
    test.autoplay.load([]); test.autoplay.update(OPEN);
    test.autoplay.show('line_a'); test.autoplay.show('line_b');
    test.autoplay.hide('line_b');
    test.heard(); test.end();
    expect(test.ids()).toEqual(['line_a']);
    expect(test.autoplay.hasHeard('line_b')).toBe(false);
  });

  it('keeps a line queued while a second surface still shows it', () => {
    const test = rig();
    test.autoplay.load([]); test.autoplay.update({ ...OPEN, overlays: 1 });
    test.autoplay.show('line_a'); test.autoplay.show('line_a');
    test.autoplay.hide('line_a');
    expect(test.autoplay.pending()).toEqual(['line_a']);
    test.autoplay.update({ overlays: 0 });
    expect(test.ids()).toEqual(['line_a']);
  });

  it.each([
    ['speech is off', { speechEnabled: false }],
    ['speech volume is zero', { speechVolume: 0 }],
    ['the game is paused or not running', { running: false }],
    ['the app is in the background', { foreground: false }],
    ['a dilemma or another modal is open', { overlays: 1 }],
    ['the player has not touched the game yet', { unlocked: false }],
  ] as const)('waits while %s, then plays the line still on screen', (_name, closed) => {
    const test = rig();
    test.autoplay.load([]);
    test.autoplay.update({ ...OPEN, ...closed });
    test.autoplay.show('line_a');
    expect(test.played).toEqual([]);
    expect(test.autoplay.pending()).toEqual(['line_a']);
    test.autoplay.update(OPEN);
    expect(test.ids()).toEqual(['line_a']);
  });

  it('never cuts off a clip already talking, read or autoplayed: the next line waits for silence', () => {
    const test = rig();
    test.autoplay.load([]); test.autoplay.update(OPEN);
    test.autoplay.show('line_a');
    test.autoplay.update({ speechVolume: 40 });
    test.autoplay.show('line_b');
    expect(test.ids()).toEqual(['line_a']);
    test.end();
    expect(test.played.at(-1)).toEqual({ id: 'line_b', volume: 40 });
  });

  it('a line the player reads is heard and leaves the queue; reading it again stores nothing new', () => {
    const test = rig();
    test.autoplay.load([]); test.autoplay.update({ ...OPEN, unlocked: false });
    test.autoplay.show('line_a');
    test.autoplay.markHeard('line_a');
    expect(test.autoplay.pending()).toEqual([]);
    expect(test.saved).toEqual([['line_a']]);
    test.autoplay.markHeard('line_a');
    expect(test.saved).toHaveLength(1);
    test.autoplay.update(OPEN);
    expect(test.played).toEqual([]);
  });

  it('holds a READ made before the load in memory, and writes the union once the load lands', () => {
    const test = rig();
    test.autoplay.markHeard('line_c');
    expect(test.saved, 'no write that could replace the stored set').toEqual([]);
    test.autoplay.load(['line_a']);
    expect(test.saved).toEqual([['line_a', 'line_c']]);
    // A line read early that storage already held changes nothing, so nothing is written.
    const again = rig();
    again.autoplay.markHeard('line_a');
    again.autoplay.load(['line_a', 'line_b']);
    expect(again.saved).toEqual([]);
  });

  it('a player that throws leaves the line unheard and the queue moving', () => {
    const played: string[] = [];
    const autoplay = new VoiceAutoplay({ hasClip: () => true, talking: () => false, remember: () => undefined,
      play: (id) => { played.push(id); if (id === 'line_a') throw new Error('no media'); } });
    autoplay.load([]); autoplay.update(OPEN);
    autoplay.show('line_a'); autoplay.show('line_b');
    expect(played).toEqual(['line_a', 'line_b']);
    expect(autoplay.hasHeard('line_a')).toBe(false);
  });
});
