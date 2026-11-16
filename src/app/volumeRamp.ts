/**
 * Linear volume ramps for one player. It owns the only path to that player's level, so a ramp
 * can be retargeted from where it actually is, cancelled, and closed for good when the player
 * is released. It knows nothing of preferences, ducking or phases: it is handed numbers.
 */

/** How often a ramp writes a level. 25 ms gives a 200 ms duck eight steps, which is as fine as
 *  a media element's volume is worth stepping; like the durations, it is unheard. */
export const RAMP_STEP_MS = 25;

/** The one thing a ramp needs from time, so tests and callers can supply their own. */
export interface RampClock { every(ms: number, tick: () => void): () => void }

const intervalClock: RampClock = {
  every: (ms, tick) => {
    const handle = setInterval(tick, ms);
    return () => { clearInterval(handle); };
  },
};

export class VolumeRamp {
  private level = 0;
  private halt: (() => void) | null = null;
  private durationMs = 0;
  private closed = false;

  /**
   * `failed` hears about a write that threw inside a timer tick, where there is no caller to
   * catch it. A write that throws from `set` or an immediate `to` propagates as it always did.
   */
  constructor(private readonly write: (level: number) => void, private readonly failed: () => void = () => undefined,
    private readonly clock: RampClock = intervalClock, private readonly stepMs: number = RAMP_STEP_MS) {}

  /** The level last written, which is where the next ramp starts. */
  get current(): number { return this.level; }
  get active(): boolean { return this.halt !== null; }

  /** Stop where it is. The level stays at the last one written and `done` is never called. */
  cancel(): void {
    this.halt?.();
    this.halt = null;
  }

  /** The player is gone: stop, and refuse every later write, including one already queued. */
  close(): void {
    this.cancel();
    this.closed = true;
  }

  /** Land on a level now, abandoning any ramp in flight. */
  set(level: number): void {
    if (this.closed) return;
    this.cancel();
    this.put(level);
  }

  /**
   * Ramp from the current level, not from wherever an interrupted ramp was heading. Progress is
   * counted in steps rather than read from a clock, so a throttled timer stretches a ramp but
   * can never make it skip, overshoot or end anywhere but exactly on `target`.
   */
  to(target: number, durationMs: number, done?: () => void): void {
    if (this.closed) return;
    this.cancel();
    const from = this.level;
    const steps = Math.ceil(durationMs / this.stepMs);
    if (!(steps > 1) || from === target) { this.put(target); done?.(); return; }
    this.durationMs = durationMs;
    let step = 0;
    this.halt = this.clock.every(this.stepMs, () => {
      step += 1;
      try {
        if (step < steps) { this.put(from + (target - from) * step / steps); return; }
        this.cancel();
        this.put(target);
      } catch {
        this.cancel();
        this.failed();
        return;
      }
      done?.();
    });
  }

  /** A new destination for whatever is happening: a ramp in flight bends towards it over its
   *  own duration, and a level at rest simply moves. */
  retarget(target: number): void {
    if (this.active) this.to(target, this.durationMs);
    else this.set(target);
  }

  private put(level: number): void {
    // Checked here as well as at the entry points: this is the last line before the player.
    if (this.closed) return;
    this.level = level;
    this.write(level);
  }
}
