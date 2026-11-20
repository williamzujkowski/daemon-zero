/**
 * The committed partial ARIA baseline (#340): each stage's contract items, one template line each, checked with
 * Playwright's toMatchAriaSnapshot against the item itself. `make e2e-atlas-aria` (DAEMON_ATLAS_ARIA=update)
 * attaches the current lines instead, and the gallery reporter rewrites the baseline file from every cell: run it
 * in a Playwright-bump PR, or when a contract item is renamed on purpose, and review the diff.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectedTemplate, parseBaseline, type BaselineLine } from './ariaTemplate';
import { ARIA_ATTACHMENT, ARIA_UPDATE } from './attachments';
import type { AtlasRecord } from './cell';
import type { Contract } from './compose';
import { itemLocator } from './contractCheck';

/** Relative to the repository root, where every e2e target runs; the reporter writes the same literal path. */
const ARIA_BASELINE_FILE = 'tests/e2e/atlas/aria-baseline.txt';
const REGENERATE = 'regenerate with `make e2e-atlas-aria` and review the diff';

let baseline: BaselineLine[] | undefined;
function lines(): BaselineLine[] {
  baseline ??= fs.existsSync(ARIA_BASELINE_FILE) ? parseBaseline(fs.readFileSync(ARIA_BASELINE_FILE, 'utf8')) : [];
  return baseline;
}

/** Checks (or, in update mode, attaches) the template line of every contract item found in this cell. */
export async function checkAria(page: Page, contract: Contract, record: AtlasRecord): Promise<void> {
  const current = record.items.filter((item) => item.found && item.aria !== null)
    .map((item) => ({ stage: record.stage, item: item.key, project: record.project, template: item.aria ?? '' }));
  if (ARIA_UPDATE) {
    await test.info().attach(ARIA_ATTACHMENT, { body: JSON.stringify(current), contentType: 'application/json' });
    return;
  }
  const recorded = lines().filter((line) => line.stage === record.stage && (line.project === record.project || line.project === '*'));
  expect(recorded.map((line) => line.item).sort(), `aria baseline items for ${record.stage} on ${record.project}; ${REGENERATE}`)
    .toEqual(current.map((line) => line.item).sort());
  for (const item of contract.items) {
    const template = expectedTemplate(lines(), record.stage, item.key, record.project);
    if (template === undefined) continue;
    await expect(itemLocator(page, item), `${record.stage} ${item.key}: ${REGENERATE}`).toMatchAriaSnapshot(template);
  }
}
