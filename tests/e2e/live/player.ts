/**
 * A player that only presses what is on screen, on a clock that is running.
 * It reads the app's own autosave to decide (never writes it), asks the unmodified careful
 * sim bot what to do, and carries each move out through a visible, enabled control.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { CONTENT } from '../../../src/content';
import { deserialize, type GameState } from '../../../src/engine';
import { decide, manualClicks, rankChoices, type Intent } from './intents';

const SAVE_KEY = 'daemon-zero.save.v1';
const OVERLAYS = ['reboot-continue', 'phase-threshold-continue', 'lineage-reveal-continue', 'response-acknowledge'];
const PROBE = ['ending-screen', 'dilemma-modal', ...OVERLAYS].map((id) => '[data-testid="' + id + '"]').join(',');
const COLLAPSED = '[data-testid^="reference-"][aria-expanded="false"]';
/** Steps to wait before sweeping again for a control that one, two, three... sweeps did not find. */
const MISS_BACKOFF_STEPS = [2, 4, 12];
/** A reveal can lag a purchase by an animation; this many empty sweeps in a row is not lag. */
const UNREACHABLE_AFTER_SWEEPS = 3;
/** No purchase, decision, phase or iteration change for this long is a stall, not patience. */
const STALL_SIM_SEC = 25 * 60;
const FROZEN_STEPS = 40;

interface Attr { getAttribute(name: string): string | null }
interface Storage { getItem(key: string): string | null }

export interface PlayerOptions { stepMs: number; log?: (line: string) => void }

