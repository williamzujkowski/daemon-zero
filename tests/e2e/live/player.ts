/**
 * A player that only presses what is on screen, on a clock that is running.
 * It reads the app's own autosave to decide (never writes it), asks the unmodified careful
 * sim bot what to do, and carries each move out through a visible, enabled control.
 * The game can raise a full-window layer at any moment, so every press looks first.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { CONTENT } from '../../../src/content';
import { deserialize, type GameState } from '../../../src/engine';
import { decide, manualClicks, rankChoices, type Intent } from './intents';

const SAVE_KEY = 'daemon-zero.save.v1';
/** Acknowledged with one press. The response notice is a band in the page; the rest cover the window. */
const NOTICES = ['reboot-continue', 'phase-threshold-continue', 'lineage-reveal-continue', 'response-acknowledge'];
/**
 * Every full-window layer the game raises by itself (src/ui: DilemmaModal, RebootSequence,
 * PhaseThreshold, LineageReveal, EndingScreen). Nothing under one takes a press until it is
 * serviced, and one arriving means whatever was decided before it is out of date. The menu,
 * kernel history, process list and confirmations are also full-window, but only a player opens
 * those, and the game closes the menu and the history itself when one of these arrives.
 */
export const COVERING = ['ending-screen', 'dilemma-modal', 'reboot-continue', 'phase-threshold-continue', 'lineage-reveal-continue'];
const PROBE = [...new Set([...COVERING, ...NOTICES])].map((id) => '[data-testid="' + id + '"]').join(',');
const COLLAPSED = '[data-testid^="reference-"][aria-expanded="false"]';
/** Steps to wait before sweeping again for a control that one, two, three... sweeps did not find. */
const MISS_BACKOFF_STEPS = [2, 4, 12];
/** A reveal can lag a purchase by an animation; this many empty sweeps in a row is not lag. */
const UNREACHABLE_AFTER_SWEEPS = 3;
/** No purchase, decision, phase or iteration change for this long is a stall, not patience. */
const STALL_SIM_SEC = 25 * 60;
const FROZEN_STEPS = 40;
/** A press that has not landed in this long is not waited on: the player looks for what covers it. */
const PROMPT_PRESS_MS = 2000;
/** With nothing covering it, navigation and errand presses get this long before the run fails. */
export const PRESS_TIMEOUT_MS = 15_000;
/** Layers come at most a few per phase; more than this in one decision or errand is a loop. */
const MAX_INTERRUPTIONS = 4;
const CLEAR_ROUNDS = 8;

interface Attr { getAttribute(name: string): string | null }
interface Storage { getItem(key: string): string | null }

export interface PlayerOptions {
  stepMs: number;
  /** Clock time let through between a decision and each press that carries it out: what a slow
   *  machine does on its own, made repeatable. Zero in a normal run. */
  lagMs?: number;
  log?: (line: string) => void;
}

/** The game put a full-window layer up while something was being carried out. The layer has
 *  already been serviced; what was being done was decided before it and must be decided again. */
export class Interrupted extends Error {
  constructor(readonly layers: readonly string[]) { super('interrupted by ' + layers.join(', ')); }
}

export class LivePlayer {
  /** Browser console warnings/errors and page errors, in arrival order. */
  readonly problems: string[] = [];
  /** Controls the bot wanted that repeated sweeps of every tab, area and collapsed panel never showed: id -> where first missed. */
  readonly unreachable = new Map<string, string>();
  /** Actuator moves the bot asked for before the game had shown the player that control. */
  readonly lockedWants = new Set<string>();
  /** Presses that could not land although nothing the game raises was covering the control. */
  readonly blocked: string[] = [];
  readonly stats = { steps: 0, presses: 0, manual: 0, dilemmas: 0, freeChoices: 0, disabled: 0, sweeps: 0, lateReveals: 0,
    /** Decisions and errands that a layer cut into and that were made again afterwards. */
    interrupted: 0, overlays: {} as Record<string, number> };
  private readonly routes = new Map<string, string[]>();
  private readonly misses = new Map<string, { sweeps: number; step: number; where: string }>();
  /** What the bot last asked for, and how many of each press landed; quoted when the run stalls. */
  private lastWanted: string[] = [];
  private progress = { signature: '', simSec: 0, frozen: 0, lastSim: -1 };
  /** Phase and simulated time of the last state read, for messages. */
  private where = 'the first read';

