/** Owns one player and its lifecycle outside the terminal's restore identity.
 * Game ticks never reach the audio backend unless phase/run identity changes.
 * It also holds the whole stored audio preference, speech fields included, because the two
 * halves share one storage slot and must be written together; it plays no speech itself.
 */
import { createStore } from 'zustand/vanilla';
import type { GameStore } from './store';
import type { Lifecycle } from './platform';
import { audioPreferences, silentPreferences } from './audioPreferences';
import type { KeyValueStorage } from './storage';
import { musicPhase, type MusicPhase } from './musicTracks';
import { VolumeRamp } from './volumeRamp';
import { OutsideWatch } from './outsideControl';

export interface MusicPlayer { play(): void; pause(): void; volume(value: number): void; remove(): void }
/** `held`: the player says it is neither playing nor about to. Buffering is not held. */
export type MusicStatus = (playing: boolean, error: boolean, held?: boolean) => void;
interface MusicBackend { prepareMusic(): Promise<void>; createMusicPlayer(phase: MusicPhase, changed: MusicStatus): MusicPlayer }
/**
 * How much of its preference level the soundtrack keeps while a transmission is being read.
 * Score and clips both measure about -15 LUFS, so at equal preference they compete; 0.35 is
 * roughly -9 dB, the low end of the usual range for music under speech, chosen so the score
 * stays present rather than cutting out. It is a reasoned starting value, not a tuned one.
 * On the web build the rendered score does drop by exactly this ratio (-9.12 dB on the signal,
 * docs/VOICE-CLIPS.md, "Measured signal"); whether that depth is right is a listening question
 * nobody has answered.
 */
export const DUCK_RATIO = 0.35;
/**
 * The three ramps below are defaults nobody chose by ear: a nexus option vote chose to build
 * short ramps on the single player before anyone had listened to one (docs/VOICE-CLIPS.md
 * records the vote and both dissents). Each sits mid-range of what the vote named. Their shape
 * and length in the rendered signal are measured (same section); how they sound is not known,
 * and they are meant to be retuned by ear.
 *
 * Down to the ducked level when a clip starts talking and back up when it stops. Short, so the
 * score is out of the way within the clip's first syllable.
 */
export const DUCK_RAMP_MS = 200;
/** The outgoing score when nothing replaces it: the ending, and music being switched off. A
 *  phase change, wipe or import is a cut followed by a fade-in, because the new player's
 *  `play()` must not wait on a timer (docs/VOICE-CLIPS.md, "Ramps"). */
export const FADE_OUT_MS = 500;
/** Every start of a player from silence: a new phase score, a restart after a wipe or import,
 *  and a return from the background. */
export const FADE_IN_MS = 500;
/** A player and the only writer of its level. `started` is false while it is paused. */
interface Slot { player: MusicPlayer; fader: VolumeRamp; watch: OutsideWatch; started: boolean }
const blockedMessage = 'Playback unavailable. Try Resume music; check your device volume if silent.';

export class MusicController {
  readonly state = createStore(() => ({ ...silentPreferences, loaded: false, playing: false, activated: false,
    status: '', storageNotice: '', trackPhase: null as MusicPhase | null }));
  private slot: Slot | null = null;
  /** A score fading out with nothing replacing it. A start removes it first: one at a time. */
  private leaving: Slot | null = null;
  private backend: MusicBackend | null = null;
  private scope = '';
  private active = false;
  private live = false;
  private eligible = false;
  private phase: MusicPhase | null = null;
  private generation = 0;
  private playerGeneration = 0;
  private activationAttempt = 0;
  private ducked = false;
  private readonly preferences;

  constructor(private readonly game: GameStore, private readonly lifecycle: Lifecycle, storage: KeyValueStorage,
    private readonly loadBackend: () => Promise<MusicBackend> = () => import('./audioPlayer')) {
    this.preferences = audioPreferences(storage);
  }

