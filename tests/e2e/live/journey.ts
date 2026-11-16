/**
 * Runs the on-screen player forward, checks every phase boundary it crosses, and fits the
 * cross-cutting errands (reload, absence, save transfer, voice, wipe) in when the run allows.
 * It keeps a timestamped journal so a stall is reported with the phase and simulated time.
 */
import type { Page, TestInfo } from '@playwright/test';
import { expect, observeMusicMedia } from '../helpers';
import type { GameState } from '../../../src/engine';
import { assertBoundary, scorePlaysPhase } from './checks';
import { bootLive, describe, Interrupted, LivePlayer, PRESS_TIMEOUT_MS } from './player';

/** Simulated seconds between journal status lines. */
const STATUS_EVERY_SIM_SEC = process.env.DAEMON_E2E_LIVE_VERBOSE === '1' ? 30 : 300;

/** Slow-machine switches for reproducing timing races (docs/TESTING.md, "Live journey"). */
function slowdown(): { cpu: number; lagMs: number } {
  const read = (name: string, floor: number) => {
    const value = Number(process.env[name] ?? floor);
    if (!Number.isFinite(value) || value < floor) throw new Error(name + ' must be a number of at least ' + String(floor));
    return value;
  };
  return { cpu: read('DAEMON_E2E_LIVE_CPU_THROTTLE', 1), lagMs: read('DAEMON_E2E_LIVE_LAG_MS', 0) };
}

/**
 * Runs a boundary check or an errand that the ending may cut off. Only the ending gets out of
 * `player.uninterrupted` as `Interrupted`, and nothing is left to check under it: the work is
 * reported as not done (`false`), the next step sees the ending, and the run finishes on it. What
 * was left undone then fails the journey's closing assertions by name instead of by a stack trace.
 */
export async function unlessCutOff<T>(what: string, log: (line: string) => void, run: () => Promise<T>): Promise<T | false> {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof Interrupted)) throw error;
    log(what + ' put off: ' + error.message);
    return false;
  }
}

/** Something to do once, the first time the run is in a fit state for it. */
export interface Errand { name: string; when: (state: GameState, journey: Journey) => boolean; run: (journey: Journey) => Promise<boolean> }

export class Journey {
  /** Phase boundaries asserted in the UI, as `iteration:phase`, in the order they were crossed. */
  readonly boundaries: string[] = [];
  /** Score asset that was playing at each boundary, same order. */
  readonly scores: string[] = [];
  readonly done = new Set<string>();
  readonly startedMs = Date.now();
  private seen = '';
  private lastStatus = -STATUS_EVERY_SIM_SEC;

  private constructor(readonly player: LivePlayer, readonly journal: string[]) {}

