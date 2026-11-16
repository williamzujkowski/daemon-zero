/**
 * Linear volume ramps for one player. It owns the only path to that player's level, so a ramp
 * can be retargeted from where it actually is, cancelled, and closed for good when the player
 * is released. It knows nothing of preferences, ducking or phases: it is handed numbers.
 */
import { systemClock } from './clock';

/** How often a ramp writes a level. 25 ms gives a 200 ms duck eight steps, which is as fine as
 *  a media element's volume is worth stepping; like the durations, it is unheard. */
export const RAMP_STEP_MS = 25;

/** The one thing a ramp needs from time, so tests and callers can supply their own. */
export interface RampClock { every(ms: number, tick: () => void): () => void }

/** Real timers come from the app's one clock module, not from a second `setInterval` here. */
const appClock: RampClock = {
  every: (ms, tick) => {
    const timer = systemClock.every(tick, ms);
    return () => { systemClock.cancel(timer); };
  },
};

/** A ramp in flight: `step` of `steps` done on the way from `from` to `target`. */
interface Flight { from: number; target: number; step: number; steps: number; done: (() => void) | undefined; stop: () => void }

export class VolumeRamp {
  private level = 0;
  private flight: Flight | null = null;
  private closed = false;
  private ceiling = Number.POSITIVE_INFINITY;

  /**
   * `failed` hears about a write that threw inside a timer tick, where there is no caller to
   * catch it. A write that throws from `set` or an immediate `to` propagates as it always did.
   */
  constructor(private readonly write: (level: number) => void, private readonly failed: () => void = () => undefined,
    private readonly clock: RampClock = appClock, private readonly stepMs: number = RAMP_STEP_MS) {}

  /** The level last written, which is where the next ramp starts. */
  get current(): number { return this.level; }

  /** Stop where it is. The level stays at the last one written and `done` is never called. */
  cancel(): void {
    this.flight?.stop();
    this.flight = null;
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
    const steps = Math.ceil(durationMs / this.stepMs);
    if (!(steps > 1) || this.level === target) { this.put(target); done?.(); return; }
    this.flight = { from: this.level, target, step: 0, steps, done, stop: this.clock.every(this.stepMs, () => { this.tick(); }) };
  }

  /**
   * A new destination for whatever is happening. A level at rest simply moves. A ramp in
   * flight bends: it heads for the new target from where it is, over the steps it had left,
   * on the timer it already has. The timer is deliberately not restarted, because a control
   * held or dragged retargets faster than one step, and a ramp that started again each time
   * would stand still until the input paused.
   */
  retarget(target: number): void {
    const flight = this.flight;
    if (!flight) { this.set(target); return; }
    flight.steps -= flight.step;
    flight.step = 0;
    flight.from = this.level;
    flight.target = target;
  }

  /**
   * Never write above `max` again, and come down to it now if the level is above it. A ramp in
   * flight keeps its steps, its deadline and its `done`; it is only clipped. The cap can be
   * tightened and never loosened, so nothing that calls this can turn a level up. It is for a
   * ramp on its way down to silence: one that rises to a target above the cap stops at the cap.
   */
  limit(max: number): void {
    if (this.closed) return;
    this.ceiling = Math.min(this.ceiling, max);
    if (this.level > this.ceiling) this.put(this.ceiling);
  }

  private tick(): void {
    const flight = this.flight;
    if (!flight) return;
    flight.step += 1;
    try {
      if (flight.step < flight.steps) {
        this.put(flight.from + (flight.target - flight.from) * flight.step / flight.steps);
        return;
      }
      this.cancel();
      this.put(flight.target);
    } catch {
      this.cancel();
      this.failed();
      return;
    }
    flight.done?.();
  }

  private put(level: number): void {
    // Checked here as well as at the entry points: this is the last line before the player.
    if (this.closed) return;
    this.level = Math.min(level, this.ceiling);
    this.write(this.level);
  }
}
