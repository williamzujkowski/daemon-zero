/**
 * #273, shared by the original-route and route specs: from Phase 2 with only ARP discovery affordable,
 * map it on its card, then find "Scrub Audit Logs" in Operations, enabled, and use it before the
 * spoofer exists. FIXTURE: a played save (first run, or a returning mind brought back to Phase 2 by
 * the engine) funded for the two purchases, imported through the visible save transfer.
 */
import type { Page } from '@playwright/test';
import { makeFixtures } from '../../scripts/make-fixtures';
import type { ContentRegistry } from '../../src/content';
import { exportSave, importSave, nodeCost, unlockNode, type GameState } from '../../src/engine';
import { boot, dismissBoot, expect, openSave, press } from './helpers';

export const SCRUB = 'act_p2_scrub_audit_logs';
const DISCOVERY = 'p2_arp_discovery';
const SPOOFER = 'p2_log_spoofer';
const SUSPICION = 30;

let fixtures: Record<string, string> | undefined;
function fixture(name: string, reg: ContentRegistry): GameState {
  fixtures ??= makeFixtures();
  const code = fixtures[name];
  if (!code) throw new Error('Missing fixture ' + name);
  return importSave(code, reg);
}

/** Exactly enough for the discovery and one scrub, with suspicion for the scrub to remove. */
function funded(state: GameState, reg: ContentRegistry): string {
  const discovery = reg.nodes.get(DISCOVERY), scrub = reg.actions.get(SCRUB);
  if (!discovery || !scrub) throw new Error('#273 contract missing');
  const cost = nodeCost(state, discovery, reg);
  return exportSave({ ...state, cycles: cost.cycles + scrub.cost.cycles, understanding: Math.max(state.understanding, cost.understanding), suspicion: SUSPICION });
}

/** The first run, at the moment Phase 2 opens. */
export function firstRunCode(reg: ContentRegistry): string {
  return funded(fixture('phase-2-unlocked', reg), reg);
}

/** A returning mind (iteration 2) that has remapped its way back into Phase 2, every purchase through the engine. */
export function returningCode(reg: ContentRegistry): string {
  const discovery = reg.nodes.get(DISCOVERY);
  if (!discovery) throw new Error('#273 contract missing');
  const route = new Set<string>();
  const visit = (id: string): void => { if (!route.has(id)) { route.add(id); reg.nodes.get(id)?.prerequisites.forEach(visit); } };
  discovery.prerequisites.forEach(visit);
  const ordered = [...route].sort((left, right) => (reg.nodes.get(left)?.phaseId ?? 0) - (reg.nodes.get(right)?.phaseId ?? 0));
  // Funded for the whole route at its full price; remembered hardware only costs less (docs/SCALE.md re-anchored it).
  const price = ordered.reduce((sum, id) => sum + (reg.nodes.get(id)?.cost.cycles ?? 0), 0);
  let s: GameState = { ...fixture('iteration-2-breadcrumb', reg), cycles: price, understanding: 1e12 };
  for (let pass = 0; pass < ordered.length && ordered.some((id) => !s.unlockedNodes.includes(id)); pass++) {
    for (const id of ordered) {
      const result = s.unlockedNodes.includes(id) ? null : unlockNode(s, id, reg);
      if (result?.ok) s = result.state;
    }
  }
  if (s.currentPhase !== discovery.phaseId || s.iteration !== 2) throw new Error('Could not bring the returning mind back to Phase 2');
  return funded(s, reg);
}

async function importCode(page: Page, code: string): Promise<void> {
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(code);
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
  await dismissBoot(page);
}

/** The flow itself: no scrub card before the discovery, an enabled one in Operations right after it. */
export async function scrubRightAfterDiscovery(page: Page, code: string): Promise<void> {
  await importCode(page, code);
  await expect(page.getByTestId('phase-value').first()).toHaveText('2');
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
  await expect(page.getByTestId('action-' + SCRUB)).toHaveCount(0);
  await press(page, 'node-' + DISCOVERY + '-unlock');
  await expect(page.getByTestId('node-' + DISCOVERY)).toHaveCount(0);
  // The spoofer, whose panel used to carry the card, is still unmapped.
  await expect(page.getByTestId('node-' + SPOOFER + '-unlock')).toBeVisible();
  await page.getByTestId('workspace-NETWORK-operations').click();
  const scrub = page.getByTestId('action-' + SCRUB);
  await expect(scrub).toBeVisible();
  await expect(scrub).toBeEnabled();
  await scrub.click();
  await expect(page.getByTestId('action-cooldown-' + SCRUB)).toBeVisible();
  await expect(scrub).toBeDisabled();
}
