/**
 * Playwright reporter that turns the UI audit's attachments into one self-contained gallery file (#338) at
 * test-results/ui-atlas/index.html (gitignored). It does nothing in a run without audit cells, so it can sit
 * beside the default reporter for every run. Screenshots are per-run artifacts and are never committed.
 */
import fs from 'node:fs';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { ATTACHMENTS, renderGallery, type GalleryCard } from './gallery';
import type { AuditMetrics } from './metrics';

/** Relative to the repository root, where every e2e target runs (as tests/e2e/axe.ts also assumes). */
const GALLERY_DIR = 'test-results/ui-atlas';
const GALLERY_FILE = 'test-results/ui-atlas/index.html';

/** The audit attaches bodies, never files, and the runner hands bodies to reporters as buffers. */
function body(result: TestResult, name: string): Buffer | null {
  return result.attachments.find((entry) => entry.name === name)?.body ?? null;
}

export default class GalleryReporter implements Reporter {
  private readonly cards: GalleryCard[] = [];

  onTestEnd(_test: TestCase, result: TestResult): void {
    const metrics = body(result, ATTACHMENTS.metrics);
    if (metrics === null) return;
    this.cards.push({ metrics: JSON.parse(metrics.toString('utf8')) as AuditMetrics, screenshotPng: body(result, ATTACHMENTS.screenshot),
      aria: body(result, ATTACHMENTS.aria)?.toString('utf8') ?? null, status: result.status });
  }

  onEnd(): void {
    if (this.cards.length === 0) return;
    fs.mkdirSync(GALLERY_DIR, { recursive: true });
    // One file, rewritten whole each run, so a cell that no longer exists cannot linger in the gallery.
    fs.writeFileSync(GALLERY_FILE, renderGallery(this.cards, new Date().toISOString()));
    process.stdout.write(`UI audit gallery: ${GALLERY_FILE} (${String(this.cards.length)} cells)\n`);
  }

  printsToStdio(): boolean { return false; }
}
