/** Per-cell evidence names for the judgment panel (#342): only a kebab-case stage id and a positive integer viewport
 *  make a file stem, so no attachment text can choose where a file lands. */
import { describe, expect, it } from 'vitest';
import { cellStem } from './e2e/audit/evidence';

describe('evidence names', () => {
  it('builds a stem from a kebab-case stage and a measured viewport', () => {
    expect(cellStem('p0-cold-start', 390, 844)).toBe('p0-cold-start--390x844');
  });

  it.each([['../etc', 390], ['A-b', 390], ['a--b', 390], ['a-', 390], ['p0/x', 390], ['p0', 390.5], ['p0', 0]] as const)(
    'refuses stage %s at width %s', (stage, width) => {
      expect(cellStem(stage, width, 844)).toBeNull();
    });
});