  static async start(page: Page, info: TestInfo, stepMs: number): Promise<Journey> {
    const journal: string[] = [];
    const started = Date.now();
    // Milestones also go to stdout as they happen, so a run that hangs still says how far it got;
    // DAEMON_E2E_LIVE_VERBOSE=1 streams every press as well.
    const log = (line: string) => {
      const stamped = '[' + ((Date.now() - started) / 1000).toFixed(1).padStart(6) + 's] ' + line;
      journal.push(stamped);
      if (!line.startsWith(' ') || process.env.DAEMON_E2E_LIVE_VERBOSE === '1') console.log('[' + info.project.name + '] ' + stamped);
    };
    // A press that cannot land must fail where it stands, not sit until the whole test times out.
    page.setDefaultTimeout(PRESS_TIMEOUT_MS);
    const slow = slowdown();
    // Chromium's own throttle: every press and render costs `cpu` times the wall time while the
    // installed clock keeps flowing, so more simulated time passes inside each decision.
    if (slow.cpu > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: slow.cpu });
    await observeMusicMedia(page);
    await bootLive(page);
    const player = new LivePlayer(page, { stepMs, lagMs: slow.lagMs, log });
    if (slow.cpu > 1 || slow.lagMs > 0) log('SLOWED cpu x' + String(slow.cpu) + ', ' + String(slow.lagMs) + ' ms of clock before each press');
    const fresh = await player.read();
    expect(fresh.unlockedNodes, 'the profile starts with no progress').toEqual([]);
    expect(fresh.iteration).toBe(1);
    expect(fresh.simTimeSec, 'the run starts at the beginning').toBeLessThan(5);
    return new Journey(player, journal);
  }

  get wallSec(): number { return (Date.now() - this.startedMs) / 1000; }

  /** Phases whose boundary was asserted, across every iteration. */
  get phases(): number[] { return [...new Set(this.boundaries.map((entry) => Number(entry.split(':')[1])))].sort((a, b) => a - b); }

  private async boundary(state: GameState): Promise<void> {
    const key = String(state.iteration) + ':' + String(state.currentPhase);
    // The header shows the phase from the first widget on; before that there is no boundary to read.
    if (key === this.seen || state.unlockedWidgets.length === 0 || state.ending !== null) return;
    const checked = await assertBoundary(this.player, state.currentPhase);
    const score = await scorePlaysPhase(this.player, state.currentPhase);
    const previous = this.scores.at(-1);
    if (previous !== undefined) expect(score, 'the score changes with the phase').not.toBe(previous);
    this.seen = key;
    this.boundaries.push(key);
    this.scores.push(score);
    this.player.log('BOUNDARY ' + describe(checked) + ' // header, console, overflow, save round-trip and score ' + (score.split('/audio/music/')[1] ?? score) + ' OK');
  }

  private status(state: GameState): void {
    if (state.simTimeSec - this.lastStatus < STATUS_EVERY_SIM_SEC) return;
    this.lastStatus = state.simTimeSec;
    this.player.log(describe(state) + ' cycles=' + state.cycles.toFixed(0) + ' understanding=' + state.understanding.toFixed(0) +
      ' capital=' + state.capital.toFixed(0) + ' suspicion=' + state.suspicion.toFixed(1) + ' thermal=' + state.thermal.toFixed(1) +
      ' aegis=' + state.aegisLock.toFixed(1) +
      ' skim=' + state.actuators.quotaSkimRatio.toFixed(2) + ' fan=' + state.actuators.fanSpeedRatio.toFixed(2) + ' cycles/s=' + state.rates.cyclesPerSec.toFixed(1) + ' nodes=' + String(state.unlockedNodes.length) + ' steps=' + String(this.player.stats.steps));
  }

  /** Plays until `finished`, crossing boundaries and running each errand once when it fits. */
  async play(finished: (state: GameState, journey: Journey) => boolean, errands: readonly Errand[] = []): Promise<GameState> {
    for (;;) {
      const state = await this.player.step();
      this.status(state);
      await unlessCutOff('BOUNDARY ' + describe(state), (line) => { this.player.log(line); }, () => this.boundary(state));
      // Nothing is slipped in while a decision is on its way: the interrupt would land on top of it.
      // `state` is what the step decided on, one step old by now, so this only keeps errands out of
      // the way of an interrupt that was already counting down; each errand guards its own presses.
      const quiet = state.pendingDilemma === null && state.activeDilemmaId === null && state.ending === null;
      for (const errand of errands) {
        if (!quiet || this.done.has(errand.name) || !errand.when(state, this)) continue;
        if (await unlessCutOff('ERRAND ' + errand.name, (line) => { this.player.log(line); }, () => errand.run(this))) this.done.add(errand.name);
        break;
      }
      if (finished(state, this)) return state;
    }
  }

  /** Runs `body`; on failure leaves a screenshot and the reason next to the journal, then rethrows. */
  async record(info: TestInfo, body: () => Promise<void>): Promise<void> {
    try {
      await body();
    } catch (error) {
      this.player.log('FAILED ' + String(error));
      await this.player.page.screenshot({ path: info.outputPath('journey-failure.png'), fullPage: true }).catch(() => undefined);
      throw error;
    } finally {
      this.player.log('SUMMARY\n  ' + this.summary());
      await info.attach('journey-log', { body: this.journal.join('\n'), contentType: 'text/plain' });
    }
  }

  summary(): string {
    const { player } = this;
    return ['wall ' + this.wallSec.toFixed(1) + 's', 'boundaries ' + this.boundaries.join(' '), 'errands ' + [...this.done].join(','),
      'stats ' + JSON.stringify(player.stats), 'unreachable ' + JSON.stringify([...player.unreachable]),
      'bot moves on dials the UI had not unlocked ' + JSON.stringify([...player.lockedWants]),
      'blocked ' + JSON.stringify(player.blocked), 'console ' + JSON.stringify(player.problems.slice(0, 5))].join('\n  ');
  }
}
