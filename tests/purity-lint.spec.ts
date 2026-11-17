/**
 * Proves the purity rules on src/engine and src/content fire on real file paths. The content
 * channel is chosen by the Metro resolver, so engine or content code reading the environment
 * would silently follow a developer's shell into tests, the sim and validation (#205).
 */
import { ESLint } from 'eslint';
import { expect, it } from 'vitest';

it('bans process.env in engine and content code but not in app code', async () => {
  const lint = new ESLint();
  const examples = [
    ['src/engine/tick.ts', 'export const sample = process.env.DAEMON_CONTENT_CHANNEL;', true],
    ['src/content/index.ts', "export const sample = process.env['DAEMON_CONTENT_CHANNEL'];", true],
    ['src/content/preview/index.ts', 'export const sample = process.env;', true],
    ['src/app/storage.ts', 'export const sample = process.env.DAEMON_CONTENT_CHANNEL;', false],
  ] as const;
  for (const [filePath, code, forbidden] of examples) {
    const result = await lint.lintText(code, { filePath });
    const hits = result.flatMap((file) => file.messages).filter((message) => message.ruleId === 'no-restricted-properties');
    expect(hits.length > 0, filePath).toBe(forbidden);
  }
}, 30_000);
