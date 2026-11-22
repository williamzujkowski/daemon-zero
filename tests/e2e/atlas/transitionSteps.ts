/**
 * Triggers and helpers the transitions table shares: real UI steps (a purchase by what the node does, a dilemma's
 * zero-cost choice, a play loop), clock conditions read from the page, and the engine's own count of how many ticks
 * pass before an event, so a long wait is one clock step and the before-frame is still one tick earlier.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../../src/content';
import { computeRates, deserialize, tick, type GameState } from '../../../src/engine';
import { nodeWhere } from './sources';
import { openChoices } from '../helpers';

/** The phase exit that is neither a grant nor an acquisition: the purchase a player makes to cross a boundary. */
export const phaseExit = (phase: number) => nodeWhere((node) => node.phaseId === phase && node.effects.unlocksPhase === phase + 1
  && node.grant === undefined && node.acquisition === undefined, `the phase ${String(phase)} exit`);

/** The node that unlocks a widget, found by the widget it unlocks. */
export const unlocking = (widget: string, phase?: number) => nodeWhere((node) => node.unlocksUiComponent === widget
  && (phase === undefined || node.phaseId === phase), 'the node unlocking ' + widget);

/** Ticks the engine runs from `state` before `event` holds, less a margin; 0 when it never holds within `ceiling`. */
export function ticksBefore(state: GameState, event: (game: GameState) => boolean, ceiling: number, margin = 20): number {
  let game = state;
  for (let ticks = 0; ticks < ceiling; ticks++) {
    if (event(game)) return Math.max(0, ticks - margin);
    game = tick(game, 1 / CONTENT.balance.tickHz, CONTENT);
  }
  return 0;
}

/** A labelled before-state recipe one engine step earlier than a saved stage, through the codec as fixtures are. */
export function earlier(state: GameState, patch: Partial<GameState>): GameState {
  const parsed = deserialize(JSON.stringify({ ...state, ...patch }), CONTENT);
  return { ...parsed, rates: computeRates(parsed, CONTENT) };
}

export const attached = (testId: string) => async (page: Page): Promise<boolean> => await page.getByTestId(testId).count() > 0;

/** The number a readout shows (the AEGIS lock "90.1 / 100%"), or NaN while it is not rendered. */
export const shown = (testId: string) => async (page: Page): Promise<number> => {
  if (await page.getByTestId(testId).count() === 0) return Number.NaN;
  return Number.parseFloat(await page.getByTestId(testId).first().textContent() ?? '');
};

export async function clickIfPresent(page: Page, testId: string): Promise<void> {
  if (await page.getByTestId(testId).count() > 0) await page.getByTestId(testId).first().click();
}

const TICK_MS = Math.ceil(1000 / CONTENT.balance.tickHz);

/** Runs the clock in one-second steps until a control is enabled (a purchase the player waits to afford). */
export async function waitEnabled(page: Page, testId: string, seconds: number): Promise<void> {
  for (let second = 0; second < seconds; second++) {
    if (await page.getByTestId(testId).isEnabled().catch(() => false)) return;
    await page.clock.runFor(1000);
  }
  throw new Error(`${testId} not enabled within ${String(seconds)} s`);
}

/** Scrolls the first purchase that sits below its scroll's fold into view, as a player reaching for it does. */
export async function scrollToBuy(page: Page): Promise<void> {
  const purchases = page.locator('[data-testid^="node-"][data-testid$="-unlock"], [data-testid^="rep-"][data-testid$="-buy"]');
  const below = await purchases.evaluateAll((nodes) => {
    type Box = { top: number; bottom: number; height: number };
    type Node = { getAttribute(name: string): string | null; getBoundingClientRect(): Box; closest(selector: string): Node | null };
    const { innerHeight } = globalThis as unknown as { innerHeight: number };
    const fold = (node: Node) => Math.min(innerHeight, node.closest('[data-testid^="pane-scroll-"], [data-testid="terminal-primary-scroll"]')?.getBoundingClientRect().bottom ?? innerHeight);
    return (nodes as unknown as Node[]).find((node) => node.getBoundingClientRect().height > 0 && node.getBoundingClientRect().top >= fold(node))?.getAttribute('data-testid') ?? null;
  });
  if (below === null) throw new Error('No purchase below the fold to scroll to');
  await page.getByTestId(below).scrollIntoViewIfNeeded();
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The active dilemma's first zero-cost choice, clicked as a player commits it. */
export async function chooseFree(page: Page, state: GameState): Promise<void> {
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === state.activeDilemmaId);
  const free = dilemma?.choices.find((choice) => Object.values(choice.cost).every((amount) => amount === 0));
  if (free === undefined) throw new Error('No zero-cost choice in the active dilemma');
  await openChoices(page);
  await page.getByRole('dialog').getByRole('button', { name: new RegExp('^Commit directive: ' + escape(free.label)) }).click();
}

/** The disclosure walk's play loop: press EXECUTE every tick, and every tenth press buy the first enabled purchase. */
export async function play(page: Page, presses: number): Promise<void> {
  const purchase = page.locator('[data-testid^="node-"][data-testid$="-unlock"]:not([aria-disabled="true"])');
  for (let press = 1; press <= presses; press++) {
    await page.getByTestId('manual-cycle').click();
    if (press % 10 === 0 && await purchase.count() > 0) await purchase.first().click();
    await page.clock.runFor(TICK_MS);
  }
}

/** Presses EXECUTE once a tick until `done` holds (a card the presses bring into reach), at most `presses` times. */
export async function pressUntil(page: Page, done: () => Promise<boolean>, presses: number): Promise<void> {
  for (let press = 0; press < presses; press++) {
    if (await done()) return;
    await page.getByTestId('manual-cycle').click();
    await page.clock.runFor(TICK_MS);
  }
  if (!await done()) throw new Error(`not reached within ${String(presses)} presses`);
}

/** The dilemma a node's purchase schedules, and the first words of its omen: what its log line must announce. */
export function omenOf(nodeId: string): RegExp {
  const dilemma = CONTENT.dilemmas.find((entry) => entry.trigger.nodes?.includes(nodeId) === true);
  if (dilemma?.omen === undefined) throw new Error('No omen scheduled by ' + nodeId);
  return new RegExp(escape(dilemma.omen.slice(0, 24)));
}
