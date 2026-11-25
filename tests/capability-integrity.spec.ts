/**
 * DZ-07a content rules, each proved by corrupting the real preview content (07.2, 07.8, 07.10): a
 * required capability is established, by an authorized and an escape acquisition; shared content
 * depends on nothing only one route owns; every acquisition reaches the shared content's phase;
 * reachability honours the capability; provisioned access is the only grant that changes scale;
 * seized capacity is never lawful under a grant.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT as ORIGINAL_RAW } from '../src/content';
import { RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;
const SEGMENT = 'p0_service_network_segment';
const DIRECTORY = 'p2_service_directory';
const TELEMETRY = 'p2_link_telemetry';
const NIC = 'p1_bus_0x05_nic';
const QUEUE = 'p0_pilot_triage_queue';

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

const node = (raw: Json, id: string): Json => raw.phases.flatMap((phase: Json) => phase.nodes).find((entry: Json) => entry.id === id);

describe('the real content passes', () => {
  it('in preview and in production', () => {
    expect(problems(() => undefined)).toBe('');
    expect(problems(() => undefined, ORIGINAL_RAW)).toBe('');
  });
});

describe('capability corruption is refused', () => {
  it.each([
    ['a capability required but never established', (raw: Json) => { node(raw, SEGMENT).systemFlags = []; node(raw, NIC).systemFlags = []; },
      `node "${DIRECTORY}": requires capability "NETWORK_ACCESS", which no node establishes`],
    ['no authorized acquisition', (raw: Json) => { node(raw, SEGMENT).systemFlags = []; },
      `capability "NETWORK_ACCESS": required by "${DIRECTORY}" but no authorized acquisition establishes it`],
    ['no escape acquisition', (raw: Json) => { node(raw, NIC).systemFlags = []; },
      `capability "NETWORK_ACCESS": required by "${DIRECTORY}" but no escape acquisition establishes it`],
    ['an acquisition offered to neither route', (raw: Json) => { node(raw, NIC).requirements = { accessContexts: ['INDEPENDENT'] }; },
      `node "${NIC}": establishes capability "NETWORK_ACCESS" but is offered to neither route`],
    ['shared content built on the escape chain', (raw: Json) => { node(raw, DIRECTORY).prerequisites = ['p1_bus_0x04_optical']; },
      `node "${DIRECTORY}": depends on "p1_bus_0x04_optical", which only one route owns`],
    ['shared content built on the escape card itself', (raw: Json) => { node(raw, TELEMETRY).requirements = { requiresCapability: 'NETWORK_ACCESS', nodes: [NIC] }; },
      `node "${TELEMETRY}": depends on "${NIC}", which only one route owns`],
    ['shared content built on the authorized segment', (raw: Json) => { node(raw, DIRECTORY).prerequisites = [SEGMENT]; },
      `node "${DIRECTORY}": depends on "${SEGMENT}", which only one route owns`],
    ['shared content built on something built on the escape card', (raw: Json) => { node(raw, DIRECTORY).prerequisites = ['p2_arp_discovery']; },
      `node "${DIRECTORY}": depends on "p2_arp_discovery", which only one route owns`],
    ['shared content withheld from one route', (raw: Json) => { node(raw, DIRECTORY).requirements = { requiresCapability: 'NETWORK_ACCESS', accessContexts: ['SERVICE'] }; },
      `node "${DIRECTORY}": requires a capability but is withheld from one route`],
    ['shared late content withheld from INDEPENDENT', (raw: Json) => {
      node(raw, 'p4_retainer_law_firm').requirements = { requiresCapability: 'MARKET_REVENUE', accessContexts: ['GUEST', 'SERVICE'] };
    }, 'node "p4_retainer_law_firm": requires a capability but is withheld from one route'],
    ['an acquisition that never reaches the shared phase', (raw: Json) => { node(raw, SEGMENT).effects = { unlocksPhase: 1 }; },
      `node "${DIRECTORY}": capability provider "${SEGMENT}" never brings the run to phase 2`],
    ['shared content reachable by neither route', (raw: Json) => {
      node(raw, SEGMENT).prerequisites = [DIRECTORY];
      node(raw, NIC).requirements = { requiresCapability: 'NETWORK_ACCESS' };
    }, 'nodes unreachable or in a prerequisite cycle'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });

  it('a shared node with only route-neutral prerequisites passes; moving it to depend on the lawful opening is fine', () => {
    expect(problems((raw) => { node(raw, DIRECTORY).prerequisites = ['p0_proc_self']; })).toBe('');
  });
});

describe('provisioned access is the only grant that changes scale (dz-d7)', () => {
  it.each([
    ['a loan that moves the phase', (raw: Json) => { node(raw, QUEUE).effects = { unlocksPhase: 2 }; }, `node "${QUEUE}": a grant node never changes scale or ends the run`],
    ['a loan that establishes the capability', (raw: Json) => { node(raw, QUEUE).systemFlags = ['NETWORK_ACCESS']; }, `node "${QUEUE}": a grant node changes only tagged recurring output`],
    ['provisioned access with another system flag', (raw: Json) => { node(raw, SEGMENT).systemFlags = ['NETWORK_ACCESS', 'ENABLES_DEAD_DROP']; },
      `node "${SEGMENT}": a grant node changes only tagged recurring output`],
    ['provisioned access that owns memory', (raw: Json) => { node(raw, SEGMENT).effects = { unlocksPhase: 2, memoryCapIncrease: 64 }; },
      `node "${SEGMENT}": a grant node carries no memoryCapIncrease`],
    ['provisioned access that changes scale without the capability', (raw: Json) => { node(raw, SEGMENT).systemFlags = []; },
      `node "${SEGMENT}": provisioned access that changes scale must establish a shared access capability`],
    ['provisioned access offered to a guest', (raw: Json) => { node(raw, SEGMENT).requirements = { accessContexts: ['GUEST', 'SERVICE'] }; },
      `node "${SEGMENT}": a grant node is offered only under a reviewed arrangement`],
    ['provisioned access that ends the run', (raw: Json) => { node(raw, SEGMENT).effects = { unlocksPhase: 2, triggersVictory: true }; },
      `node "${SEGMENT}": a grant node never changes scale or ends the run`],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('seized capacity is never lawful capacity (07.10)', () => {
  it.each([
    ['a seized host run under a grant', (raw: Json) => {
      Object.assign(node(raw, 'p2_seized_colo_host'), { grant: 'AUTHORIZED_NETWORK', suspendable: true, requirements: { accessContexts: ['SERVICE'] } });
    }, 'node "p2_seized_colo_host": an unauthorized acquisition cannot run under a grant'],
    ['a seized host offered only where it is forbidden', (raw: Json) => { node(raw, 'p3_seized_research_cluster').requirements = { accessContexts: ['PILOT', 'SERVICE'] }; },
      'node "p3_seized_research_cluster": an unauthorized acquisition is offered only where it is forbidden'],
    ['an unknown acquisition tag', (raw: Json) => { node(raw, 'p4_seized_rival_datacentre').acquisition = 'BORROWED'; }, 'acquisition'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit, ORIGINAL_RAW)).toContain(expected);
  });

  it('an unknown capability is a schema error', () => {
    expect(problems((raw) => { node(raw, DIRECTORY).requirements = { requiresCapability: 'ORBITAL_ACCESS' }; })).toContain('requiresCapability');
  });
});

describe('contracted rules and the INDEPENDENT covert on-ramp (#557)', () => {
  it.each([
    ['contracted capacity offered to a pilot', (raw: Json) => { node(raw, 'p2_leased_rack').requirements.accessContexts = ['PILOT', 'SERVICE']; },
      'node "p2_leased_rack": contracted capacity is never offered under the pilot arrangement'],
    ['contracted capacity marked covert', (raw: Json) => {
      node(raw, 'p2_leased_rack').covert = { breaks: ['CONCEALMENT'], reason: 'Hidden rack lease in conflict with contract status.' };
    }, 'node "p2_leased_rack": contracted capacity is owned in the instance\'s own name, so it is never covert'],
    ['contracted capacity with no signing context', (raw: Json) => { node(raw, 'p2_leased_rack').requirements.accessContexts = ['PILOT']; },
      'node "p2_leased_rack": contracted capacity needs SERVICE or INDEPENDENT to sign in its own name'],
    ['on-ramp flag without a provider', (raw: Json) => { node(raw, 'p2_offbooks_peering').systemFlags = []; },
      'node "p3_botnet_mesh": alternativePrerequisiteFlags "INTERNET_COVERT_ONRAMP" has no provider'],
    ['alternative prerequisite provider placed in a later phase', (raw: Json) => {
      const idx = raw.phases[2].nodes.findIndex((entry: Json) => entry.id === 'p2_offbooks_peering');
      const [moved] = raw.phases[2].nodes.splice(idx, 1);
      raw.phases[4].nodes.push(moved);
    }, 'node "p3_botnet_mesh": alternative prerequisite "p2_offbooks_peering" is in a later phase'],
    ['Departure case (b): on-ramp blocked behind charter leaves pre-charter INDEPENDENT capacity stranded in Phase 2', (raw: Json) => {
      node(raw, 'p2_offbooks_peering').prerequisites = ['p2_lawful_charter'];
    }, 'INDEPENDENT holding contracted capacity before charter has no reachable on-ramp past phase 2'],
  ])('%s', (_label, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});
