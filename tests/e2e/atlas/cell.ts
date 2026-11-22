/**
 * One atlas cell end to end (#341): open the stage on a paused clock, compose its contract from the save and the
 * row's overrides, measure the contract items, run the audit (geometry, axe, ARIA, screenshot), evaluate the gates,
 * and last, run the clock one second for the live-number reading. Attaches the atlas record for the reporter.
 */
import { test, type Page } from '@playwright/test';
import { audit } from '../audit/audit';
import type { AuditMetrics } from '../audit/metrics';
import { ATLAS_ATTACHMENT } from './attachments';
import { composeContract, type Contract } from './compose';
import { measureContract, visiblePanes, type ItemMeasure } from './contractCheck';
import { cowanFlags, gateFailures, reported, type GateFailure, type Reported } from './gates';
import { liveGroups, type LiveGroup } from './live';
import { openStage } from './open';
import { describeSource, stageState } from './sources';
import type { StageRow } from './types';


export interface AtlasRecord {
  order: number; stage: string; viewport: string; project: string; mode: 'gate' | 'report';
  source: string; why: string; tags: readonly string[];
  surfaces: string[]; top: string | null; items: ItemMeasure[];
  failures: GateFailure[];
  /** Filled by the spec after reconciling with KNOWN_GAPS: which failures are recorded gaps. */
  knownGaps: string[];
  reported: Reported & { cowan: LiveGroup[]; cowanFlags: LiveGroup[] };
}

export function viewportName(page: Page): string {
  const size = page.viewportSize();
  return size === null ? 'unknown' : `${String(size.width)}x${String(size.height)}`;
}

/** Opens and measures the cell; the clock has not moved when this returns (see `readLive`). */
export async function runCell(page: Page, row: StageRow, order: number, mode: 'gate' | 'report'):
  Promise<{ metrics: AuditMetrics; record: AtlasRecord; contract: Contract }> {
  const bootMs = await openStage(page, row);
  const contract = composeContract({ state: stageState(row), panes: await visiblePanes(page),
    overlay: row.overrides?.overlay ?? null, route: row.overrides?.route ?? [], ...(row.area === undefined ? {} : { area: row.area }) });
  // Contract items first: nothing in the audit scrolls, so both read the view at rest.
  const items = await measureContract(page, contract);
  const viewport = viewportName(page);
  const metrics = await audit(page, { stage: row.id, fixture: describeSource(row.source) }, bootMs);
  const failures = gateFailures({ stage: row.id, viewport, metrics, items });
  const record: AtlasRecord = {
    order, stage: row.id, viewport, project: test.info().project.name, mode, source: describeSource(row.source), why: row.why, tags: row.tags,
    surfaces: contract.surfaces, top: contract.top?.key ?? null, items, failures, knownGaps: [],
    reported: { ...reported(metrics, items), cowan: [], cowanFlags: [] },
  };
  return { metrics, record, contract };
}

/** The live-number reading; moves the clock one game second, so it is the cell's last step. */
export async function readLive(page: Page, record: AtlasRecord): Promise<void> {
  const cowan = await liveGroups(page);
  record.reported.cowan = cowan;
  record.reported.cowanFlags = cowanFlags(cowan);
}

/** Attaches the record once the spec has marked which failures are recorded gaps. */
export async function attachRecord(record: AtlasRecord): Promise<void> {
  await test.info().attach(ATLAS_ATTACHMENT, { body: JSON.stringify(record, null, 2), contentType: 'application/json' });
}
