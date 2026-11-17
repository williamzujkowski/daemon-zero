/**
 * Tells a pause or a start that came from outside the app (a headset or keyboard media key,
 * headphones being unplugged) from the status reports the app's own calls cause. On Android
 * the platform's media session drives the native player directly and JavaScript only hears
 * about it afterwards, so the controller cannot intercept such a press; it can only recognise
 * one and bring its own state into line. One watch per player.
 */
import { systemClock } from './clock';

/**
 * How long a pause nobody in the app asked for must last before it is believed. Android pauses
 * every player itself when the activity leaves the foreground, and that status can reach
 * JavaScript before the lifecycle event that explains it; inside this window the lifecycle
 * event wins and the pause is not taken for the player's own. Unmeasured on a device: long
 * enough for two events queued together, short enough that the Audio page follows a key press.
 */
export const OUTSIDE_PAUSE_CONFIRM_MS = 400;

export type OutsideStart = 'started' | 'stale';

export class OutsideWatch {
  /** Heard sounding since the app last started it: only then can a pause be somebody else's. */
  private sounding = false;
  /** The last report was a real pause: only after one can a start be somebody else's. */
  private quiet = false;
  private timer: ReturnType<typeof systemClock.every> | null = null;

  constructor(private readonly paused: () => void) {}

  /** The app started the player. Reports from before this call prove nothing about it. */
  started(): void { this.forget(); }

  /**
   * The app stopped the player. If it was sounding, a "playing" report still in the queue is
   * the echo of that; if it was already paused (an outside pause just adopted), stopping it
   * again produces no report at all, so what is known about it must not be thrown away.
   */
  stopped(): void { this.forget(); }

  private forget(): void {
    this.sounding = false;
    if (this.timer !== null) systemClock.cancel(this.timer);
    this.timer = null;
  }

  /**
   * A report while the app wants the player sounding. `held` is the player saying it is not
   * playing and not about to (buffering is neither): only that can be an outside pause.
   */
  wanted(playing: boolean, held: boolean): void {
    this.quiet = held;
    if (playing || !held) {
      if (playing) this.sounding = true;
      if (this.timer !== null) systemClock.cancel(this.timer);
      this.timer = null;
      return;
    }
    if (!this.sounding || this.timer !== null) return;
    this.timer = systemClock.every(() => {
      this.forget();
      this.paused();
    }, OUTSIDE_PAUSE_CONFIRM_MS);
  }

  /**
   * A report while the app does not want the player sounding. A "playing" one is an outside
   * start only if the player was heard paused first; otherwise it is the tail of the app's own
   * stop, and acting on it would undo a pause the instant it was made.
   */
  unwanted(playing: boolean, held: boolean): OutsideStart | null {
    if (!playing) {
      this.quiet = this.quiet || held;
      return null;
    }
    const start = this.quiet ? 'started' : 'stale';
    this.quiet = false;
    return start;
  }
}