  /**
   * One root holds the controller at a time, and the latest start is the holder. Roots can
   * overlap: Android recreates the activity (a font-size change) and mounts the new root before
   * the old root's effect cleanup runs. So a start takes over from one still in place, and the
   * cleanup it returns tears down only while its own start is the current one; a superseded or
   * repeated cleanup drops its two subscriptions and nothing else (#185).
   */
  start(): () => void {
    // The state below is reset for the new holder, so the previous holder's player goes too.
    if (this.live) this.silence();
    this.state.setState({ ...silentPreferences, loaded: false, activated: false, playing: false, status: '', storageNotice: '' });
    this.live = true;
    this.active = this.lifecycle.current();
    const generation = ++this.generation;
    void this.preferences.load().then((value) => {
      if (this.live && generation === this.generation) this.state.setState({ ...value, loaded: true });
    }).catch(() => {
      if (this.live && generation === this.generation) this.state.setState({ loaded: true, storageNotice: 'Audio settings could not be loaded. Music and speech remain off.' });
    });
    const stopGame = this.game.store.subscribe(() => { this.syncGame(); });
    const stopLife = this.lifecycle.subscribe((active) => {
      if (active === this.active) return;
      this.active = active;
      this.reconcile();
    });
    this.syncGame();
    return () => {
      stopGame(); stopLife();
      // Teardown bumps the generation, so this also makes a second run of the same cleanup inert.
      if (generation !== this.generation) return;
      this.live = false;
      ++this.generation;
      this.silence();
      this.state.setState({ activated: false });
    };
  }

  /** Remove every player now, with no fade: the holder that asked for them is gone. */
  private silence(): void {
    this.release(false);
    this.dropLeaving();
  }

  private syncGame(): void {
    const { ready, restoreRevision, game } = this.game.store.getState();
    const scope = [ready, restoreRevision, game.currentPhase, game.iteration, game.ending].join(':');
    if (scope === this.scope) return;
    this.scope = scope;
    this.phase = ready && game.ending === null ? musicPhase(game.currentPhase) : null;
    this.eligible = this.phase !== null;
    this.state.setState({ trackPhase: this.phase, playing: false });
    // A phase change, wipe or import restarts exactly the current phase score, in this call:
    // the old player is cut, not faded, so the new one's `play()` stays in the call stack of
    // the press that caused it. Only a score that nothing replaces (the ending) fades out.
    this.release(!this.wanted());
    this.reconcile();
  }

  toggle(): void {
    if (!this.state.getState().loaded) return;
    const enabled = !this.state.getState().enabled;
    this.state.setState({ enabled, activated: enabled, status: '' });
    this.persist();
    if (enabled) void this.activate();
    else { ++this.activationAttempt; this.release(true); }
  }

  resume(): void {
    if (!this.state.getState().enabled) return;
    this.state.setState({ activated: true, status: '' });
    void this.activate();
  }

  /**
   * Stop for this session and leave the preference alone: the state the Audio page already
   * shows as "Music is paused. Resume to start listening." This is what a media key's pause
   * means. It is not `toggle()`: a headset button is easy to press by accident and may have
   * been meant for another app, so it must not rewrite what the player chose in the menu.
   */
  pause(): void {
    if (!this.state.getState().activated) return;
    // An activation still loading its backend finds nothing wanted when it lands.
    this.state.setState({ activated: false, status: '' });
    this.reconcile();
  }

  /**
   * A media key, lock screen or headset button. Pause is `pause()`; play is `resume()`, the
   * same path as `[ RESUME MUSIC ]`, so it fades in, respects the duck and does nothing while
   * music is switched off. A play that arrives while the app is in the background is dropped,
   * not remembered: music never starts there, and it must not start by itself on return.
   */
  remote(action: 'play' | 'pause'): void {
    if (action === 'pause') this.pause();
    else if (this.active) this.resume();
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    const value = Math.max(0, Math.min(100, Math.round(volume)));
    this.state.setState({ volume: value });
    const target = this.level(value);
    // A ramp in flight bends to the new level; silence is never ramped to, it is simply set.
    if (this.slot?.started === true && target > 0) this.slot.fader.retarget(target);
    else this.slot?.fader.set(target);
    // A player fading out has left `slot`, and must hear this too: zero ends it now, a lower
    // level clips it, and a higher one is ignored because it is on its way to silence. The cap
    // is the preference itself, not `target`: a duck never moves a fading player, so a volume
    // change made while a clip is talking must not smuggle the duck in either.
    if (value === 0) this.dropLeaving();
    else this.leaving?.fader.limit(value / 100);
    this.persist();
  }

