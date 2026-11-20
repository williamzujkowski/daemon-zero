/**
 * The stage atlas (#341): the 56 P1 rows of the stage inventory, in disclosure order. Each row is one cell per
 * viewport. The gates run on these rows at 390x844 and 1440x900 inside `make e2e`; `make e2e-atlas` adds 360x640
 * and each row's extra viewports, reported only.
 */
import { EARLY_STAGES } from './stagesEarly';
import { LATE_STAGES } from './stagesLate';
import { ROUTE_STAGES } from './stagesRoute';
import { isStageId, type StageRow } from './types';

export const STAGES: readonly StageRow[] = [...EARLY_STAGES, ...LATE_STAGES, ...ROUTE_STAGES];

/** The base viewports: the two gated ones and the reported floor. */
export const GATED_VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } } as const;
export const FLOOR_VIEWPORT = '360x640';

/** Everything that would make the table unusable: a bad or repeated id. Empty when the table is sound. */
export function tableProblems(rows: readonly StageRow[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!isStageId(row.id)) problems.push('not kebab-case: ' + row.id);
    if (seen.has(row.id)) problems.push('repeated id: ' + row.id);
    seen.add(row.id);
  }
  return problems;
}

export function viewportSize(name: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(name);
  if (match === null) throw new Error('Not a viewport name: ' + name);
  return { width: Number(match[1]), height: Number(match[2]) };
}
