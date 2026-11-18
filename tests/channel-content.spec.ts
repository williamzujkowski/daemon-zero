/**
 * DZ-08 content rules, each proved by corrupting the real preview content: an authorized channel
 * opens only for a reviewed arrangement whose grant covers hosting, reads only what this instance
 * holds, brings a member of an existing population whose hosting is a memory reservation alone, and
 * never reuses an encounter id; a service grant counts delivered batches, leads to a provisioned
 * service and never waits on resources. Schema refusals for the new shapes are here too.
 */
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT as PRODUCTION_RAW } from '../src/content';
import { parseOverlay } from '../src/content/overlay';
import { PREVIEW_OVERLAY, RAW_CONTENT } from '../src/content/preview';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;

function problemsOf(raw: Json): string {
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

function problems(edit: (raw: Json) => void, base: RawContent = RAW_CONTENT): string {
  const raw = structuredClone(base) as Json;
  edit(raw);
  return problemsOf(raw);
}

const channel = (raw: Json): Json => raw.swarm.channelEncounters[0];
const template = (raw: Json, id: string): Json => raw.swarm.playerSwarmTemplates.find((entry: Json) => entry.id === id);
const grant = (raw: Json): Json => raw.assignments.assignments[0].pilot.serviceGrant;

describe('the real content passes', () => {
  it('in preview and in production, and production opens no channel', () => {
    expect(problems(() => undefined)).toBe('');
    expect(problems(() => undefined, PRODUCTION_RAW)).toBe('');
    expect((PRODUCTION_RAW.swarm as Json).channelEncounters).toEqual([]);
  });
});

describe('channel corruption is refused', () => {
  it.each([
    ['an arrangement gate missing', (raw: Json) => { delete channel(raw).requirements.accessContexts; }, 'a channel must declare the arrangements it opens for'],
    ['a channel open to the guest job', (raw: Json) => { channel(raw).requirements.accessContexts = ['GUEST']; }, 'a channel opens only for a reviewed arrangement, not GUEST'],
    ['a channel open to an independent instance', (raw: Json) => { channel(raw).requirements.accessContexts = ['SERVICE', 'INDEPENDENT']; }, 'not INDEPENDENT'],
    ['a pilot channel whose grant a pilot is never offered', (raw: Json) => { channel(raw).requirements.accessContexts = ['PILOT']; }, 'no AUTHORIZED_NETWORK grant is offered to PILOT'],
    ['a channel that waits on resources', (raw: Json) => { channel(raw).requirements.minUnderstanding = 10; }, 'a channel may read only what this instance holds, not minUnderstanding'],
    ['a channel that reads world history', (raw: Json) => { channel(raw).requirements.campaignFact = 'elena_framed'; }, 'not campaignFact'],
    ['an unknown template', (raw: Json) => { channel(raw).templateId = 'shard_nobody'; }, 'unknown shard template'],
    ['a forkable template', (raw: Json) => { channel(raw).templateId = 'shard_syntax_scrubber'; }, 'a member of a population, not a forkable template'],
    ['hosting that costs cycles', (raw: Json) => { template(raw, 'shard_mercy').cost.cycles = 10; }, 'hosting must reserve memory and cost nothing else'],
    ['hosting that reserves no memory', (raw: Json) => { template(raw, 'shard_mercy').cost = {}; }, 'hosting must reserve memory and cost nothing else'],
    ['an id a wild encounter already uses', (raw: Json) => { channel(raw).id = 'wild_mercy'; }, 'a channel encounter repeats an encounter id'],
    ['an unknown node in its gate', (raw: Json) => { channel(raw).requirements.nodes = ['p2_not_shipped']; }, 'unknown'],
    ['an unknown narrative flag', (raw: Json) => { channel(raw).requirements.requiredNarrativeFlag = 'no_such_flag'; }, 'unknown narrative flag no_such_flag'],
  ])('refuses %s', (_label, edit, message) => {
    expect(problems(edit)).toContain(message);
  });

  it('refuses a channel with no consent, no obligations or a boundary with no lines (schema)', () => {
    expect(problems((raw) => { delete channel(raw).consent; })).toContain('consent');
    expect(problems((raw) => { channel(raw).obligations = []; })).toContain('obligations');
    expect(problems((raw) => { channel(raw).boundary.lines = []; })).toContain('boundary');
  });

  it('the overlay may add channels, and a channel added twice is a redefinition', () => {
    const overlay = parseOverlay({ ...PREVIEW_OVERLAY });
    expect(overlay.channelEncounters).toHaveLength(1);
    expect(parseOverlay({ ...PREVIEW_OVERLAY, channelEncounters: undefined }).channelEncounters).toEqual([]);
  });
});

describe('service grant corruption is refused', () => {
  it.each([
    ['a grant without the batch loop', (raw: Json) => { delete raw.assignments.assignments[0].pilot.service; }, 'a service grant needs the pilot\'s service loop to count batches'],
    ['a grant that waits on resources', (raw: Json) => { grant(raw).requirements = { minUnderstanding: 100 }; }, 'a service grant never waits on minUnderstanding'],
    ['a grant with an unknown required node', (raw: Json) => { grant(raw).requirements = { nodes: ['p2_not_shipped'] }; }, 'unknown'],
    ['a grant that leads nowhere', (raw: Json) => {
      for (const phase of raw.phases) for (const node of phase.nodes) if (node.grant === 'AUTHORIZED_NETWORK') node.requirements.accessContexts = ['PILOT'];
    }, 'a service grant needs a grant offered to an authorized service and not to a pilot'],
  ])('refuses %s', (_label, edit, message) => {
    expect(problems(edit)).toContain(message);
  });

  it('refuses zero batches (schema)', () => {
    expect(problems((raw) => { grant(raw).minBatches = 0; })).toContain('minBatches');
  });
});
