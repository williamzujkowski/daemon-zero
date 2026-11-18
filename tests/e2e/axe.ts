/**
 * One axe-core run, shared by the production audit and the preview audit so both enforce the same rule
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
