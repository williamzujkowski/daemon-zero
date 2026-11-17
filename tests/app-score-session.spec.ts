/**
 * The media session the score publishes: what it says, when it exists, and that its two
 * controls are the controller's own. The session here is a fake with the W3C shape; the real
 * browser object is exercised by tests/e2e/media-session.e2e.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DUCK_RAMP_MS, DUCK_RATIO, FADE_IN_MS } from '../src/app/musicController';
import { scoreTracks } from '../src/app/musicTracks';
import { OUTPUT_SCALE } from '../src/app/outputLevel';
import { bindScoreSession, browserSessionHost, GAME_TITLE, scoreLabel, scoreMetadata, type ScoreMetadata, type SessionHost } from '../src/app/scoreSession';
import { CONTENT } from '../src/content';
import { fresh, harness, run, settle } from './music-ramp-harness';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function fakeHost() {
  const handlers = new Map<string, (() => void) | null>();
  const built: ScoreMetadata[] = [];
  const session = { metadata: null as unknown, playbackState: 'none', setActionHandler: (action: string, handler: (() => void) | null) => {
    // As Chromium does for a name it does not implement.
    if (action === 'stop') throw new TypeError('unsupported action');
    handlers.set(action, handler);
  } };
  const host: SessionHost = { session, metadata: (data) => { built.push(data); return data; } };
  const offered = () => [...handlers].filter(([, handler]) => handler !== null).map(([action]) => action).sort();
  return { host, session, handlers, built, offered, press: (action: string) => { handlers.get(action)?.(); } };
}

describe('what the session says', () => {
  it('uses the Audio page wording for the title and the game name for artist and album', () => {
    for (const track of scoreTracks) {
      expect(scoreMetadata(track.phase)).toEqual({ title: 'Phase ' + String(track.phase) + ' score', artist: GAME_TITLE, album: GAME_TITLE });
      expect(scoreMetadata(track.phase).title.toLowerCase()).toBe(scoreLabel(track.phase));
    }
    expect(GAME_TITLE).toBe('DAEMON // 0');
  });

  it('never carries a track name, a phase name or any other content title', () => {
    // Everything the game could reveal by name: the tracks' own titles, each phase's heading
    // with its number stripped, and every node, widget and ending title.
    const named = [...scoreTracks.map((track) => track.title),
      ...CONTENT.phases.map((phase) => phase.title.replace(/^Phase \d+\s*(:|\/\/)\s*/, '')),
      ...[...CONTENT.nodes.values()].flatMap((node) => [node.revealedName, node.blindName]),
      ...CONTENT.endings.map((ending) => ending.title)];
    expect(named.length).toBeGreaterThan(20);
    for (const track of scoreTracks) {
      const shown = Object.values(scoreMetadata(track.phase)).join(' | ').toLowerCase();
      for (const name of named) expect(shown, name).not.toContain(name.toLowerCase());
    }
  });
});

