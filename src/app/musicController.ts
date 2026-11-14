/** Owns one player and its lifecycle outside the terminal's restore identity.
 * Game ticks never reach the audio backend unless phase/run identity changes.
 */
import { createStore } from 'zustand/vanilla';
import type { GameStore } from './store';
import type { Lifecycle } from './platform';
import { audioPreferences, silentPreferences } from './audioPreferences';
import type { KeyValueStorage } from './storage';
import { musicPhase, type MusicPhase } from './musicTracks';

export interface MusicPlayer { play(): void; pause(): void; volume(value: number): void; remove(): void }
interface MusicBackend { prepareMusic(): Promise<void>; createMusicPlayer(phase: MusicPhase, changed: (playing: boolean, error: boolean) => void): MusicPlayer }
const blockedMessage = 'Playback unavailable. Try Resume music; check your device volume if silent.';

export class MusicController {
  readonly state = createStore(() => ({ ...silentPreferences, loaded: false, playing: false, activated: false,
    status: '', storageNotice: '', trackPhase: null as MusicPhase | null }));
  private player: MusicPlayer | null = null;
  private backend: MusicBackend | null = null;
  private scope = '';
  private active = false;
  private live = false;
  private eligible = false;
  private phase: MusicPhase | null = null;
  private generation = 0;
  private playerGeneration = 0;
  private activationAttempt = 0;
  private readonly preferences;

  constructor(private readonly game: GameStore, private readonly lifecycle: Lifecycle, storage: KeyValueStorage,
    private readonly loadBackend: () => Promise<MusicBackend> = () => import('./audioPlayer')) {
    this.preferences = audioPreferences(storage);
  }

  start(): () => void {
    this.state.setState({ ...silentPreferences, loaded: false, activated: false, playing: false, status: '', storageNotice: '' });
    this.live = true;
    this.active = this.lifecycle.current();
    const generation = ++this.generation;
    void this.preferences.load().then((value) => {
      if (this.live && generation === this.generation) this.state.setState({ ...value, loaded: true });
    }).catch(() => {
      if (this.live && generation === this.generation) this.state.setState({ loaded: true, storageNotice: 'Audio settings could not be loaded. Music remains off.' });
    });
    const stopGame = this.game.store.subscribe(() => { this.syncGame(); });
    const stopLife = this.lifecycle.subscribe((active) => {
      if (active === this.active) return;
      this.active = active;
      this.reconcile();
    });
    this.syncGame();
    return () => { this.live = false; ++this.generation; stopGame(); stopLife(); this.release(); this.state.setState({ activated: false }); };
  }

  private syncGame(): void {
    const { ready, restoreRevision, game } = this.game.store.getState();
    const scope = [ready, restoreRevision, game.currentPhase, game.iteration, game.ending].join(':');
    if (scope === this.scope) return;
    this.scope = scope;
    this.phase = ready && game.ending === null ? musicPhase(game.currentPhase) : null;
    this.eligible = this.phase !== null;
    this.state.setState({ trackPhase: this.phase, playing: false });
    // A phase change, wipe or import restarts exactly the current phase score.
    this.release();
    this.reconcile();
  }

  toggle(): void {
    if (!this.state.getState().loaded) return;
    const enabled = !this.state.getState().enabled;
    this.state.setState({ enabled, activated: enabled, status: '' });
    this.persist();
    if (enabled) void this.activate();
    else { ++this.activationAttempt; this.release(); }
  }

  resume(): void {
    if (!this.state.getState().enabled) return;
    this.state.setState({ activated: true, status: '' });
    void this.activate();
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    const value = Math.max(0, Math.min(100, Math.round(volume)));
    this.state.setState({ volume: value });
    this.player?.volume(value / 100);
    this.persist();
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

  private reconcile(): void {
    const { enabled, activated, volume } = this.state.getState();
    if (!this.live || !this.active || !this.eligible || !enabled || !activated) {
      this.player?.pause();
      this.state.setState({ playing: false });
      return;
    }
    if (!this.backend || this.phase === null) return;
    try {
      const identity = this.playerGeneration;
      this.player ??= this.backend.createMusicPlayer(this.phase, (playing, error) => {
        if (!this.live || identity !== this.playerGeneration) return;
        if (error) this.fail();
        else this.state.setState({ playing: playing && this.active && this.eligible && this.state.getState().activated });
      });
      this.player.volume(volume / 100);
      this.player.play();
    } catch { this.fail(); }
  }

  private fail(): void {
    this.player?.pause();
    this.state.setState({ playing: false, activated: false, status: blockedMessage });
  }

  private release(): void {
    ++this.playerGeneration;
    this.player?.pause();
    this.player?.remove();
    this.player = null;
    this.state.setState({ playing: false });
  }

  private persist(): void {
    const { enabled, volume } = this.state.getState();
    const generation = this.generation;
    void this.preferences.save({ version: 1, enabled, volume }).then(() => {
      if (this.live && generation === this.generation) this.state.setState({ storageNotice: '' });
    }).catch(() => {
      if (this.live && generation === this.generation) this.state.setState({ storageNotice: 'Audio settings could not be saved. Changes apply for this session.' });
    });
  }
}
