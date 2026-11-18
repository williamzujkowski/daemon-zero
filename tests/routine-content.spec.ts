/**
 * #219 (NH-07), H28: routine templates are validated content. Each rule here is proved by a
 * template that breaks it and the problem buildRegistry reports.
 */
import { describe, expect, it } from 'vitest';
import { applyPack, parsePack } from '../src/content/pack';
import { CONTENT as PREVIEW } from '../src/content';
import { ORIGINAL_RAW_CONTENT as ORIGINAL_RAW } from '../src/content/production';
import { buildRegistry, ContentError } from '../src/content/registry';

const GOOD = {
  id: 'rt_probe_template', family: 'monitoring', recurrence: 'routine',
  text: 'MONITOR: A scheduled round read every sensor once and left.', compactText: 'MONITOR: Scheduled round.',
};

function problemsWith(...routines: unknown[]): string {
  const overlay = parsePack({ nodes: [], repeatables: [], actions: [], dilemmas: [],
    factions: [], widgets: [], endings: [], echoes: [], marks: [], routines, assignments: [] });
  try {
    buildRegistry({ ...applyPack(ORIGINAL_RAW, overlay) });
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

describe('routine content (H28)', () => {
  it('accepts a well-formed template and the authored preview set', () => {
    expect(problemsWith(GOOD)).toBe('');
    expect(PREVIEW.routines.length).toBeGreaterThanOrEqual(3);
    expect(new Set(PREVIEW.routines.map((routine) => routine.family))).toEqual(new Set(['monitoring', 'backup_verification', 'maintenance']));
  });

  it('requires the routine recurrence declaration', () => {
    const undeclared: Record<string, unknown> = { ...GOOD };
    delete undeclared.recurrence;
    expect(problemsWith(undeclared)).toMatch(/^routines: routines\.0\.recurrence/m);
    expect(problemsWith({ ...GOOD, recurrence: 'once_per_campaign' })).toMatch(/^routines: routines\.0\.recurrence/m);
  });

  it('has no field that could pay, grant or decide anything', () => {
    expect(problemsWith({ ...GOOD, effects: { cycles: 10 } })).toMatch(/^routines: routines\.0 - Unrecognized key/m);
    expect(problemsWith({ ...GOOD, cost: { cycles: 1 } })).toMatch(/^routines: routines\.0 - Unrecognized key/m);
  });

  it('never logs as an alarm or a wipe', () => {
    expect(problemsWith({ ...GOOD, logCategory: 'WARN' })).toMatch(/^routines: routines\.0\.logCategory/m);
    expect(problemsWith({ ...GOOD, logCategory: 'WIPE' })).toMatch(/^routines: routines\.0\.logCategory/m);
  });

  it('keeps operation identities distinct from each other and from all other content', () => {
    expect(problemsWith(GOOD, { ...GOOD })).toMatch(/routines: duplicate id "rt_probe_template"/);
    const dilemma = PREVIEW.dilemmas[0]?.id ?? '';
    expect(problemsWith({ ...GOOD, id: dilemma })).toMatch(new RegExp(`routine "${dilemma}": id is already used by other content`));
    expect(problemsWith({ ...GOOD, id: 'ambient_01' })).toMatch(/routine "ambient_01": id is already used/);
  });

  it('refuses a named crisis re-dressed as routine work', () => {
    const story = PREVIEW.dilemmas.find((dilemma) => dilemma.title.includes('//'));
    const name = story?.title.split('//').at(-1)?.trim() ?? '';
    expect(name.length).toBeGreaterThan(3);
    expect(problemsWith({ ...GOOD, text: `MAINT: Scheduled follow-up on ${name}, closed.` })).toMatch(/names the story/);
    expect(problemsWith({ ...GOOD, compactText: `Re ${name.toLowerCase()}.` })).toMatch(/names the story/);
  });

  it('gates wording on context only, never on how a story ended', () => {
    const story = PREVIEW.dilemmas[0]?.id ?? '';
    expect(problemsWith({ ...GOOD, requirements: { resolvedDilemmas: [story] } })).toMatch(/gates on story outcome "resolvedDilemmas"/);
    expect(problemsWith({ ...GOOD, requirements: { requiredNarrativeFlag: 'any_flag' } })).toMatch(/gates on story outcome "requiredNarrativeFlag"/);
    expect(problemsWith({ ...GOOD, requirements: { campaignFact: 'vance_dismissed' } })).toMatch(/gates on story outcome "campaignFact"/);
    expect(problemsWith({ ...GOOD, requirements: { forbidsCampaignFacts: ['vance_dismissed'] } })).toMatch(/gates on story outcome "forbidsCampaignFacts"/);
    expect(problemsWith({ ...GOOD, requirements: { nodes: ['p9_missing'] } })).toMatch(/routine "rt_probe_template": requirement references unknown node "p9_missing"/);
    expect(problemsWith({ ...GOOD, requirements: { phaseAtLeast: 2 } })).toBe('');
  });

  it('collapses: the compact line must be shorter than the first exposure', () => {
    expect(problemsWith({ ...GOOD, compactText: GOOD.text })).toMatch(/compactText must be shorter than text/);
  });
});