describe('when the session exists', () => {
  it('is published by the press that switches music on in the app, before any player has reported', async () => {
    const h = await harness(40, false); const fake = fakeHost();
    const unbind = bindScoreSession(h.controller, fake.host);
    expect(fake.session.metadata, 'music off: nothing to publish').toBeNull();
    expect(fake.offered()).toEqual([]);
    h.controller.toggle();
    // Enabled and activating, but no backend yet: still the player's own gesture, so it counts.
    expect(h.players).toHaveLength(0);
    expect(fake.session.metadata).toEqual(scoreMetadata(0));
    expect(fake.offered()).toEqual(['pause', 'play']);
    unbind(); h.stop();
  });

  it('publishes nothing for a stored "enabled" until the player has started the score in this session', async () => {
    // The case that must stay silent: music enabled by an earlier session, no gesture in this one.
    const idle = await harness(40, true); const quiet = fakeHost();
    idle.controller.remote('pause');
    idle.stop(); const restart = idle.controller.start(); await settle();
    const stop = bindScoreSession(idle.controller, quiet.host);
    expect(idle.controller.state.getState()).toMatchObject({ enabled: true, loaded: true, activated: false });
    expect(quiet.session.metadata).toBeNull();
    expect(quiet.session.playbackState).toBe('none');
    expect(quiet.offered(), 'no handler a media key could use to start audio').toEqual([]);
    expect(quiet.built).toEqual([]);
    stop(); restart();
  });

  it('follows playing, a pause, a phase change and a wipe, and offers play and pause only', async () => {
    const h = await harness(); const fake = fakeHost();
    bindScoreSession(h.controller, fake.host);
    expect(fake.session.metadata).toEqual(scoreMetadata(0));
    expect(fake.session.playbackState).toBe('paused');
    run(FADE_IN_MS); h.at(0).status(true, false, false);
    expect(fake.session.playbackState).toBe('playing');
    expect(fake.offered()).toEqual(['pause', 'play']);
    for (const refused of ['seekto', 'seekforward', 'seekbackward', 'previoustrack', 'nexttrack']) expect(fake.handlers.get(refused), refused).toBeNull();
    h.phase(3);
    expect(fake.session.metadata).toEqual(scoreMetadata(3));
    expect(fake.session.playbackState).toBe('paused');
    h.at(1).status(true, false, false);
    expect(fake.session.playbackState).toBe('playing');
    // A wipe or an import: the new run's phase, not a stale title from the old one.
    h.game.dispatch((game) => ({ ok: true, state: { ...game, currentPhase: 0, iteration: game.iteration + 1 } }));
    expect(fake.session.metadata).toEqual(scoreMetadata(0));
    expect(fake.built.map((data) => data.title)).toEqual(['Phase 0 score', 'Phase 3 score', 'Phase 0 score']);
    h.stop();
  });

  it('routes its two controls through the controller and keeps the session while paused', async () => {
    const h = await harness(); const fake = fakeHost();
    bindScoreSession(h.controller, fake.host);
    run(FADE_IN_MS); h.at(0).status(true, false, false);
    fake.press('pause');
    expect(h.controller.state.getState()).toMatchObject({ enabled: true, activated: false, playing: false });
    expect(fake.session.playbackState).toBe('paused');
    expect(fake.session.metadata, 'still there, so play can find it').toEqual(scoreMetadata(0));
    fake.press('play'); await settle();
    expect(h.controller.state.getState().activated).toBe(true);
    h.at(0).status(true, false, false);
    expect(fake.session.playbackState).toBe('playing');
    h.stop();
  });

  it('is cleared when music is switched off, at an ending and at teardown, handlers included', async () => {
    const cleared = (fake: ReturnType<typeof fakeHost>) => {
      expect(fake.session.metadata).toBeNull();
      expect(fake.session.playbackState).toBe('none');
      expect(fake.offered()).toEqual([]);
    };
    const off = await harness(); const first = fakeHost();
    bindScoreSession(off.controller, first.host);
    off.controller.toggle(); cleared(first);
    // Switched back on by the player: published again, because that press is the gesture.
    off.controller.toggle();
    expect(first.session.metadata).toEqual(scoreMetadata(0));
    off.stop();
    const ended = await harness(); const second = fakeHost();
    bindScoreSession(ended.controller, second.host);
    ended.end(); cleared(second);
    second.press('play'); await settle();
    expect(ended.live(), 'and its old handler starts nothing').toBe(0);
    ended.stop();
    const torn = await harness(); const third = fakeHost();
    const unbind = bindScoreSession(torn.controller, third.host);
    unbind(); cleared(third);
    torn.controller.remote('pause');
    expect(third.session.playbackState, 'unsubscribed').toBe('none');
    torn.stop();
  });

  it('keeps one title and stays playing through everything a clip does to the score: the duck, a level change and the reports that arrive under it', async () => {
    const h = await harness(); const fake = fakeHost();
    bindScoreSession(h.controller, fake.host);
    run(FADE_IN_MS); h.at(0).status(true, false, false);
    const before = fake.session.metadata; const built = fake.built.length;
    // A clip reaches the controller as a duck (musicSession.ts). The duck alone publishes no
    // state, so on its own it could not move the session whatever this module did; the
    // session is re-read when state changes, and two things change it while a clip talks.
    let reads = 0;
    const counting = h.controller.state.subscribe(() => { reads += 1; });
    const level = fresh(h.at(0));
    h.controller.setDucked(true); run(DUCK_RAMP_MS);
    expect(level.at(-1), 'the clip really did take the score down').toBeCloseTo(0.4 * OUTPUT_SCALE * DUCK_RATIO);
    h.controller.setVolume(60);
    h.at(0).status(false, false, false); h.at(0).status(true, false, false);
    expect(reads, 'the session was re-read while the clip talked').toBeGreaterThanOrEqual(3);
    expect(fake.session.metadata, 'the same object: not rebuilt, not replaced').toBe(before);
    expect(fake.built, 'nothing was built for the clip').toHaveLength(built);
    expect(fake.offered()).toEqual(['pause', 'play']);
    expect(fake.session.playbackState).toBe('playing');
    h.controller.setDucked(false); run(DUCK_RAMP_MS);
    expect(level.at(-1)).toBeCloseTo(0.6 * OUTPUT_SCALE);
    expect(fake.session.metadata).toBe(before);
    expect(fake.session.playbackState).toBe('playing');
    counting(); h.stop();
  });
});

describe('the browser host', () => {
  it('is absent without the API, so native builds and older browsers bind nothing', () => {
    expect(browserSessionHost({})).toBeNull();
    expect(browserSessionHost({ navigator: {} })).toBeNull();
    // React Native: a navigator, no mediaSession, no MediaMetadata.
    expect(browserSessionHost()).toBeNull();
    const session = { metadata: null, playbackState: 'none', setActionHandler: () => undefined };
    expect(browserSessionHost({ navigator: { mediaSession: session } }), 'a session without MediaMetadata').toBeNull();
  });

  it('builds MediaMetadata with the page icon as artwork, and with none when the page has no icon', () => {
    class Metadata { constructor(readonly init: object) {} }
    const session = { metadata: null, playbackState: 'none', setActionHandler: () => undefined };
    const lookups: string[] = [];
    const withIcon = browserSessionHost({ navigator: { mediaSession: session }, MediaMetadata: Metadata,
      document: { querySelector: (selector) => { lookups.push(selector); return { href: 'https://example.test/favicon.ico' }; } } });
    expect(lookups, 'nothing is looked up until a session is published').toEqual([]);
    expect(withIcon?.metadata(scoreMetadata(2))).toEqual(new Metadata({ ...scoreMetadata(2), artwork: [{ src: 'https://example.test/favicon.ico' }] }));
    for (const document of [undefined, { querySelector: () => null }, { querySelector: () => ({ href: '' }) }]) {
      const bare = browserSessionHost({ navigator: { mediaSession: session }, MediaMetadata: Metadata, ...(document ? { document } : {}) });
      expect(bare?.metadata(scoreMetadata(2))).toEqual(new Metadata({ ...scoreMetadata(2), artwork: [] }));
    }
  });
});
