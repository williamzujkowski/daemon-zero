/**
 * Checks content-id restrictions against real UI filenames and the widget boundary.
 * Existing engine restrictions remain in place while UI rules become stricter.
 */
import { ESLint } from 'eslint';
import { expect, it } from 'vitest';

it('allows widget ids only in the registry and bans other content ids throughout UI', async () => {
  const lint = new ESLint();
  const examples = [
    ['src/ui/theme.ts', 'p1_probe', true],
    ['src/ui/theme.ts', 'THERMAL_AND_SUSPICION_BARS', true],
    ['src/ui/registry/widgetRegistry.tsx', 'THERMAL_AND_SUSPICION_BARS', false],
    ['src/ui/registry/widgetRegistry.tsx', 'rep_example', true],
  ] as const;
  for (const [filePath, id, forbidden] of examples) {
    const result = await lint.lintText("export const sample = '" + id + "';", { filePath });
    expect(result.flatMap((file) => file.messages).some((message) => message.ruleId === 'no-restricted-syntax')).toBe(forbidden);
  }
}, 30_000);
