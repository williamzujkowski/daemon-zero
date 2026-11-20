/**
 * Renders the UI audit gallery (#338): one self-contained HTML file, one card per audited cell, with its
 * screenshot inlined, the figures a reviewer scans first, and the ARIA snapshot and full metrics behind a
 * disclosure. Pure, so the escaping and ordering rules are unit-tested; galleryReporter.ts writes the file.
 * The page is a per-run artifact, never committed: it can be attached to a PR as it stands.
 */
import type { AtlasRecord } from '../atlas/cell';
import { atlasSection, summarize, summarySection } from './atlasCard';
import type { AuditMetrics } from './metrics';

/** Attachment names the audit writes and the reporter reads; one place so the two cannot drift. */
export const ATTACHMENTS = { screenshot: 'ui-audit-screenshot', aria: 'ui-audit-aria', metrics: 'ui-audit-metrics' } as const;

export interface GalleryCard { metrics: AuditMetrics; screenshotPng: Buffer | null; aria: string | null; status: string; atlas?: AtlasRecord }

/** A card's id, the anchor a gate failure names: `<stage>--<width>x<height>`. */
export function cardAnchor(metrics: AuditMetrics): string {
  return `${metrics.cell.stage}--${String(metrics.cell.viewport.width)}x${String(metrics.cell.viewport.height)}`;
}

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`);

function figures(metrics: AuditMetrics): [string, string, boolean][] {
  const { counts, axe, wallMs, page } = metrics;
  // [label, value, flagged]: flagged figures are the ones a later gate is expected to hold at zero.
  return [
    ['axe violations', String(axe.violationCount), axe.violationCount > 0],
    ['contrast needs review', String(axe.contrastIncomplete.length), false],
    ['controls in first viewport', `${String(counts.interactiveInFirstViewport)} / ${String(counts.interactive)}`, false],
    ['headings in first viewport', `${String(counts.headingsInFirstViewport)} / ${String(counts.headings)}`, false],
    ['under 44px', String(counts.underTarget), counts.underTarget > 0],
    ['occluded', String(counts.occluded), counts.occluded > 0],
    ['truncated controls/headings', String(counts.truncated), counts.truncated > 0],
    ['truncated text runs', String(counts.truncatedText), false],
    ['page overflow x', `${String(page.overflowX)}px`, page.overflowX > 0],
    ['font sizes', `${String(counts.distinctFontSizes)} (${metrics.fontSizes.join(', ')})`, false],
    ['wall time', `${String(wallMs.total)} ms (boot ${String(wallMs.boot)}, audit ${String(wallMs.audit)})`, false],
  ];
}

function card(entry: GalleryCard): string {
  const { cell } = entry.metrics;
  const rows = figures(entry.metrics).map(([label, value, flagged]) =>
    `<tr${flagged ? ' class="flag"' : ''}><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  const image = entry.screenshotPng === null ? '<p>no screenshot</p>'
    : `<img loading="lazy" src="data:image/png;base64,${entry.screenshotPng.toString('base64')}" alt="${escapeHtml(cell.stage + ' at ' + cell.project)}">`;
  const details = (summary: string, body: string) => `<details><summary>${summary}</summary><pre>${escapeHtml(body)}</pre></details>`;
  return `<article id="${escapeHtml(cardAnchor(entry.metrics))}"><h2>${escapeHtml(cell.stage)} <small>${escapeHtml(`${cell.project} ${String(cell.viewport.width)}x${String(cell.viewport.height)}`)}</small></h2>
<p class="meta">${escapeHtml(cell.fixture + ' | ' + entry.status)}</p>${image}<table>${rows}</table>${entry.atlas === undefined ? '' : atlasSection(entry.atlas)}
${entry.aria === null ? '' : details('aria snapshot', entry.aria)}${details('metrics json', JSON.stringify(entry.metrics, null, 2))}</article>`;
}

/** Cards sorted by stage, then project, so the phone and desktop shots of one stage sit side by side. */
export function renderGallery(cards: readonly GalleryCard[], generatedAt: string): string {
  const atlas = cards.flatMap((entry) => entry.atlas === undefined ? [] : [entry.atlas]);
  const sorted = [...cards].sort((a, b) => a.metrics.cell.stage.localeCompare(b.metrics.cell.stage)
    || a.metrics.cell.project.localeCompare(b.metrics.cell.project));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>UI audit gallery</title><style>
:root{color-scheme:dark;--bg:#0b0f0c;--fg:#d6f5dd;--muted:#8fb39a;--flag:#ffb4a8;--line:#24352a}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.4 ui-monospace,monospace}
main{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
article{border:1px solid var(--line);padding:12px;min-width:0}h2{font-size:16px;margin:0 0 4px}small,.meta{color:var(--muted)}
img{display:block;max-width:100%;max-height:480px;margin:8px 0;border:1px solid var(--line)}
table{border-collapse:collapse;width:100%}th{text-align:left;font-weight:normal;color:var(--muted);padding-right:8px}
th,td{padding:2px 0;vertical-align:top}.flag td,li.flag,td.flag{color:var(--flag)}li.gap{color:var(--muted)}
pre{overflow:auto;max-height:320px;font-size:12px}summary{cursor:pointer;margin-top:8px}
</style></head><body><h1>UI audit gallery</h1><p class="meta">${escapeHtml(`${String(cards.length)} cells, generated ${generatedAt}`)}</p>
${atlas.length === 0 ? '' : summarySection(summarize(atlas))}<main>${sorted.map(card).join('\n')}</main></body></html>
`;
}
