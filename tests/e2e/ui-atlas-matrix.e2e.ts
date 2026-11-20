/**
 * The atlas's full matrix (#340), run by `make e2e-atlas` and nightly, never by `make e2e`: every P1 row at the
 * 360x640 floor and at the row's extra viewports (tolerated sizes, the recorded 900x640 exception, side-slot and
 * wide tiers). REPORTED only: the gates are evaluated and written to the gallery and the cell evidence, but only a
 * broken audit (unreachable stage, malformed metrics) fails a cell. The gated sizes run in ui-atlas.e2e.ts.
 */
import { metricsProblems } from './audit/metrics';
import { attachRecord, readLive, runCell } from './atlas/cell';
import { FLOOR_VIEWPORT, STAGES, viewportSize } from './atlas/stages';
import { expect, test } from './helpers';

test.use({ reducedMotion: 'reduce' });

for (const [order, row] of STAGES.entries()) {
  for (const size of row.phoneOnly === true ? [FLOOR_VIEWPORT] : [FLOOR_VIEWPORT, ...(row.extraViewports ?? [])]) {
    test.describe(size, () => {
      test.use({ viewport: viewportSize(size) });
      test(`atlas ${row.id} at ${size}`, async ({ page }) => {
        const { metrics, record } = await runCell(page, row, order, 'report');
        await readLive(page, record);
        await attachRecord(record);
        expect(metricsProblems(metrics)).toEqual([]);
      });
    });
  }
}
