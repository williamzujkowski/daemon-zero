/**
 * What the score tells the platform's media session (the lock screen, a headset, a keyboard's
 * media keys) and what those are allowed to do. On the web this module writes
 * `navigator.mediaSession` itself, so a key press goes through the music controller. Native
 * has no equivalent call here: see docs/SOUNDTRACK.md for what Android publishes by itself.
 */
import type { MusicController } from './musicController';
import type { MusicPhase } from './musicTracks';

export const GAME_TITLE = 'DAEMON // 0';

/** The words the Audio page uses for the current score. The session may say these and no more. */
export function scoreLabel(phase: MusicPhase): string {
  return 'phase ' + String(phase) + ' score';
}

export interface ScoreMetadata { title: string; artist: string; album: string }

/**
 * Disclosure rule: a lock screen is read by people who are not playing, and by the player
 * before the game has told them anything, so the session never knows more than the Audio page
 * already says in the same moment, which is the phase number. The tracks' own names
 * (tracks.json `title`) are deliberately not used: four of the six appear nowhere in the game,
 * and the other two only behind widgets the player has yet to unlock.
 *
 * Artist and album are the game's name. The provenance files record a Suno account label, not
 * a credited artist, so there is no credit to show and none is invented.
 */
export function scoreMetadata(phase: MusicPhase): ScoreMetadata {
  const label = scoreLabel(phase);
  return { title: label.charAt(0).toUpperCase() + label.slice(1), artist: GAME_TITLE, album: GAME_TITLE };
}

type Handler = (() => void) | null;
/** The slice of the W3C Media Session API this module touches, so native code needs no DOM lib. */
export interface MediaSessionLike {
  metadata: unknown;
  playbackState: string;
  setActionHandler(action: string, handler: Handler): void;
}
export interface SessionHost {
  session: MediaSessionLike;
  /** Builds a `MediaMetadata`. Asked for artwork only when a session is published. */
  metadata(data: ScoreMetadata): unknown;
}

/** Offered: the two things a phase-bound, looping score can do. */
const OFFERED = ['play', 'pause'] as const;
/**
 * Refused by name, so no browser shows a button that does nothing: there is no next or previous
 * track in a score chosen by the phase, and no position worth seeking to in a loop. `stop` is
 * refused too; the way to stop the score for good is the switch in MENU > Audio.
 */
const REFUSED = ['seekto', 'seekforward', 'seekbackward', 'previoustrack', 'nexttrack', 'stop'] as const;

function handle(session: MediaSessionLike, action: string, handler: Handler): void {
  // A browser throws for an action name it does not know; that must not cost the others.
  try { session.setActionHandler(action, handler); } catch { /* unsupported action */ }
}

/**
 * Keep the session in step with the controller, and return the unsubscribe.
 *
 * Nothing is published until the player has started the score from inside the app at least
 * once: a session that existed before that would let a media key be the thing that first
 * fetches and plays audio. After that it stays, paused or playing, until music is switched
 * off, the run ends (no score plays over an ending) or the controller is torn down. A wipe or
 * an import moves it to the new run's phase like any other phase change.
 *
 * A spoken clip never appears here. It has no metadata of its own and the score keeps its
 * title and its `playing` state while ducked under one; with music off there is no session.
 */
export function bindScoreSession(controller: Pick<MusicController, 'state' | 'remote'>, host: SessionHost): () => void {
  let engaged = false;
  let shown: MusicPhase | null = null;
  const clear = () => {
    if (shown === null) return;
    shown = null;
    host.session.metadata = null;
    host.session.playbackState = 'none';
    for (const action of [...OFFERED, ...REFUSED]) handle(host.session, action, null);
  };
  const sync = () => {
    const { enabled, loaded, activated, playing, trackPhase } = controller.state.getState();
    engaged = enabled && loaded && (engaged || activated);
    if (!engaged || trackPhase === null) { clear(); return; }
    if (shown !== trackPhase) {
      shown = trackPhase;
      host.session.metadata = host.metadata(scoreMetadata(trackPhase));
      for (const action of OFFERED) handle(host.session, action, () => { controller.remote(action); });
      for (const action of REFUSED) handle(host.session, action, null);
    }
    host.session.playbackState = playing ? 'playing' : 'paused';
  };
  sync();
  const stop = controller.state.subscribe(sync);
  return () => { stop(); clear(); };
}

interface BrowserLike {
  navigator?: { mediaSession?: MediaSessionLike };
  MediaMetadata?: new (init: { title: string; artist: string; album: string; artwork: { src: string }[] }) => unknown;
  document?: { querySelector(selector: string): { href?: string } | null };
}

/**
 * The browser's session, or null where there is none: a browser without the API, and every
 * native build (React Native defines `navigator` but no `mediaSession`).
 */
export function browserSessionHost(scope: BrowserLike = globalThis as unknown as BrowserLike): SessionHost | null {
  const session = scope.navigator?.mediaSession;
  const Metadata = scope.MediaMetadata;
  if (!session || !Metadata) return null;
  return {
    session,
    metadata: (data) => {
      // The page's own icon: the browser already has it, so publishing fetches nothing new.
      const icon = scope.document?.querySelector('link[rel~="icon"]')?.href;
      return new Metadata({ ...data, artwork: icon === undefined || icon === '' ? [] : [{ src: icon }] });
    },
  };
}
