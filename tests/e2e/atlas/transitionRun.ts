/**
 * One transition cell end to end (#339): open the before-state as the atlas opens its stage, run the row's setup,
 * measure the before-frame, install the announcement observer, run the trigger (a real UI action or the paused
 * clock), let one tick pass, then measure the after-frame and evaluate C1, C2 and B5. Reads stage rows and their
 * composed contracts by reference; never copies a timely set.
 */
import { test, type Locator, type Page } from '@playwright/test';
import type { Window } from 'happy-dom';
import { CONTENT } from '../../../src/content';
import type { GameState } from '../../../src/engine';
import type { Rect } from '../audit/metrics';
import { installObserver, readObserver, tabNames, type Observed } from './announce';
import { TRANSITION_ATTACHMENT } from './attachments';
import { composeContract, type Contract } from './compose';
import { CORE_ITEMS } from './contract';
import { itemLocator, measureContract, visiblePanes, type ItemMeasure } from './contractCheck';
import type { ContractItem } from './contractTypes';
import type { GateFailure } from './gates';
import { openStage } from './open';
import { stageState } from './sources';
import { STAGES } from './stages';
import { displacement, transitionFailures, type PointerTarget, type TransitionFailure } from './transitionCheck';
import { checksOf, type TransitionCheck, type TransitionRow, type Trigger } from './transitionTypes';
import type { StageRow } from './types';

type DomElement = NonNullable<ReturnType<Window['document']['querySelector']>>;
const TICK_MS = Math.ceil(1000 / CONTENT.balance.tickHz);

export interface TransitionRecord {
  order: number; id: string; viewport: string; project: string; before: string; recipe: string | null;
  trigger: string; checks: TransitionCheck[]; walk: readonly string[]; why: string;
  observed: Observed; tabsBefore: Record<string, string>; appear: ItemMeasure | null; kept: ItemMeasure[];
  primary: { before: Rect | null; after: Rect | null; displacement: number | null };
  pointer: { clicked: string; after: PointerTarget | null } | null;
  failures: TransitionFailure[];
  /** Filled by the spec after reconciling with TRANSITION_GAPS. */
  knownGaps: string[];
}

export function stageRow(id: string): StageRow {
  const row = STAGES.find((entry) => entry.id === id);
  if (row === undefined) throw new Error('No atlas stage named ' + id);
  return row;
}

/** The stage row the before-state opens: the referenced row, with its recipe, its prepare left out or its reach replaced. */
export function beforeRow(row: TransitionRow): StageRow {
  const { before } = row;
  const { prepare, patch, ...base } = stageRow(before.stage);
  const recipe = before.patch;
  const combined = recipe === undefined ? patch : (game: GameState) => recipe.apply(patch ? patch(game) : game);
  return {
    ...base, ...(combined === undefined ? {} : { patch: combined }),
    ...(before.prepare === 'skip' || prepare === undefined ? {} : { prepare }),
    ...(before.reach === undefined ? {} : { reach: before.reach }),
  };
}

const describeTrigger = (trigger: Trigger): string => trigger.kind === 'click' ? 'click ' + trigger.testId : trigger.label;

async function boxOf(locator: Locator): Promise<Rect | null> {
  return await locator.count() === 0 ? null : locator.boundingBox();
}

async function measureOne(page: Page, item: ContractItem): Promise<ItemMeasure> {
  const contract: Contract = { surfaces: [], items: [item], top: null };
  const [measured] = await measureContract(page, contract);
  if (measured === undefined) throw new Error('No measure for ' + item.key);
  return measured;
}

/** The widest clip inside the item: how many px of its own text its box hides (ellipsis, clamp or overflow). */
async function truncatedPx(locator: Locator): Promise<number> {
  if (await locator.count() === 0) return 0;
  return locator.evaluate((node) => {
    const browser = globalThis as unknown as Window;
    const root = node as unknown as DomElement;
    let widest = 0;
    for (const element of [root, ...root.querySelectorAll('*')]) {
      const style = browser.getComputedStyle(element);
      const clips = style.overflowX !== 'visible' || style.textOverflow === 'ellipsis';
      const { scrollWidth, clientWidth } = element as unknown as { scrollWidth: number; clientWidth: number };
      if (clips && element.textContent !== '') widest = Math.max(widest, scrollWidth - clientWidth);
    }
    return widest;
  });
}

