/**
 * The atlas half of a gallery card and the run summary (#341): the stage's source and purpose, every gate failure
 * (recorded gaps marked), the contract items with their measured visibility, and the reported metrics; the summary
 * lists failures, Hick jumps and Cowan flags across the run. Pure, so escaping and flags are unit-tested.
 */
import type { AtlasRecord } from '../atlas/cell';
import { formatFailure, hickJumps } from '../atlas/gates';

const esc = (value: string): string => value.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`);

export function atlasSection(record: AtlasRecord): string {
  const known = new Set(record.knownGaps);
  const failures = record.failures.map((failure) => {
    const line = formatFailure(failure);
    return `<li class="${known.has(line) ? 'gap' : 'flag'}">${known.has(line) ? '[known gap] ' : ''}${esc(line)}</li>`;
  }).join('');
  const items = record.items.map((item) => `<tr${item.kind === 'timely' && !item.inFirstViewport ? ' class="flag"' : ''}><th>${esc(item.key)}</th>`
    + `<td>${esc(`${item.kind}${item.key === record.top ? ' (top)' : ''}`)}</td><td>${item.found ? esc(String(item.visibleRatio)) : 'missing'}</td>`
    + `<td>${item.fallback ? 'fallback' : 'role'}</td></tr>`).join('');
  const r = record.reported;
  const cowan = r.cowan.map((group) => `${group.group}: ${String(group.live)}`).join(', ') || 'none';
  return `<p class="meta">${esc(`${record.mode === 'gate' ? 'GATED' : 'REPORTED'} | ${record.source} | ${record.tags.join(', ')}`)}</p>
<p>${esc(record.why)}</p>
<details${record.failures.length > 0 ? ' open' : ''}><summary>gate failures (${String(record.failures.length)})</summary><ul>${failures}</ul></details>
<details><summary>contract (${String(record.items.length)} items, ${String(r.roleLess)} by fallback)</summary>
<table><tr><th>item</th><td>kind</td><td>visible</td><td>locator</td></tr>${items}</table></details>
<table><tr><th>Hick: enabled actions in view</th><td>${String(r.hick)}</td></tr><tr><th>Cowan: live numbers by group</th><td${r.cowanFlags.length > 0 ? ' class="flag"' : ''}>${esc(cowan)}</td></tr>
<tr><th>largest-size runs</th><td>${String(r.largestSizeCount)}</td></tr><tr><th>controls under a dialog / hidden</th><td>${String(r.underModal)} / ${String(r.hidden)}</td></tr>
<tr><th>timely items outside the fold</th><td${r.timelyOutsideFold > 0 ? ' class="flag"' : ''}>${String(r.timelyOutsideFold)}</td></tr></table>`;
}

export interface AtlasSummary {
  cells: number; failures: number; knownGaps: number;
  hickJumps: { viewport: string; from: string; to: string; jump: number }[];
  cowanFlags: { cell: string; group: string; live: number }[];
}

export function summarize(records: readonly AtlasRecord[]): AtlasSummary {
  const viewports = [...new Set(records.map((record) => record.viewport))];
  return {
    cells: records.length,
    failures: records.reduce((sum, record) => sum + record.failures.length, 0),
    knownGaps: records.reduce((sum, record) => sum + record.knownGaps.length, 0),
    hickJumps: viewports.flatMap((viewport) => hickJumps(records.filter((record) => record.viewport === viewport)
      .sort((a, b) => a.order - b.order).map((record) => ({ stage: record.stage, hick: record.reported.hick })))
      .map((jump) => ({ viewport, ...jump }))),
    cowanFlags: records.flatMap((record) => record.reported.cowanFlags.map((flag) => ({ cell: `${record.stage}--${record.viewport}`, ...flag }))),
  };
}

export function summarySection(summary: AtlasSummary): string {
  const jumps = summary.hickJumps.map((jump) => `<li>${esc(`${jump.viewport}: ${jump.from} -> ${jump.to} (+${String(jump.jump)})`)}</li>`).join('');
  const cowan = summary.cowanFlags.map((flag) => `<li><a href="#${esc(flag.cell)}">${esc(`${flag.cell}: ${flag.group} ${String(flag.live)}`)}</a></li>`).join('');
  return `<section><p class="meta">${esc(`${String(summary.cells)} atlas cells, ${String(summary.failures)} gate failures, ${String(summary.knownGaps)} of them recorded gaps`)}</p>
<details><summary>Hick jumps above 3 (${String(summary.hickJumps.length)})</summary><ul>${jumps}</ul></details>
<details><summary>Cowan groups above 4 (${String(summary.cowanFlags.length)})</summary><ul>${cowan}</ul></details></section>`;
}