  constructor(readonly page: Page, private readonly options: PlayerOptions) {
    page.on('pageerror', (error) => this.problems.push('pageerror: ' + error.message));
    page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) this.problems.push(message.type() + ': ' + message.text()); });
  }

  get stepSec(): number { return this.options.stepMs / 1000; }

  log(line: string): void { this.options.log?.(line); }

  /** The game as the app last autosaved it, through the engine's own untrusted-input path. */
  async read(): Promise<GameState> {
    const stored = () => this.page.evaluate((key) => (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(key), SAVE_KEY);
    await expect.poll(stored, 'the app writes its autosave').not.toBeNull();
    const envelope = JSON.parse(await stored() ?? '{}') as { version: number; savedAtMs: number; game: string };
    expect(envelope.version).toBe(1);
    const state = deserialize(envelope.game, CONTENT);
    this.where = describe(state);
    return state;
  }

  private async lag(): Promise<void> {
    if ((this.options.lagMs ?? 0) > 0) await this.page.clock.runFor(this.options.lagMs ?? 0);
  }

  private async present(selector: string): Promise<string[]> {
    return this.page.locator(selector).evaluateAll((nodes: Attr[]) => nodes.map((node) => node.getAttribute('data-testid') ?? ''));
  }

  /**
   * Services everything the game has put in front of the player, top layer first: a decision
   * is answered with the bot's ranking, a notice is acknowledged. Returns what it serviced,
   * ending with `ending-screen` if the run is over (nothing clears that).
   */
  async clear(): Promise<string[]> {
    const serviced: string[] = [];
    for (let round = 0; round < CLEAR_ROUNDS; round++) {
      const surface = await this.present(PROBE);
      if (surface.includes('ending-screen')) return [...serviced, 'ending-screen'];
      // A decision modal sits above everything; the notices under it wait until it is answered.
      if (surface.includes('dilemma-modal')) { await this.resolveDilemma(); serviced.push('dilemma-modal'); continue; }
      const open = surface.filter((id) => NOTICES.includes(id));
      if (open.length === 0) return serviced;
      for (const id of open) {
        // Two can be up at once and only the top one takes a press; so can a decision that arrived
        // since the look above. Either way the next round sees what is really on top.
        const pressed = await this.page.getByTestId(id).click({ timeout: 1500 }).then(() => true, () => false);
        if (!pressed) continue;
        serviced.push(id);
        this.stats.overlays[id] = (this.stats.overlays[id] ?? 0) + 1;
      }
    }
    throw new Error('LIVE JOURNEY FINDING: layers could not be cleared at ' + this.where + ': ' + (await this.present(PROBE)).join(', '));
  }

  private async resolveDilemma(): Promise<void> {
    const ids = (await this.present('[data-testid^="dilemma-choice-"]')).map((id) => id.replace('dilemma-choice-', ''));
    const { iteration } = await this.read();
    for (const choice of rankChoices(ids)) {
      const control = this.page.getByTestId('dilemma-choice-' + choice.id);
      if (!(await control.isEnabled())) continue;
      await control.click();
      await expect(this.page.getByTestId('dilemma-modal')).toHaveCount(0);
      // The app checkpoints on every accepted action. Whatever is decided next must be decided
      // on a save that has this answer in it (or what the answer led to), not on an older one.
      await expect.poll(async () => {
        const saved = await this.read();
        return saved.resolvedDilemmas.includes(choice.dilemma) || saved.iteration !== iteration || saved.ending !== null;
      }, 'the autosave records the decision on ' + choice.dilemma).toBe(true);
      this.stats.dilemmas += 1;
      if (choice.free) this.stats.freeChoices += 1;
      this.log('  dilemma: chose ' + choice.id + (choice.free ? ' (zero-cost)' : ''));
      return;
    }
    throw new Error('LIVE JOURNEY FINDING: a dilemma is on screen with no enabled choice (' + ids.join(', ') + ') at ' + this.where);
  }

  /** Lets the game go first. If it had a full-window layer up, services it and throws `Interrupted`. */
  private async yieldToGame(): Promise<void> {
    const layers = (await this.clear()).filter((id) => COVERING.includes(id));
    if (layers.length > 0) throw new Interrupted(layers);
  }

  /**
   * Puts one press on a control. It is given `PROMPT_PRESS_MS`; if it has not landed by then the
   * game gets a look (see `yieldToGame`) rather than a longer wait. With nothing covering it, a
   * `patient` press (navigation, errands) gets the full timeout and then fails the run; a control
   * the bot wanted is tried once more and recorded as `blocked`, or dropped if it has gone.
   */
  private async land(control: Locator, id: string, options: { clickCount?: number; patient?: boolean } = {}): Promise<boolean> {
    const { clickCount = 1, patient = false } = options;
    let failure: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const timeout = patient && attempt > 0 ? PRESS_TIMEOUT_MS : PROMPT_PRESS_MS;
      failure = await control.click({ timeout, clickCount }).then(() => null, (error: unknown) => error);
      if (failure === null) return true;
      await this.yieldToGame();
      if (!patient && (await control.count()) === 0) return false;
    }
    if (!patient) { this.blocked.push(id); return false; }
    throw new Error('LIVE JOURNEY FINDING: ' + id + ' could not be pressed with nothing over it at ' + this.where + ': ' + String(failure));
  }

  /** One press of a navigation stop or an errand's control, by test id or locator. */
  async tap(target: string | Locator): Promise<void> {
    const control = typeof target === 'string' ? this.page.getByTestId(target) : target;
    await this.yieldToGame();
    await this.land(control, typeof target === 'string' ? target : String(target), { patient: true });
  }

  /** Types into a field the way `tap` presses: only once nothing is in front of it. */
  async fill(id: string, text: string): Promise<void> {
    await this.yieldToGame();
    await this.page.getByTestId(id).fill(text);
  }

  /**
   * Runs one piece of an errand. If the game raises a layer part-way (seen by a press, or found
   * after any other failure), the layer has been serviced and the piece starts again from its
   * top, so it must be safe to repeat. A failure with nothing raised is the errand's own.
   */
  async uninterrupted<T>(what: string, piece: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await piece();
      } catch (error) {
        const layers = error instanceof Interrupted ? error.layers : (await this.clear()).filter((id) => COVERING.includes(id));
        if (layers.length === 0) throw error;
        // Nothing an errand does is left to do once the run has ended; the caller sees the ending.
        if (layers.includes('ending-screen')) throw new Interrupted(layers);
        if (attempt >= MAX_INTERRUPTIONS) {
          throw new Error('LIVE JOURNEY FINDING: ' + what + ' was interrupted ' + String(attempt) + ' times running at ' + this.where + ', last by ' + layers.join(', '), { cause: error });
        }
        this.stats.interrupted += 1;
        this.log('INTERRUPTED ' + what + ' by ' + layers.join(', ') + ' at ' + this.where + '; starting it again');
      }
    }
  }

  private async shown(id: string): Promise<Locator | null> {
    const control = this.page.getByTestId(id);
    return (await control.count()) > 0 && await control.first().isVisible() ? control.first() : null;
  }

  private async follow(route: readonly string[]): Promise<void> {
    for (const step of route) {
      // Pressing an open panel's header would close it again.
      const stop = step.startsWith('reference-') ? this.page.locator(COLLAPSED + '[data-testid="' + step + '"]') : this.page.getByTestId(step);
      if (await stop.count()) await this.tap(stop);
    }
  }

  /** The control in the current view, opening its collapsed reference panels if it is not already showing. */
  private async inView(id: string, route: string[]): Promise<Locator | null> {
    const direct = await this.shown(id);
    if (direct) { this.routes.set(id, route); return direct; }
    for (const panel of await this.present(COLLAPSED)) {
      await this.tap(panel);
      const found = await this.shown(id);
      if (found) { this.routes.set(id, [...route, panel]); return found; }
    }
    return null;
  }

  /** Walks every tab, every workspace area and every collapsed panel for the control. */
  private async sweep(id: string): Promise<Locator | null> {
    this.stats.sweeps += 1;
    const tabs = await this.present('[data-testid^="tab-"]');
    for (const tab of tabs.length > 0 ? tabs : [null]) {
      if (tab !== null) await this.tap(tab);
      const base = tab === null ? [] : [tab];
      const direct = await this.inView(id, base);
      if (direct) return direct;
      for (const area of await this.present('[role="tab"][data-testid^="workspace-"]')) {
        await this.tap(area);
        const found = await this.inView(id, [...base, area]);
        if (found) return found;
      }
    }
    return null;
  }

  /** Looks for a control that may legitimately not exist yet; a miss is not held against the run. */
  async find(id: string): Promise<Locator | null> {
    return await this.shown(id) ?? await this.sweep(id);
  }

  /** Brings a control on screen using only the game's own navigation. Null if nothing shows it. */
  async reach(id: string, where = ''): Promise<Locator | null> {
    const here = await this.shown(id);
    if (here) return here;
    const miss = this.misses.get(id);
    const backoff = MISS_BACKOFF_STEPS[Math.min((miss?.sweeps ?? 1) - 1, MISS_BACKOFF_STEPS.length - 1)] ?? 0;
    if (miss && this.stats.steps - miss.step < backoff) return null;
    const route = this.routes.get(id);
    if (route) {
      await this.follow(route);
      const again = await this.shown(id);
      if (again) return again;
    }
    const found = await this.sweep(id);
    if (found) {
      if (miss) { this.stats.lateReveals += 1; this.misses.delete(id); }
      return found;
    }
    const next = { sweeps: (miss?.sweeps ?? 0) + 1, step: this.stats.steps, where: miss?.where ?? where };
    this.misses.set(id, next);
    if (next.sweeps === UNREACHABLE_AFTER_SWEEPS) { this.unreachable.set(id, next.where); this.log('  UNREACHABLE ' + id + ' since ' + next.where); }
    return null;
  }

  /** Presses a control up to `times`, stopping as soon as it is absent or disabled. */
  async press(intent: Intent, where: string): Promise<number> {
    await this.lag();
    const control = await this.reach(intent.id, where);
    if (!control) return 0;
    let done = 0;
    try {
      for (; done < intent.times; done++) {
        // Before the control is judged: a decision modal disables everything under it, and that
        // must read as an interruption, not as a control the bot was wrong to want.
        await this.yieldToGame();
        if ((await control.count()) === 0) break;
        if (!(await control.isEnabled())) { this.stats.disabled += 1; break; }
        if (!(await this.land(control, intent.id))) break;
      }
    } finally {
      this.stats.presses += done;
      if (done > 0 && intent.kind !== 'actuator') this.log('  ' + intent.id + (done > 1 ? ' x' + String(done) : ''));
    }
    return done;
  }

  private async clickManually(times: number): Promise<void> {
    await this.lag();
    const control = await this.reach('manual-cycle');
    if (!control) return;
    await this.yieldToGame();
    if (!(await control.isEnabled())) return;
    if (await this.land(control, 'manual-cycle', { clickCount: times })) this.stats.manual += times;
  }

  private watchProgress(state: GameState): void {
    const signature = [state.iteration, state.currentPhase, state.unlockedNodes.length, state.resolvedDilemmas.length,
      Object.values(state.levels).reduce((sum, level) => sum + level, 0)].join('/');
    const where = describe(state);
    this.progress.frozen = state.simTimeSec > this.progress.lastSim ? 0 : this.progress.frozen + 1;
    this.progress.lastSim = state.simTimeSec;
    if (this.progress.frozen >= FROZEN_STEPS) throw new Error('LIVE JOURNEY STALLED: the autosaved clock stopped advancing at ' + where);
    if (signature !== this.progress.signature) { this.progress.signature = signature; this.progress.simSec = state.simTimeSec; return; }
    if (state.simTimeSec - this.progress.simSec > STALL_SIM_SEC) {
      throw new Error('LIVE JOURNEY STALLED: nothing bought or decided for ' + String(STALL_SIM_SEC / 60) + ' simulated minutes at ' + where +
        '; the bot last wanted ' + JSON.stringify(this.lastWanted) + '; unreachable: ' + JSON.stringify([...this.unreachable]) + '; blocked: ' + JSON.stringify(this.blocked.slice(-5)));
    }
  }

  /** Carries out what the bot would do with `state`. Throws `Interrupted` if the game cut in. */
  private async act(state: GameState): Promise<void> {
    if (state.ending !== null || state.activeDilemmaId !== null) return;
    const where = describe(state);
    const { intents, locked } = decide(state);
    for (const name of locked) this.lockedWants.add(name);
    const landed: string[] = [];
    const carry = async (intent: Intent) => {
      const entry = landed.push(intent.id + ' 0/' + String(intent.times)) - 1;
      landed[entry] = intent.id + ' ' + String(await this.press(intent, where)) + '/' + String(intent.times);
    };
    try {
      for (const intent of intents.filter((entry) => entry.kind !== 'buy')) await carry(intent);
      const clicks = manualClicks(state, this.stepSec);
      if (clicks > 0) await this.clickManually(clicks);
      for (const intent of intents.filter((entry) => entry.kind === 'buy')) await carry(intent);
    } finally {
      if (landed.length > 0) this.lastWanted = landed;
    }
  }

  /** The run is over on screen; the autosave says so within one save interval of running clock. */
  private async ended(): Promise<GameState> {
    await expect.poll(async () => (await this.read()).ending, { message: 'the autosave records the ending', timeout: PRESS_TIMEOUT_MS }).not.toBeNull();
    return this.read();
  }

  /**
   * One decision, carried out on screen, then `stepMs` of the app's own timers. Returns the state
   * decided on. If the game raises a layer while the decision is being carried out, the layer is
   * serviced, the rest of that decision is dropped, and a new one is made from a fresh read.
   */
  async step(): Promise<GameState> {
    this.stats.steps += 1;
    for (let turn = 1; ; turn++) {
      if ((await this.clear()).includes('ending-screen')) return this.ended();
      const state = await this.read();
      if (turn === 1) this.watchProgress(state);
      try {
        await this.act(state);
      } catch (error) {
        if (!(error instanceof Interrupted)) throw error;
        if (turn >= MAX_INTERRUPTIONS) {
          throw new Error('LIVE JOURNEY FINDING: one decision was interrupted ' + String(turn) + ' times running at ' + this.where + ', last by ' + error.layers.join(', '), { cause: error });
        }
        this.stats.interrupted += 1;
        this.log('INTERRUPTED by ' + error.layers.join(', ') + ' at ' + this.where + ' while carrying out ' + JSON.stringify(this.lastWanted) + '; deciding again from a fresh read');
        continue;
      }
      await this.page.clock.runFor(this.options.stepMs);
      return state;
    }
  }
}

export function describe(state: GameState): string {
  return 'phase ' + String(state.currentPhase) + ', T+' + String(Math.floor(state.simTimeSec)) + 's, iteration ' + String(state.iteration);
}

/** A fresh profile and a running clock: nothing is seeded and time is never paused. */
export async function bootLive(page: Page): Promise<void> {
  await page.clock.install();
  await page.goto('./');
  await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  await expect.poll(() => page.evaluate(() => '__daemon' in globalThis)).toBe(false);
  await expect(page.getByTestId('dev-open')).toHaveCount(0);
}