/** The control a pointer at `point` would hit now, or null when nothing interactive is there. */
async function pointerTarget(page: Page, point: { x: number; y: number }): Promise<PointerTarget | null> {
  return page.evaluate(({ x, y }) => {
    const { document } = globalThis as unknown as Window;
    const control = document.elementFromPoint(x, y)?.closest('button, a[href], [role="button"], [role="tab"], [role="switch"], [role="link"]') ?? null;
    if (control === null) return null;
    const enabled = control.getAttribute('aria-disabled') !== 'true' && !control.hasAttribute('disabled');
    return { testId: control.getAttribute('data-testid'), interactive: true, enabled };
  }, point);
}

/** The first node card title rendered in a pane, as a transition-local item (a card title has no role of its own). */
async function firstCard(page: Page): Promise<ContractItem> {
  const testId = await page.locator('[data-testid^="pane-scroll-"] [data-testid$="-title"]').evaluateAll((nodes) =>
    (nodes as unknown as DomElement[]).find((node) => /^node-[a-z0-9_]+-title$/.test(node.getAttribute('data-testid') ?? '')
      && node.getBoundingClientRect().height > 0 && node.closest('[aria-hidden="true"]') === null)?.getAttribute('data-testid') ?? null);
  return { key: 'first-card', kind: 'timely', rank: 99, locate: { by: 'test-id', testId: testId ?? 'node-none-title', why: 'a node card title has no role of its own' } };
}

/** The C2 set after the trigger: the referenced stage's timely items composed for the panes now shown, and extras. */
async function keptItems(page: Page, row: TransitionRow, before: StageRow): Promise<ItemMeasure[]> {
  const { keep } = row;
  if (keep === undefined) return [];
  const reference = keep.stage === undefined ? before : stageRow(keep.stage);
  const state = stageState(reference);
  const contract = composeContract({ state, panes: await visiblePanes(page), route: reference.overrides?.route ?? [],
    overlay: keep.withoutOverlay === true ? null : reference.overrides?.overlay ?? null });
  const wanted = new Set(keep.alsoInView ?? []);
  const items = contract.items.filter((item) => item.kind === 'timely' || wanted.has(item.key));
  const missing = [...wanted].filter((key) => !items.some((item) => item.key === key));
  if (missing.length > 0) throw new Error(`${row.id}: ${missing.join(', ')} not in the contract of ${reference.id}`);
  if (keep.firstCard === true) items.push(await firstCard(page));
  return measureContract(page, { ...contract, items });
}

/**
 * Runs the paused clock until the trigger's condition holds. When `steady`, returns the primary box of the last frame
 * before it held (undefined when it held at once, so the caller keeps the frame it measured before the trigger).
 */
async function runClock(page: Page, trigger: Extract<Trigger, { kind: 'clock' }>, row: StageRow, steady: boolean): Promise<Rect | null | undefined> {
  const lead = trigger.lead?.(stageState(row)) ?? 0;
  if (lead > 0) await page.clock.runFor(lead * TICK_MS);
  const core = itemLocator(page, CORE_ITEMS[0] ?? missingCore());
  let previous: Rect | null | undefined;
  for (let ticks = 0; ticks <= trigger.ceiling; ticks++) {
    if (await trigger.until(page)) return previous;
    if (steady) previous = await boxOf(core);
    await page.clock.runFor(TICK_MS);
  }
  throw new Error(`${trigger.label}: not reached within ${String(lead)} + ${String(trigger.ceiling)} ticks`);
}

function missingCore(): never {
  throw new Error('The contract map has no CORE primary action');
}

interface Frame { primary: Rect | null; tabs: Record<string, string>; pointer: { clicked: string; point: { x: number; y: number } } | null }

async function beforeFrame(page: Page, row: TransitionRow): Promise<Frame> {
  const { trigger } = row;
  let pointer: Frame['pointer'] = null;
  if (trigger.kind === 'click') {
    const target = page.getByTestId(trigger.testId).first();
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (box !== null) pointer = { clicked: trigger.testId, point: { x: box.x + box.width / 2, y: box.y + box.height / 2 } };
  }
  return { primary: await boxOf(itemLocator(page, CORE_ITEMS[0] ?? missingCore())), tabs: await tabNames(page), pointer };
}

