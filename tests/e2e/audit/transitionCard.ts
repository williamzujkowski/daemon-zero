/**
 * The transition half of a gallery card (#339): the before-state, the trigger, every failure (recorded gaps marked),
 * what the page announced, where focus landed, the new item's visibility, the kept items and the primary action's
 * displacement; and one run line counting transition cells, failures and gaps. Pure, so escaping is unit-tested.
 */
import { formatFailure } from '../atlas/gates';
import type { TransitionRecord } from '../atlas/transitionRun';

const esc = (value: string): string => value.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`);

export function transitionSection(record: TransitionRecord): string {
  const known = new Set(record.knownGaps);
  const failures = record.failures.map((failure) => {
    const line = formatFailure(failure);
    return `<li class="${known.has(line) ? 'gap' : 'flag'}">${known.has(line) ? '[known gap] ' : ''}${esc(line)}</li>`;
  }).join('');
  const said = record.observed.announcements.map((entry) =>
    `<li>${esc(`${entry.kind}${entry.role === null ? '' : ' role=' + entry.role}${entry.live === null ? '' : ' aria-live=' + entry.live}`
      + `${entry.count > 1 ? ' x' + String(entry.count) : ''}: ${entry.text}`)}</li>`).join('');
  const items = [...(record.appear === null ? [] : [record.appear]), ...record.kept].map((item) =>
    `<tr${item.inFirstViewport ? '' : ' class="flag"'}><th>${esc(item.key)}</th><td>${item.found ? esc(String(item.visibleRatio)) : 'missing'}</td></tr>`).join('');
  const moved = record.primary.displacement === null ? 'not measurable' : `${String(record.primary.displacement)} px`;
  return `<p class="meta">${esc(`TRANSITION ${record.checks.join(' ')} | walk ${record.walk.join(', ')} | before ${record.before}${record.recipe === null ? '' : ' (FIXTURE ' + record.recipe + ')'}`)}</p>
<p>${esc(record.why)}</p><p class="meta">${esc('trigger: ' + record.trigger)}</p>
<details${record.failures.length > 0 ? ' open' : ''}><summary>transition failures (${String(record.failures.length)})</summary><ul>${failures}</ul></details>
<details><summary>announced (${String(record.observed.announcements.length)})</summary><ul>${said}</ul></details>
<table><tr><th>focus after</th><td>${esc(record.observed.focus ?? 'page body')}</td></tr><tr><th>EXECUTE moved</th><td>${esc(moved)}</td></tr></table>
<table><tr><th>item after the trigger</th><td>visible</td></tr>${items}</table>`;
}

export function transitionSummary(records: readonly TransitionRecord[]): string {
  const failures = records.reduce((sum, record) => sum + record.failures.length, 0);
  const gaps = records.reduce((sum, record) => sum + record.knownGaps.length, 0);
  return `<p class="meta">${esc(`${String(records.length)} transition cells, ${String(failures)} transition failures, ${String(gaps)} of them recorded gaps`)}</p>`;
}
