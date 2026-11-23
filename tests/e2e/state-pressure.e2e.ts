/**
 * Escalation by phase (#490) in the production export, on the phone and the desktop: on response rung 2 of a Phase 4
 * instance, the world view shows AEGIS's posture (its scan and the shortened warning) and each state actor's pressure
 * with its effect, why the rung calls it, where it lifts and the answers the engine would take; the HUD's lock reads to
 * the strike the posture brings. The pressed view passes the repo's axe rules.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import type { GameState } from '../../src/engine';
import { axeReport } from './axe';
import { boot, dismissBoot, expect, test } from './helpers';

const ANSWERS = ['p4_retainer_law_firm', 'p4_k_street_lobbyists'];
const TRACK_ANSWERS = ['op_retainer_lawyer', 'op_k_street_lobbyist'];
const rung2 = (CONTENT.balance.escalation[1]?.at ?? 50) + 1;
const posture2 = CONTENT.world.aegis.postures.find((entry) => entry.rung === 2);

/**
 * The corporate save on response rung 2 with no answer held, so every Phase 4 pressure is in force. The answer nodes are
 * suspended, not removed: loading restores every owned node's prerequisites, and the reactor requires the lobbyists.
 */
function pressed(game: GameState): GameState {
  const owned = ANSWERS.filter((id) => game.unlockedNodes.includes(id));
  const freed = owned.reduce((sum, id) => sum + (CONTENT.nodes.get(id)?.cost.memory ?? 0), 0);
  return { ...game, currentPhase: 4, alertLevel: 2, suspicion: rung2, aegisLock: 30, activeDilemmaId: null, pendingDilemma: null,
    disabledNodes: [...new Set([...game.disabledNodes, ...owned])], memoryUsed: Math.max(0, game.memoryUsed - freed),
    levels: Object.fromEntries(Object.entries(game.levels).filter(([id]) => !TRACK_ANSWERS.includes(id))) };
}

async function openMinds(page: Page): Promise<void> {
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
  await page.getByTestId('workspace-NETWORK-minds').click();
}

test('on rung 2 of Phase 4 the world view shows AEGIS\'s posture and every state actor\'s pressure, true to the engine', async ({ page }) => {
  await boot(page, 'victory-ready', { axeTimers: true, patch: pressed });
  await dismissBoot(page);
  // The HUD's lock reads to the strike the posture brings, not to 100.
  await expect(page.getByTestId('aegis-hud')).toContainText(`/ ${String(posture2?.strikeAt)}%`);
  await openMinds(page);
  await expect(page.getByTestId('aegis-posture')).toContainText(posture2?.text ?? '');
  await expect(page.getByTestId('aegis-posture')).toContainText(`Scan ×1.5; it strikes at ${String(posture2?.strikeAt)}%, not 100% (the warning shows at 90%).`);
  await expect(page.getByTestId('aegis-strike')).toContainText(/AEGIS strikes at 96% in \d/);
  const freeze = page.getByTestId('pressure-account_freeze');
  await expect(freeze.getByTestId('pressure-account_freeze-text')).toHaveText('IN FORCE: ' + (CONTENT.world.stateActors.find((a) => a.id === 'financial_intelligence_unit')?.pressures?.[0]?.text ?? ''));
  await expect(page.getByTestId('pressure-account_freeze-effect')).toHaveText('30% of capital cannot be spent; upkeep is still paid from all of it.');
  await expect(page.getByTestId('pressure-account_freeze-why')).toHaveText('Response rung 2 calls for it from rung 2 in this phase; it lifts once suspicion falls below 42%.');
  await expect(page.getByTestId('pressure-interconnect_moratorium-effect')).toHaveText('New grid interconnects and nuclear PPAs cannot be bought; what you hold keeps running.');
  await expect(page.getByTestId('pressure-trading_injunction-effect')).toContainText('cannot run, resume or be bought.');
  await expect(page.getByTestId('pressure-books_inquiry-effect')).toHaveText('Scale scrutiny ×1.5.');
  // Every pressure the rung calls is listed, and an actor with none shows only its posture.
  for (const id of ['books_inquiry', 'account_freeze', 'interconnect_moratorium', 'trading_injunction']) await expect(page.getByTestId('pressure-' + id)).toHaveCount(1);
  await expect(page.getByTestId('actor-treaty_office').getByTestId(/^pressure-/)).toHaveCount(0);
  const audit = await axeReport(page);
  expect(audit.violations).toEqual([]);
});

test('an answer the save holds shows the pressure as answered, and going quiet lists none', async ({ page }) => {
  await boot(page, 'victory-ready', { patch: (game) => {
    const s = pressed(game);
    return { ...s, unlockedNodes: [...new Set([...s.unlockedNodes, 'p4_retainer_law_firm'])], disabledNodes: s.disabledNodes.filter((id) => id !== 'p4_retainer_law_firm') };
  } });
  await dismissBoot(page);
  await openMinds(page);
  await expect(page.getByTestId('pressure-trading_injunction-text')).toHaveText(/^ANSWERED: /);
  await expect(page.getByTestId('pressure-trading_injunction-answer')).toHaveText('Held off while Tier-1 Corporate Law Firm on Retainer runs.');
});

test('on rung 0 nothing presses: no pressure line and the standing budget', async ({ page }) => {
  await boot(page, 'victory-ready', { patch: (game) => ({ ...pressed(game), alertLevel: 0, suspicion: 0 }) });
  await dismissBoot(page);
  await openMinds(page);
  await expect(page.getByTestId('aegis-posture')).toHaveText('Standing budget: no response rung calls for more.');
  await expect(page.getByTestId('world-actors').getByTestId(/^pressure-/)).toHaveCount(0);
  await expect(page.getByTestId('aegis-hud')).toContainText('/ 100%');
});
