/**
 * One axe-core run, shared by the original-route audit and the route audit so both enforce the same rule
 * sets. Includes `label-content-name-mismatch` (WCAG 2.5.3, tagged wcag21a), which is why a control
 * whose name leaves out the words it shows fails here (#275). That rule reads only text visible on
 * screen, so a control scrolled out of its pane is skipped without a word: `axeEachControl` brings
 * each control into view and audits it there.
 */
import type { Locator, Page } from '@playwright/test';
import path from 'node:path';

export const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

interface AxeViolation { id: string; impact: string; nodes: { target: string[] }[]; help: string }
interface AxeGlobal { axe: { run(context: unknown, options: unknown): Promise<{ violations: AxeViolation[] }> } }
export interface Finding { id: string; impact: string; help: string; nodes: number; sample: string[] }
/** Where `captureRealTimers` keeps the browser's own timers for `axeReport`. */
const REAL_TIMERS = '__daemonRealTimers';

async function injectAxe(page: Page): Promise<void> {
  const loaded = await page.evaluate(() => 'axe' in globalThis);
  if (!loaded) await page.addScriptTag({ path: path.join(process.cwd(), 'node_modules/axe-core/axe.min.js') });
}

/** Every violation on the page as it stands, with up to two sample targets each. */
export async function axeViolations(page: Page): Promise<Finding[]> {
  await injectAxe(page);
  return page.evaluate(async (rules) => {
    const { axe } = globalThis as unknown as AxeGlobal;
    const result = await axe.run({ exclude: [] }, { runOnly: rules, resultTypes: ['violations'] });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ')),
    }));
  }, RULES);
}

/**
 * Each button under `scope`, scrolled into view and audited on its own. Returns the violations and how
 * many controls were audited, so a caller can prove it reached the controls it is about.
 */
export async function axeEachControl(page: Page, scope: Locator): Promise<{ audited: number; violations: Finding[] }> {
  await injectAxe(page);
  const controls = await scope.getByRole('button').all();
  const violations: Finding[] = [];
  for (const control of controls) {
    await control.scrollIntoViewIfNeeded();
    violations.push(...await control.evaluate(async (element, rules) => {
      const { axe } = globalThis as unknown as AxeGlobal;
      const result = await axe.run(element, { runOnly: rules, resultTypes: ['violations'] });
      return result.violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ')),
      }));
    }, RULES));
  }
  return { audited: controls.length, violations };
}

/**
 * Keeps the browser's own setTimeout/clearTimeout where `axeReport` can borrow them. axe-core schedules its own
 * work with setTimeout, so under a paused Playwright clock `axe.run` never settles (docs/research
 * ui-review-playwright.md, section 3). Must be called before `page.clock.install()`, and on the CONTEXT: the clock
 * is a context init script, and context scripts run before page scripts, so a page script would capture the fakes.
 * Records whether what it captured is native, so a caller can prove the swap is real.
 */
export async function captureRealTimers(page: Page): Promise<void> {
  await page.context().addInitScript((key) => {
    const g = globalThis as unknown as Record<string, unknown> & { setTimeout: (...args: unknown[]) => unknown; clearTimeout: (id: unknown) => void };
    const native = /\[native code\]/.test(Function.prototype.toString.call(g.setTimeout));
    g[key] = { setTimeout: g.setTimeout.bind(globalThis), clearTimeout: g.clearTimeout.bind(globalThis), native };
  }, REAL_TIMERS);
}

interface AxeNodeCheck { data?: { fgColor?: string; bgColor?: string; contrastRatio?: number; messageKey?: string } | null; message?: string }
interface AxeNode { target: string[]; any: AxeNodeCheck[] }
interface AxeIncomplete { id: string; nodes: AxeNode[] }
export interface AxeRun { violations: Finding[]; contrastIncomplete: { target: string; reason: string; fgColor: string | null; bgColor: string | null; ratio: number | null }[]; nativeTimers: boolean }

/**
 * One whole-page run with the same rules, safe on a paused clock: the real timers stand in for the fake ones
 * only for the duration of the call, so no game time passes. Also returns axe's `incomplete` colour-contrast
 * nodes (gradients, overlaps, one-character labels, text outside its pane), which `axeViolations` drops.
 */
export async function axeReport(page: Page): Promise<AxeRun> {
  await injectAxe(page);
  return page.evaluate(async ({ rules, key }) => {
    type Timers = { setTimeout: unknown; clearTimeout: unknown; native?: boolean };
    const g = globalThis as unknown as Record<string, unknown> & Timers & { axe: { run(c: unknown, o: unknown): Promise<{ violations: AxeViolation[]; incomplete: AxeIncomplete[] }> } };
    const real = g[key] as Timers | undefined;
    const fake = { setTimeout: g.setTimeout, clearTimeout: g.clearTimeout };
    if (real) Object.assign(g, { setTimeout: real.setTimeout, clearTimeout: real.clearTimeout });
    try {
      const result = await g.axe.run({ exclude: [] }, { runOnly: rules, resultTypes: ['violations', 'incomplete'] });
      const violations = result.violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ')),
      }));
      const contrastIncomplete = result.incomplete.filter((entry) => entry.id === 'color-contrast').flatMap((entry) => entry.nodes).map((node) => {
        const data = node.any.find((check) => check.data)?.data ?? {};
        return { target: node.target.join(' '), reason: data.messageKey ?? node.any[0]?.message ?? 'unknown',
          fgColor: data.fgColor ?? null, bgColor: data.bgColor ?? null, ratio: data.contrastRatio ?? null };
      });
      return { violations, contrastIncomplete, nativeTimers: real?.native === true };
    } finally { if (real) Object.assign(g, fake); }
  }, { rules: RULES, key: REAL_TIMERS });
}
