/**
 * Proves the purity rules on src/engine and src/content fire on real file paths. Engine or content
 * code reading the environment would silently follow a developer's shell into tests, the sim and
 * validation (#205).
 */
import { expect, it } from 'vitest';
import { ruleLinter } from './lint-helpers';

const RULE = 'no-restricted-properties';
const lint = ruleLinter(RULE);
const EXAMPLES = [
  ['src/engine/tick.ts', 'export const sample = process.env.DAEMON_CONTENT;', true],
  ['src/content/index.ts', "export const sample = process.env['DAEMON_CONTENT'];", true],
  ['src/content/pack.ts', 'export const sample = process.env;', true],
  ['src/app/storage.ts', 'export const sample = process.env.DAEMON_CONTENT;', false],
] as const;

it('bans process.env in engine and content code but not in app code', async () => {
  for (const [filePath, code, forbidden] of EXAMPLES) {
    const messages = await lint.messages(filePath, code);
    // Only the rule under test runs, so anything else (a parse error, an ignored file) is a broken check.
    expect(messages.every((message) => message.ruleId === RULE), filePath).toBe(true);
    expect(messages.length > 0, filePath).toBe(forbidden);
  }
}, 30_000);

it('lints each path with exactly the rules the real config gives it', async () => {
  for (const [filePath] of EXAMPLES) {
    const { real, linted } = await lint.rulesFor(filePath);
    expect(linted, filePath).toEqual(real);
  }
}, 30_000);