  /** Speech has its own switch: it offers or withdraws READ and never touches the score. */
  toggleSpeech(): void {
    if (!this.state.getState().loaded) return;
    this.state.setState({ speechEnabled: !this.state.getState().speechEnabled });
    this.persist();
  }

  /** The clip in flight follows this through the widgets that subscribe to it. */
  setSpeechVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.state.setState({ speechVolume: Math.max(0, Math.min(100, Math.round(volume))) });
    this.persist();
  }

  /** Duck under speech. Session state only: the stored preference never sees the ducked level. */
  setDucked(ducked: boolean): void {
    if (ducked === this.ducked) return;
    this.ducked = ducked;
    const target = this.level(this.state.getState().volume);
    // A paused player (background, failure) is not ramped: its timers may never fire. A player
    // fading out is left alone: bending it down would be a step, and it must never come back up.
    if (this.slot?.started === true) this.slot.fader.to(target, DUCK_RAMP_MS);
    else this.slot?.fader.set(target);
  }

  /** The one place a preference becomes a player level, so no write site can forget the duck. */
  private level(volume: number): number {
    return volume / 100 * (this.ducked ? DUCK_RATIO : 1);
  }

  private async activate(): Promise<void> {
    const generation = this.generation;
    const attempt = ++this.activationAttempt;
    try {
      if (!this.backend) {
        const backend = await this.loadBackend();
        await backend.prepareMusic();
        if (!this.live || generation !== this.generation || attempt !== this.activationAttempt) return;
        this.backend = backend;
      }
      this.reconcile();
    } catch {
      if (this.live && generation === this.generation && attempt === this.activationAttempt && this.active && this.eligible) this.fail();
    }
  }

  /** Whether a score should be sounding now. */
  private wanted(): boolean {
    const { enabled, activated } = this.state.getState();
    return this.live && this.active && this.eligible && enabled && activated;
  }

  private reconcile(): void {
    if (!this.wanted()) {
      // Backgrounding and teardown stop at once, a fade-out in flight included: a suspended app
      // may never run the timer that would finish it. The ending and switching music off are
      // foreground events, so their fade-out is left to finish.
      if (!this.live || !this.active) this.dropLeaving();
      this.halt();
      this.state.setState({ playing: false });
      return;
    }
    if (!this.backend || this.phase === null) return;
    try {
      // A start is never left to a timer. A fade-out still in flight (music switched back on, a
      // new run during the ending) is cut short here, so there is still one player at a time
      // and `play()` below runs in the caller's stack: a browser that only honours `play()`
      // inside a user gesture would otherwise refuse every start that waited for a fade.
      this.dropLeaving();
      this.slot ??= this.open(this.backend, this.phase);
      const slot = this.slot;
      if (!slot.started) {
        const target = this.level(this.state.getState().volume);
        slot.started = true;
        slot.watch.started();
        slot.fader.set(0);
        if (target > 0) slot.fader.to(target, FADE_IN_MS);
      }
      slot.player.play();
    } catch { this.fail(); }
  }

  private open(backend: MusicBackend, phase: MusicPhase): Slot {
    const identity = this.playerGeneration;
    const player = backend.createMusicPlayer(phase, (playing, error, held = false) => {
      if (!this.live || identity !== this.playerGeneration) return;
      if (error) this.fail();
      else this.heard(playing, held);
    });
    const watch = new OutsideWatch(() => {
      if (this.live && identity === this.playerGeneration && this.wanted()) this.pause();
    });
    const fader = new VolumeRamp((level) => { player.volume(level); }, () => {
      // A level write that threw mid-ramp. A fading-out player is released there and then; a
      // live one fails like any other playback error, under the same stale-player guard as its
      // status callback.
      if (this.leaving?.player === player) this.dropLeaving();
      else if (this.live && identity === this.playerGeneration) this.fail();
    });
    return { player, fader, watch, started: false };
  }

  /**
   * A status report from the live player. Mostly it only says whether the score is sounding,
   * but on Android a media key reaches the native player without passing through this class
   * (expo-audio gives every player a media session), so a report can also be the first news of
   * a pause or a start nobody here asked for. A pause is adopted as `pause()`. A start is
   * adopted as `resume()` when resuming is all it would take; otherwise the player is stopped
   * again, which is what keeps a key pressed in the background from leaving the score running.
   */
  private heard(playing: boolean, held: boolean): void {
    const watch = this.slot?.watch;
    if (this.wanted()) {
      this.state.setState({ playing });
      watch?.wanted(playing, held);
      return;
    }
    this.state.setState({ playing: false });
    const start = watch?.unwanted(playing, held) ?? null;
    if (start === null) return;
    if (start === 'started' && this.active && this.eligible && this.state.getState().enabled) this.resume();
    else this.halt();
  }

  /** Pause the live player where it is. Its ramp stops with it; the next start fades in. */
  private halt(): void {
    if (!this.slot) return;
    this.slot.fader.cancel();
    this.slot.watch.stopped();
    this.slot.player.pause();
    this.slot.started = false;
  }

  private fail(): void {
    this.halt();
    this.state.setState({ playing: false, activated: false, status: blockedMessage });
  }

  /**
   * Give up the live player. Its status callbacks are stale from this line on, faded or not,
   * and `playing` is false from here: the state reports what was asked for, not the tail.
   * With `fade` an audible player is handed to `leaving` and removed by the last step of its
   * fade-out; anything silent, paused or backgrounded is removed now, as is teardown. Nothing
   * waits on that last step: a start that arrives first cuts the fade-out short (`reconcile`).
   */
  private release(fade: boolean): void {
    ++this.playerGeneration;
    const slot = this.slot;
    this.slot = null;
    this.state.setState({ playing: false });
    if (!slot) return;
    if (!(fade && this.live && this.active && slot.started && slot.fader.current > 0)) {
      this.remove(slot);
      return;
    }
    this.leaving = slot;
    slot.fader.to(0, FADE_OUT_MS, () => { this.dropLeaving(); });
  }

  /**
   * Release the fading player, if there is one. This never throws, on purpose. Its last step
   * runs from a timer, where nothing could catch a `pause()` or `remove()` that threw, and its
   * other callers (a start, volume 0, backgrounding) must not be stopped by the clean-up of a
   * player nobody is listening for. It is not routed to `fail()` either: that tells the player
   * the score they asked for is not playing and to press Resume, and here no score was asked
   * for. The live player's own release still propagates, as it did before ramps.
   */
  private dropLeaving(): void {
    const slot = this.leaving;
    this.leaving = null;
    if (!slot) return;
    try { this.remove(slot); } catch { /* already forgotten; `remove` has done what it could */ }
  }

  /** The ramp is closed before the player is removed, so nothing can write to a removed player.
   *  A `pause()` that throws must not leave the player unremoved. */
  private remove(slot: Slot): void {
    slot.fader.close();
    slot.watch.stopped();
    try { slot.player.pause(); } finally { slot.player.remove(); }
  }

  private persist(): void {
    const { enabled, volume, speechEnabled, speechVolume } = this.state.getState();
    const generation = this.generation;
    void this.preferences.save({ version: 2, enabled, volume, speechEnabled, speechVolume }).then(() => {
      if (this.live && generation === this.generation) this.state.setState({ storageNotice: '' });
    }).catch(() => {
      if (this.live && generation === this.generation) this.state.setState({ storageNotice: 'Audio settings could not be saved. Changes apply for this session.' });
    });
  }
}
