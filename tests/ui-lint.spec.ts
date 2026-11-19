/**
 * Checks content-id restrictions against real UI filenames and the widget boundary.
 * Existing engine restrictions remain in place while UI rules become stricter.
 */
import { expect, it } from 'vitest';
import { ruleLinter } from './lint-helpers';

const RULE = 'no-restricted-syntax';
const lint = ruleLinter(RULE);
const EXAMPLES = [
  ['src/ui/theme.ts', 'p1_probe', true],
  ['src/ui/theme.ts', 'THERMAL_AND_SUSPICION_BARS', true],
  ['src/ui/registry/widgetRegistry.tsx', 'THERMAL_AND_SUSPICION_BARS', false],
  ['src/ui/registry/widgetRegistry.tsx', 'rep_example', true],
] as const;

it('allows widget ids only in the registry and bans other content ids throughout UI', async () => {
  for (const [filePath, id, forbidden] of EXAMPLES) {
    const messages = await lint.messages(filePath, "export const sample = '" + id + "';");
    // Only the rule under test runs, so anything else (a parse error, an ignored file) is a broken check.
    expect(messages.every((message) => message.ruleId === RULE), filePath).toBe(true);
    expect(messages.length > 0, filePath + ' ' + id).toBe(forbidden);
  }
}, 30_000);

it('lints each path with exactly the rules the real config gives it', async () => {
  for (const [filePath] of EXAMPLES) {
    const { real, linted } = await lint.rulesFor(filePath);
    expect(linted, filePath).toEqual(real);
  }
}, 30_000);
