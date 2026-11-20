/**
 * Per-cell evidence files for the judgment panel (#342): for every audited cell, its screenshot, ARIA snapshot and
 * metrics (with the atlas record) as separate files under test-results/ui-atlas/cells/ (gitignored), named
 * `<stage>--<width>x<height>.{png,aria.yml,json}`. Every name passes through `cellStem`, which accepts only a
 * kebab-case stage id and a measured integer viewport, and one of three fixed extensions, so no attachment text
 * can choose where a file lands.
 */
import fs from 'node:fs';
import path from 'node:path';
import { isStageId } from '../atlas/types';
import type { GalleryCard } from './gallery';

const CELLS_DIR = 'test-results/ui-atlas/cells';
type Extension = 'png' | 'aria.yml' | 'json';

/** The file stem for a cell, or null when the stage id or viewport would not make a safe name. */
export function cellStem(stage: string, width: number, height: number): string | null {
  if (!isStageId(stage) || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
  return `${stage}--${String(width)}x${String(height)}`;
}

/** The one place a cell file is written: a validated stem, a fixed extension, inside CELLS_DIR. */
function writeEvidence(stem: string, extension: Extension, body: string | Buffer): void {
  const file = path.join(CELLS_DIR, `${stem}.${extension}`);
  if (path.dirname(file) !== CELLS_DIR) throw new Error('Evidence must stay in ' + CELLS_DIR + ': ' + file);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- the name is a cellStem() result (kebab-case stage id, integer viewport) plus a fixed extension, checked to stay in CELLS_DIR above.
  fs.writeFileSync(file, body);
}

/** Writes one cell's evidence; returns false (and writes nothing) for a cell whose name is not safe. */
export function writeCell(card: GalleryCard): boolean {
  const { stage, viewport } = card.metrics.cell;
  const stem = cellStem(stage, viewport.width, viewport.height);
  if (stem === null) return false;
  fs.mkdirSync(CELLS_DIR, { recursive: true });
  if (card.screenshotPng !== null) writeEvidence(stem, 'png', card.screenshotPng);
  writeEvidence(stem, 'aria.yml', card.aria ?? '');
  writeEvidence(stem, 'json', JSON.stringify({ metrics: card.metrics, atlas: card.atlas ?? null, status: card.status }, null, 2));
  return true;
}
