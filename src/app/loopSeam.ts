/**
 * A short dip in one player's gain around each loop wrap, so a score that ends mid-note does
 * not step from that note to silence when the player restarts it. The supplied files are not
 * touched: the dip is applied as a trim on top of whatever level the player's ramp holds.
 */
import { appClock, RAMP_STEP_MS, type RampClock } from './volumeRamp';

/** Where the dip reaches its floor, ahead of the end the player reports. Chromium stopped a score
 *  up to 16 ms short of its decoded end in the loop measurements, and the position is read on
 *  the main thread, so the dip is down with room to spare. */
export const SEAM_GUARD_MS = 30;
/** How long the dip takes to come down before that point, and to go back up after the restart.
 *  Three ramp steps each way. Nobody chose these by ear: docs/VOICE-CLIPS.md, "Loop seams". */
export const SEAM_FALL_MS = 75;
export const SEAM_RISE_MS = 75;
/** Far from the end the position is read four times a second; inside this it is read every
 *  ramp step. On Android each read is a synchronous call to the main thread, so it is not done
 *  forty times a second for the whole of a track. */
const NEAR_MS = 600;
const FAR_POLL_MS = 250;

/**
 * The bottom of the dip: -60 dB, inaudible under a tail already 30 dB or more down, but not
 * zero. Measured: with the dip going to exactly 0, Chromium restarted every score about 50 ms
 * later than it does at any other level (the seam gained that much silence), as if a silent
 * element were taking a slower path; at this floor the restart is where it always was.
 */
export const SEAM_FLOOR = 0.001;

export interface Playhead { position(): number; duration(): number }

const clamp = (value: number) => Math.max(SEAM_FLOOR, Math.min(1, value));

export class LoopSeam {
  private stop: (() => void) | null = null;
  private fast = false;
  private last = Number.NaN;
  private rising = false;
  private gain = 1;

  /** `failed` hears about a position read that threw inside a timer tick. */
  constructor(private readonly playhead: Playhead, private readonly trim: (gain: number) => void,
    private readonly failed: () => void, private readonly clock: RampClock = appClock) {}

  /**
   * Watch from now. A watch already running is restarted; the trim starts at full gain. The
   * first read is one ramp step away, not a far poll, because a start can be close to the end
   * (a return from the background). It is not read here and now: a read that threw would fail
   * the player in the middle of the call that is starting it.
   */
  start(): void {
    this.end();
    this.rising = false;
    this.last = Number.NaN;
    this.apply(1);
    this.schedule(true);
  }

  /** Stop watching. The trim stays where it is until the next `start`. */
  end(): void {
    this.stop?.();
    this.stop = null;
  }

  /** Only a change is written: the trim is the player's level, and most reads change nothing. */
  private apply(gain: number): void {
    if (gain === this.gain) return;
    this.gain = gain;
    this.trim(gain);
  }

  private schedule(fast: boolean): void {
    this.stop?.();
    this.fast = fast;
    this.stop = this.clock.every(fast ? RAMP_STEP_MS : FAR_POLL_MS, () => { this.tick(); });
  }

  /**
   * The gain is read off the position, not counted in steps: a late tick lands further down
   * the dip instead of running behind it. A position that went backwards is the wrap (or a
   * seek); from there the gain comes back up with the position, over the start of the file.
   */
  private tick(): void {
    let position: number; let duration: number;
    try { position = this.playhead.position() * 1000; duration = this.playhead.duration() * 1000; } catch {
      this.end();
      this.failed();
      return;
    }
    if (!Number.isFinite(position) || !Number.isFinite(duration) || !(duration > 0)) return;
    if (position < this.last) this.rising = true;
    this.last = position;
    const remaining = duration - position;
    let gain: number;
    if (this.rising) {
      gain = clamp(position / SEAM_RISE_MS);
      if (gain === 1) this.rising = false;
    } else gain = clamp((remaining - SEAM_GUARD_MS) / SEAM_FALL_MS);
    this.apply(gain);
    const fast = this.rising || remaining <= NEAR_MS;
    if (fast !== this.fast) this.schedule(fast);
  }
}
