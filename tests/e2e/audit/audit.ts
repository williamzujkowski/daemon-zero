/**
 * The UI audit's entry point (#338): measure one opened cell (a stage save on a paused clock, atlas/open.ts) as
 * it stands. `audit` asserts nothing; it returns typed metrics and attaches the screenshot, the ARIA
 * snapshot and the metrics JSON to the test, where the gallery reporter (galleryReporter.ts) finds them.
 */
import { test, type Page } from '@playwright/test';
import { axeReport } from '../axe';
import { collectElements } from './collect';
import { ATTACHMENTS } from './gallery';
import { countMetrics, distinctSizes, truncatedText, type AuditCell, type AuditMetrics } from './metrics';

/**
 * Measures the current view and attaches the evidence. Geometry is read before axe, because nothing here may
 * scroll: the first-viewport figures are the player's view at rest.
 */
export async function audit(page: Page, cell: AuditCell, bootMs: number): Promise<AuditMetrics> {
  const started = performance.now();
  const { geometry, elements } = await collectElements(page);
  const axe = await axeReport(page);
  if (!axe.nativeTimers) throw new Error('axe ran without the native timers; the paused clock was not bypassed');
  const aria = await page.ariaSnapshot();
  const screenshot = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  const auditMs = performance.now() - started;
  const fontSizes = distinctSizes(geometry.fontSizes);
  const metrics: AuditMetrics = {
    cell: { stage: cell.stage, fixture: cell.fixture, project: test.info().project.name, viewport: geometry.viewport },
    wallMs: { boot: Math.round(bootMs), audit: Math.round(auditMs), total: Math.round(bootMs + auditMs) },
    axe: { violations: axe.violations, contrastIncomplete: axe.contrastIncomplete, violationCount: axe.violations.length },
    aria: { lines: aria.split('\n').filter((line) => line.trim() !== '').length },
    page: { overflowX: Math.max(0, geometry.documentScrollWidth - geometry.viewport.width), truncatedText: truncatedText(geometry.clippedText) },
    counts: countMetrics(elements, geometry.fontSizes, geometry.clippedText), fontSizes,
    contentFontSizes: geometry.contentFontSizes, dialogOpen: geometry.dialogOpen, elements,
  };
  const info = test.info();
  await info.attach(ATTACHMENTS.screenshot, { body: screenshot, contentType: 'image/png' });
  await info.attach(ATTACHMENTS.aria, { body: aria, contentType: 'text/yaml' });
  await info.attach(ATTACHMENTS.metrics, { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
  return metrics;
}