async function fire(page: Page, row: TransitionRow, before: StageRow, frame: Frame): Promise<Rect | null> {
  const { trigger } = row;
  let primary = frame.primary;
  if (trigger.kind === 'click') {
    // A one-way purchase asks first (UI-SPEC "Destructive actions"): read before the press, confirmed after it.
    const oneWay = trigger.testId.endsWith('-unlock') && ((await page.getByTestId(trigger.testId).first().textContent()) ?? '').includes('ONE WAY');
    if (frame.pointer === null) await page.getByTestId(trigger.testId).first().click();
    else await page.mouse.click(frame.pointer.point.x, frame.pointer.point.y);
    if (oneWay) await page.getByTestId(trigger.testId + '-confirm').click();
  } else if (trigger.kind === 'ui') await trigger.run(page);
  else {
    const last = await runClock(page, trigger, before, row.steady === true);
    if (last !== undefined) primary = last;
  }
  // One tick passes, as it would for a player, so effects and timers the change schedules can run.
  await page.clock.runFor(TICK_MS);
  return primary;
}

async function appearInput(page: Page, row: TransitionRow, before: StageRow) {
  const { appear } = row;
  if (appear === undefined) return undefined;
  const item = appear.item(stageState(before));
  const measured = await measureOne(page, item);
  const panes: readonly string[] = await visiblePanes(page);
  return {
    item: measured, inDialog: item.inDialog === true, pane: item.pane ?? null, paneShown: item.pane === undefined || panes.includes(item.pane),
    truncatedPx: await truncatedPx(itemLocator(page, item)),
    ...(appear.announce === undefined ? {} : { announce: appear.announce }), ...(appear.alerts === undefined ? {} : { alerts: appear.alerts }),
    ...(appear.focus === undefined ? {} : { focus: appear.focus }),
  };
}

/** Opens, triggers and measures one transition cell; the record's failures are not yet reconciled with known gaps. */
export async function runTransition(page: Page, row: TransitionRow, order: number, viewport: string): Promise<TransitionRecord> {
  const before = beforeRow(row);
  await openStage(page, before);
  if (row.setup) await row.setup(page);
  const frame = await beforeFrame(page, row);
  await installObserver(page);
  const primaryBefore = await fire(page, row, before, frame);
  const observed = await readObserver(page);
  const appear = await appearInput(page, row, before);
  const kept = await keptItems(page, row, before);
  const core = await measureOne(page, CORE_ITEMS[0] ?? missingCore());
  const pointer = frame.pointer === null || row.keep?.pointer !== true ? undefined
    : { clicked: frame.pointer.clicked, after: await pointerTarget(page, frame.pointer.point) };
  const failures = transitionFailures({ id: row.id, viewport, observed, tabsBefore: frame.tabs, kept,
    primary: { before: primaryBefore, after: core, kept: row.keep?.primary === true, steady: row.steady === true },
    ...(appear === undefined ? {} : { appear }), ...(pointer === undefined ? {} : { pointer }) });
  return {
    order, id: row.id, viewport, project: test.info().project.name, before: row.before.stage,
    recipe: row.before.patch?.recipe ?? null, trigger: describeTrigger(row.trigger), checks: checksOf(row),
    walk: row.walk, why: row.why, observed, tabsBefore: frame.tabs, appear: appear?.item ?? null, kept,
    primary: { before: primaryBefore, after: core.found ? core.box : null, displacement: displacement(primaryBefore, core.found ? core.box : null) },
    pointer: pointer ?? null, failures, knownGaps: [],
  };
}

/** Attaches the record once the spec has marked which failures are recorded gaps. */
export async function attachTransition(record: TransitionRecord, known: readonly GateFailure<string>[], format: (f: GateFailure<string>) => string): Promise<void> {
  record.knownGaps = known.map(format);
  await test.info().attach(TRANSITION_ATTACHMENT, { body: JSON.stringify(record, null, 2), contentType: 'application/json' });
}
