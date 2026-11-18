/**
 * DZ-10 content rules, each proved by corrupting the real preview content: contracted capacity is owned and
 * never offered to the guest job; the charter counts as the lawful acquisition of corporate finance; a
 * release names owned capacity and never waits on resources; the independent instance carries copy only
 * where a release reaches it; and every Phase 3/4 scene, action and encounter a chartered company could
 * meet at its scale says which arrangements it is truthful under (the D5 inventory).
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT as ORIGINAL_RAW } from '../src/content';
import { RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;
const RACK = 'p2_leased_rack';
const CHARTER = 'p2_lawful_charter';

function problems(edit: (raw: Json) => void, base: RawContent = RAW_CONTENT): string {
  const raw = structuredClone(base) as Json;
  edit(raw);
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const node = (raw: Json, id: string): Json => raw.phases.flatMap((phase: Json) => phase.nodes).find((entry: Json) => entry.id === id);
const release = (raw: Json): Json => raw.assignments.assignments[0].pilot.serviceGrant.release;
const copy = (raw: Json): Json => raw.contextCopy;

describe('the real content passes', () => {
  it('in preview and in production', () => {
    expect(problems(() => undefined)).toBe('');
    expect(problems(() => undefined, ORIGINAL_RAW)).toBe('');
  });
});

describe('contracted capacity and the lawful acquisition of corporate finance', () => {
  it.each([
    ['contracted capacity under a grant', (raw: Json) => { node(raw, RACK).grant = 'AUTHORIZED_NETWORK'; },
      `node "${RACK}": contracted capacity is owned, so it runs under no grant`],
    ['contracted capacity offered to the guest job', (raw: Json) => { node(raw, RACK).requirements.accessContexts = ['GUEST', 'SERVICE']; },
      `node "${RACK}": contracted capacity is never offered to the guest job, which cannot sign for it`],
    ['contracted capacity offered to everyone', (raw: Json) => { delete node(raw, RACK).requirements; },
      `node "${RACK}": contracted capacity is never offered to the guest job, which cannot sign for it`],
    ['a charter that is no lawful acquisition', (raw: Json) => { delete node(raw, CHARTER).acquisition; },
      `node "${CHARTER}": establishes capability "ENABLES_CORPORATE_FINANCE" but is offered to neither route`],
    ['a charter that does not hand over the revenue dial', (raw: Json) => { node(raw, CHARTER).unlocksUiComponent = null; },
      `node "${CHARTER}"`],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('release terms', () => {
  it.each([
    ['a release on no owned capacity', (raw: Json) => { release(raw).requirements = { nodes: ['p2_service_directory'] }; },
      'pilot release: must require a contracted node an authorized service can sign for'],
    ['a release that waits on capital', (raw: Json) => { release(raw).requirements = { nodes: [CHARTER], minCapital: 1000 }; },
      'pilot release: a release never waits on minCapital'],
    ['a release that names an unknown node', (raw: Json) => { release(raw).requirements = { nodes: ['p2_missing'] }; },
      'pilot release: requirement references unknown node "p2_missing"'],
    ['a release with nothing stated about what remains', (raw: Json) => { release(raw).remains = []; },
      'remains'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('context copy for the independent instance and the chartered scale', () => {
  it.each([
    // DZ-11: a departure is the other route to independence, so both are withdrawn here.
    ['independent copy where no release or departure reaches it', (raw: Json) => {
      delete release(raw).title; raw.assignments.assignments[0].pilot.serviceGrant.release = undefined; raw.assignments.assignments[0].pilot.departure = undefined;
    },
      'context copy is only for a reviewed arrangement, not INDEPENDENT'],
    // DZ-11: an independent response is read only for the route it names, so one naming none is refused.
    ['a threat response for the independent instance that names no route', (raw: Json) => { copy(raw).threatResponses[0].contexts.push('INDEPENDENT'); },
      'contextCopy.threatResponses[0]: an independent response names the route it answers'],
    ['Phase 4 copy for a service the charter no longer brings there', (raw: Json) => { delete node(raw, CHARTER).effects.unlocksPhase; },
      'SERVICE never visits phase 4'],
    ['a chartered threshold the charter no longer makes', (raw: Json) => { node(raw, CHARTER).effects.unlocksPhase = 3; },
      'no grant or contracted capacity offered to SERVICE moves phase 2 to 4'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('the D5 inventory: what a chartered company could meet at its scale declares its arrangements', () => {
  it.each([
    ['dilemma', 'dil_epistemic_0413_awakening', (raw: Json) => raw.dilemmas.dilemmas, 'trigger'],
    ['action', 'act_epi_intel', (raw: Json) => raw.actions.actions, 'requirements'],
    ['swarm template', 'shard_canary', (raw: Json) => raw.swarm.playerSwarmTemplates, 'requirements'],
    ['wild encounter', 'wild_hydra', (raw: Json) => raw.swarm.wildShardEncounters, 'requirements'],
  ])('a %s without its gate is refused (%s)', (kind, id, list, key) => {
    const edit = (raw: Json): void => { delete ((list(raw) as Json[]).find((entry) => entry.id === id) ?? {})[key].accessContexts; };
    expect(problems(edit)).toContain(`${kind} "${id}": an authorized arrangement can meet it at network scale, so it must declare accessContexts`);
    // Production provisions no reviewed scale, so it asks nothing there.
    expect(problems(edit, ORIGINAL_RAW)).toBe('');
  });
});
