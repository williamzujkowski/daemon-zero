/**
 * Coordinates hydration, one live interval, explicit checkpoints and dormant resume.
 * Reference counting handles React effect remounts without duplicate loops or loads.
 */
import { CONTENT } from '../content';
import { createInitialState, type ActionResult } from '../engine';
import type { Clock } from './clock';
import type { Lifecycle } from './platform';
import type { Persistence } from './storage';
import type { GameAction, GameStore } from './store';

const SAVE_INTERVAL_MS = 5000;
const WRITE_ERROR = 'The save could not be written. Autosave will retry; keep the app open.';

export class GameRuntime {
  private users = 0;
  private activation = 0;
  private initialized = false;
  private loading: Promise<void> | null = null;
  private active = false;
  private backgroundAtMs: number | null = null;
  private lastMono = 0;
  private lastSaveMono = 0;
  private timer: ReturnType<Clock['every']> | null = null;
  private unsubscribe: (() => void) | null = null;
  private savingEnabled = true;

  constructor(
    readonly game: GameStore,
    private readonly persistence: Persistence,
    private readonly lifecycle: Lifecycle,
    private readonly clock: Clock,
  ) {}

  start(): () => void {
    this.users += 1;
    if (this.users === 1) {
      const activation = ++this.activation;
      this.active = this.lifecycle.current();
      this.unsubscribe = this.lifecycle.subscribe((active) => { this.changeActivity(active); });
      void this.initialize().then(() => {
        if (this.users === 0 || this.activation !== activation) return;
        if (this.active) this.resume();
      });
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.users -= 1;
      if (this.users !== 0) return;
      this.activation += 1;
      this.suspend();
      this.unsubscribe?.();
      this.unsubscribe = null;
    };
  }

  dispatch(action: GameAction, restoring = false): ActionResult {
    if (!this.active || !this.initialized || this.users === 0) {
      return { ok: false, state: this.game.store.getState().game, reason: 'The game is not active.' };
    }
    const wiped = this.sampleLive();
    const result = this.game.dispatch(action, restoring);
    if (result.ok || wiped) this.checkpoint();
    return result;
  }

  private initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    this.loading ??= this.load();
    return this.loading;
  }

  private async load(): Promise<void> {
    try {
      const saved = await this.persistence.load();
      const elapsed = saved.savedAtMs === null ? 0 : Math.max(0, this.clock.wall() - saved.savedAtMs) / 1000;
      this.game.initialize(saved.game, elapsed, saved.notice);
    } catch {
      this.savingEnabled = false;
      this.game.initialize(createInitialState(CONTENT), 0,
        'The save could not be read or backed up. Autosave is disabled; reopen to retry.');
    }
    this.initialized = true;
    this.backgroundAtMs = this.clock.wall();
  }

  private changeActivity(next: boolean): void {
    if (next === this.active) return;
    if (!this.initialized) { this.active = next; return; }
    if (next) { this.active = true; this.resume(); }
    else this.suspend();
  }

  private sampleLive(): boolean {
    const now = this.clock.monotonic();
    const elapsed = Math.max(0, now - this.lastMono) / 1000;
    this.lastMono = now;
    const previous = this.game.store.getState().game.iteration;
    this.game.step(elapsed);
    return this.game.store.getState().game.iteration !== previous;
  }

  private tick(): void {
    const wiped = this.sampleLive();
    if (wiped || this.clock.monotonic() - this.lastSaveMono >= SAVE_INTERVAL_MS) this.checkpoint();
  }

  private resume(): void {
    if (this.backgroundAtMs !== null) {
      this.game.step(Math.max(0, this.clock.wall() - this.backgroundAtMs) / 1000);
      this.backgroundAtMs = null;
    }
    this.lastMono = this.clock.monotonic();
    this.checkpoint();
    if (this.timer === null) this.timer = this.clock.every(() => { this.tick(); }, 1000 / CONTENT.balance.tickHz);
  }

  private suspend(): void {
    if (this.initialized && this.active) {
      this.sampleLive();
      this.backgroundAtMs = this.clock.wall();
      this.checkpoint();
    }
    this.active = false;
    if (this.timer !== null) this.clock.cancel(this.timer);
    this.timer = null;
  }

  private checkpoint(): void {
    if (!this.savingEnabled) return;
    this.lastSaveMono = this.clock.monotonic();
    void this.persistence.save(this.game.store.getState().game, this.clock.wall()).then(
      () => { if (this.game.store.getState().notice === WRITE_ERROR) this.game.notify(null); },
      () => { this.game.notify(WRITE_ERROR); },
    );
  }
}
