/**
 * Kernel-log content is validated (#541, src/content/schemaLog.ts and integrityLog.ts): the merge templates name their
 * placeholders, the story categories are real and distinct, and every request joined to an outcome fits a saved line.
 * Each rule is proved by corrupting the real content.
 */
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';
import { LOG_LINE_MAX_CHARS } from '../src/content/schema';

type Json = Record<string, any>;

function problemsAfter(edit: (raw: Json) => void): string {
  const raw = structuredClone(RAW_CONTENT) as Json;
  edit(raw);
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const lex = (raw: Json): Json => raw.swarm.wildShardEncounters.find((entry: Json) => entry.id === 'wild_lex') ?? {};
const chars = (value: unknown): number => String(value).length;

describe('kernel-log content (#541)', () => {
  it('builds as shipped', () => {
    expect(problemsAfter(() => undefined)).toBe('');
  });

  it('refuses a tally template without the line or the count', () => {
    expect(problemsAfter((raw) => { raw.narrative.kernelLog.tally = '{line} again'; })).toContain('kernelLog.tally');
    expect(problemsAfter((raw) => { raw.narrative.kernelLog.tally = 'x{times}'; })).toContain('kernelLog.tally');
  });

  it('refuses a joining template without the request or the outcome', () => {
    expect(problemsAfter((raw) => { raw.narrative.kernelLog.answered = '{line}.'; })).toContain('kernelLog.answered');
    expect(problemsAfter((raw) => { raw.narrative.kernelLog.answered = '{answer}.'; })).toContain('kernelLog.answered');
  });

  it('refuses an unknown, repeated or empty list of story categories', () => {
    expect(problemsAfter((raw) => { raw.narrative.kernelLog.storyCategories = ['LORE', 'MYTH']; })).toContain('kernelLog.storyCategories');
    expect(problemsAfter((raw) => { raw.narrative.kernelLog.storyCategories = ['LORE', 'LORE']; })).toContain('must not repeat a category');
    expect(problemsAfter((raw) => { raw.narrative.kernelLog.storyCategories = []; })).toContain('kernelLog.storyCategories');
  });

  it('refuses a request that, joined to its longest outcome, would not fit a saved log line', () => {
    const longest = (raw: Json): number => Math.max(chars(lex(raw).consume.logText), chars(lex(raw).onHarnessLog), chars(lex(raw).lapseLog));
    // The shipped template joins with one space: the request plus the space plus the longest outcome is the line.
    const fits = (raw: Json): void => { lex(raw).description = 'A'.repeat(LOG_LINE_MAX_CHARS - 1 - longest(raw)); };
    expect(problemsAfter(fits)).toBe('');
    expect(problemsAfter((raw) => { fits(raw); lex(raw).description = String(lex(raw).description) + 'A'; }))
      .toContain(`encounter "wild_lex": its request joined to an outcome is ${String(LOG_LINE_MAX_CHARS + 1)} characters`);
  });
});
