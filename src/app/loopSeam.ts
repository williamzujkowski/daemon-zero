/**
 * What the soundtrack reads from a player's playhead. A short dip in its gain around each loop
 * wrap, so a score that ends mid-note does not step from that note to silence when the player
 * restarts it (the supplied files are not touched: the dip is a trim on top of whatever level
 * the ramp holds); and the signal that audio is flowing, which a fade-in waits for.
 */
import { appClock, RAMP_STEP_MS, type RampClock } from './volumeRamp';

/** Where the dip reaches its floor, ahead of the end the player reports. Chromium stopped a score
 *  up to 16 ms short of its decoded end in the loop measurements, and the position is read on
 *  the main thread, so the dip is down with room to spare. */
export const SEAM_GUARD_MS = 30;
/** How long the dip takes to come down before that point, and to go back up after the restart.
 *  Nobody chose these by ear: docs/VOICE-CLIPS.md, "Loop seams". */
export const SEAM_FALL_MS = 75;
export const SEAM_RISE_MS = 75;
/**
 * How often the position is read, and the gain rewritten, near the end. Each write is a step
 * in the rendered signal, so the dip is a staircase of about fifteen 5 ms steps each way. At
 * the ramps' 25 ms it was three, and on a score whose tail is still loud (phase 5) each of
 * those steps measured larger than the seam it replaced. Far from the end the position is
 * read four times a second: on Android each read is a synchronous call to the main thread.
 */
export const SEAM_STEP_MS = 5;
const FAR_POLL_MS = 250;
/** Close enough to switch to the fine reads: past one far poll, a fall and a guard, with room. */
const NEAR_MS = 450;

/**
 * The bottom of the dip: -60 dB, inaudible under a tail already 30 dB or more down, but not
 * zero. Measured: with the dip going to exactly 0, Chromium restarted every score about 50 ms
 * later than it does at any other level (the seam gained that much silence), as if a silent
 * element were taking a slower path; at this floor the restart is where it always was.
 */
export const SEAM_FLOOR = 0.001;

export interface Playhead { position(): number; duration(): number }

/**
 * The longest a fade-in waits for the position to move before it starts anyway, so a player
 * that never reports progress (a platform whose position is stuck, say) is not left silent for
 * good. A file later than this still starts as part of a fade, not at full level, but the part
 * that ran before it arrived is lost. Counted in ramp steps, as the ramp itself is.
 */
export const FADE_IN_WAIT_MS = 1500;

/**
 * A gate for `VolumeRamp.to`: true once the position has moved from where it was when this was
 * made (forward, or back past a wrap), or once `FADE_IN_WAIT_MS` worth of asks have gone by.
 */
export function audioFlowing(playhead: Playhead): () => boolean {
  const from = playhead.position();
  let asked = 0;
  return () => {
    const now = playhead.position();
    asked += 1;
    return (Number.isFinite(now) && now !== from) || asked * RAMP_STEP_MS >= FADE_IN_WAIT_MS;
  };
}

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
   * first read is one fine step away, not a far poll, because a start can be close to the end
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
    this.stop = this.clock.every(fast ? SEAM_STEP_MS : FAR_POLL_MS, () => { this.tick(); });
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