export class LivePlayer {
  /** Browser console warnings/errors and page errors, in arrival order. */
  readonly problems: string[] = [];
  /** Controls the bot wanted that repeated sweeps of every tab, area and collapsed panel never showed: id -> where first missed. */
  readonly unreachable = new Map<string, string>();
  /** Actuator moves the bot asked for before the game had shown the player that control. */
  readonly lockedWants = new Set<string>();
  /** Presses that were refused because something still covered the control after a dismissal. */
  readonly blocked: string[] = [];
  readonly stats = { steps: 0, presses: 0, manual: 0, dilemmas: 0, freeChoices: 0, disabled: 0, sweeps: 0, lateReveals: 0, overlays: {} as Record<string, number> };
  private readonly routes = new Map<string, string[]>();
  private readonly misses = new Map<string, { sweeps: number; step: number; where: string }>();
  /** What the bot last asked for, and how many of each press landed; quoted when the run stalls. */
  private lastWanted: string[] = [];
  private progress = { signature: '', simSec: 0, frozen: 0, lastSim: -1 };

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
    return deserialize(envelope.game, CONTENT);
  }

  private async present(selector: string): Promise<string[]> {
    return this.page.locator(selector).evaluateAll((nodes: Attr[]) => nodes.map((node) => node.getAttribute('data-testid') ?? ''));
  }

  /** Acknowledges every story overlay on screen; returns the ones it closed. */
  async dismiss(): Promise<string[]> {
    const closed: string[] = [];
    for (let round = 0; round < 6; round++) {
      const surface = await this.present(PROBE);
      // A decision modal sits above everything; the notices under it wait until it is answered.
      if (surface.includes('dilemma-modal')) return closed;
      const open = surface.filter((id) => OVERLAYS.includes(id));
      if (open.length === 0) break;
      for (const id of open) {
        // Two can be up at once and only the top one takes a press; the other waits a round.
        const pressed = await this.page.getByTestId(id).click({ timeout: 1500 }).then(() => true, () => false);
        if (!pressed) continue;
        closed.push(id);
        this.stats.overlays[id] = (this.stats.overlays[id] ?? 0) + 1;
      }
    }
    const stuck = (await this.present(PROBE)).filter((id) => OVERLAYS.includes(id));
    if (stuck.length > 0) throw new Error('LIVE JOURNEY FINDING: story overlays could not be acknowledged: ' + stuck.join(', '));
    return closed;
  }

  private async resolveDilemma(): Promise<void> {
    const ids = (await this.present('[data-testid^="dilemma-choice-"]')).map((id) => id.replace('dilemma-choice-', ''));
    for (const choice of rankChoices(ids)) {
      const control = this.page.getByTestId('dilemma-choice-' + choice.id);
      if (!(await control.isEnabled())) continue;
      await control.click();
      await expect(this.page.getByTestId('dilemma-modal')).toHaveCount(0);
      this.stats.dilemmas += 1;
      if (choice.free) this.stats.freeChoices += 1;
      this.log('  dilemma: chose ' + choice.id + (choice.free ? ' (zero-cost)' : ''));
      return;
    }
    throw new Error('LIVE JOURNEY FINDING: a dilemma is on screen with no enabled choice (' + ids.join(', ') + ')');
  }

  private async shown(id: string): Promise<Locator | null> {
    const control = this.page.getByTestId(id);
    return (await control.count()) > 0 && await control.first().isVisible() ? control.first() : null;
  }

  private async follow(route: readonly string[]): Promise<void> {
    for (const step of route) {
      // Pressing an open panel's header would close it again.
      const stop = step.startsWith('reference-') ? this.page.locator(COLLAPSED + '[data-testid="' + step + '"]') : this.page.getByTestId(step);
      if (await stop.count()) await stop.click();
    }
  }

  /** The control in the current view, opening its collapsed reference panels if it is not already showing. */
  private async inView(id: string, route: string[]): Promise<Locator | null> {
    const direct = await this.shown(id);
    if (direct) { this.routes.set(id, route); return direct; }
    for (const panel of await this.present(COLLAPSED)) {
      await this.page.getByTestId(panel).click();
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
      if (tab !== null) await this.page.getByTestId(tab).click();
      const base = tab === null ? [] : [tab];
      const direct = await this.inView(id, base);
      if (direct) return direct;
      for (const area of await this.present('[role="tab"][data-testid^="workspace-"]')) {
        await this.page.getByTestId(area).click();
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

  private async click(control: Locator, id: string, clickCount = 1): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await control.click({ timeout: 2000, clickCount });
        return true;
      } catch {
        // A story overlay opened by the previous press covers the screen until acknowledged.
        await this.dismiss();
        if ((await control.count()) === 0) return false;
      }
    }
    this.blocked.push(id);
    return false;
  }

  /** Presses a control up to `times`, stopping as soon as it is absent or disabled. */
  async press(intent: Intent, where: string): Promise<number> {
    const control = await this.reach(intent.id, where);
    if (!control) return 0;
    let done = 0;
    for (; done < intent.times; done++) {
      if ((await control.count()) === 0) break;
      if (!(await control.isEnabled())) { this.stats.disabled += 1; break; }
      if (!(await this.click(control, intent.id))) break;
    }
    this.stats.presses += done;
    if (done > 0 && intent.kind !== 'actuator') this.log('  ' + intent.id + (done > 1 ? ' x' + String(done) : ''));
    return done;
  }

  private async clickManually(times: number): Promise<void> {
    const control = await this.reach('manual-cycle');
    if (!control || !(await control.isEnabled())) return;
    if (await this.click(control, 'manual-cycle', times)) this.stats.manual += times;
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

  /** One decision, carried out on screen, then `stepMs` of the app's own timers. Returns the state decided on. */
  async step(): Promise<GameState> {
    this.stats.steps += 1;
    const surface = await this.present(PROBE);
    if (surface.includes('ending-screen')) return this.read();
    if (surface.includes('dilemma-modal')) await this.resolveDilemma();
    if (surface.some((id) => OVERLAYS.includes(id))) await this.dismiss();
    const state = await this.read();
    this.watchProgress(state);
    if (state.ending === null && state.activeDilemmaId === null) {
      const where = describe(state);
      const { intents, locked } = decide(state);
      for (const name of locked) this.lockedWants.add(name);
      const landed: string[] = [];
      const carry = async (intent: Intent) => { landed.push(intent.id + ' ' + String(await this.press(intent, where)) + '/' + String(intent.times)); };
      for (const intent of intents.filter((entry) => entry.kind !== 'buy')) await carry(intent);
      const clicks = manualClicks(state, this.stepSec);
      if (clicks > 0) await this.clickManually(clicks);
      for (const intent of intents.filter((entry) => entry.kind === 'buy')) await carry(intent);
      if (landed.length > 0) this.lastWanted = landed;
    }
    await this.page.clock.runFor(this.options.stepMs);
    return state;
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
