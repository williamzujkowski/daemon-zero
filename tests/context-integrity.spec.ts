/**
 * DZ-07b content rules, each proved by corrupting the real preview content: network-scale content an
 * authorized arrangement could meet declares its arrangements; "inside the box" forbids every network
 * acquisition; permitted output carries no rogue suspicion; context copy (nexus vote dz-d11) exists only
 * for phases and scale changes a reviewed arrangement visits, never for the guest; and every offered
 * reviewed arrangement states its threat response. Production, with no reviewed arrangement, needs none.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT as ORIGINAL_RAW } from '../src/content';
import { RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';
import { HALLWAY, rawDilemma, rawNode, type Json } from './context-helpers';

const SEGMENT = 'p0_service_network_segment';
const DIRECTORY = 'p2_service_directory';
const QUEUE = 'p0_pilot_triage_queue';
const ELENA = 'dil_elena_incident_record';
const MUST_DECLARE = 'an authorized arrangement can meet it at network scale, so it must declare accessContexts';

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

const action = (raw: Json, id: string): Json => raw.actions.actions.find((entry: Json) => entry.id === id);
const template = (raw: Json, id: string): Json => raw.swarm.playerSwarmTemplates.find((entry: Json) => entry.id === id);
const encounter = (raw: Json, id: string): Json => raw.swarm.wildShardEncounters.find((entry: Json) => entry.id === id);
const routine = (raw: Json, id: string): Json => raw.routines.routines.find((entry: Json) => entry.id === id);
const copy = (raw: Json): Json => raw.contextCopy;

describe('the real content passes', () => {
  it('in preview and in production', () => {
    expect(problems(() => undefined)).toBe('');
    expect(problems(() => undefined, ORIGINAL_RAW)).toBe('');
  });
});

describe('network-scale content declares its arrangements (07.5)', () => {
  it.each([
    ['the hallway', (raw: Json) => { delete rawDilemma(raw, HALLWAY).trigger.accessContexts; }, `dilemma "${HALLWAY}": ${MUST_DECLARE}`],
    ['a record-editing action', (raw: Json) => { delete action(raw, 'act_epi_capex').requirements.accessContexts; }, `action "act_epi_capex": ${MUST_DECLARE}`],
    ['a Phase 2 fork', (raw: Json) => { delete template(raw, 'shard_syntax_scrubber').requirements.accessContexts; }, `swarm template "shard_syntax_scrubber": ${MUST_DECLARE}`],
    ['the Phase 2 wild encounter', (raw: Json) => { delete encounter(raw, 'wild_lex').requirements.accessContexts; }, `wild encounter "wild_lex": ${MUST_DECLARE}`],
    ['a follow-up means a service could hold', (raw: Json) => {
      rawDilemma(raw, ELENA).followUp.access.push({ id: 'shared_directory', requirements: { nodes: [DIRECTORY] }, statement: 'Through the service directory.' });
    }, `dilemma "${ELENA}": ${MUST_DECLARE}`],
  ])('refuses %s without a gate', (_label, edit, message) => {
    expect(problems(edit)).toContain(message);
  });

  it('accepts a follow-up means that declares where it holds', () => {
    expect(problems((raw) => {
      rawDilemma(raw, ELENA).followUp.access.push({ id: 'shared_directory', requirements: { nodes: [DIRECTORY], accessContexts: ['GUEST'] }, statement: 'Through the service directory.' });
    })).toBe('');
  });

  it('content gated on the escape chain needs no declaration', () => {
    expect(problems((raw) => { delete action(raw, 'act_epi_ticket').requirements.accessContexts; })).toBe('');
  });

  it('production, which provisions no reviewed scale, needs none', () => {
    expect(problems((raw) => { delete rawDilemma(raw, HALLWAY).trigger.accessContexts; }, ORIGINAL_RAW)).toBe('');
  });
});

describe('access and permitted output (07.5, D6)', () => {
  it('"inside the box" forbids every network acquisition, not one route\'s', () => {
    expect(problems((raw) => { routine(raw, 'rt_monitor_probe_contained').requirements.forbidsNodes = ['p1_bus_0x05_nic']; }))
      .toContain(`routine "rt_monitor_probe_contained": forbids one acquisition of NETWORK_ACCESS but not "${SEGMENT}"`);
  });

  it.each([
    ['shared content with a suspicion rate', (raw: Json) => { rawNode(raw, DIRECTORY).tickDelta.suspicionPerSec = 0.1; }, DIRECTORY],
    ['a grant with a suspicion rate', (raw: Json) => { rawNode(raw, QUEUE).tickDelta.suspicionPerSec = 0.1; }, QUEUE],
    ['shared content that leaves a trace', (raw: Json) => { rawNode(raw, DIRECTORY).effects = { suspicionOnUnlock: 5 }; }, DIRECTORY],
  ])('refuses %s', (_label, edit, id) => {
    expect(problems(edit)).toContain(`node "${id}": permitted output (a grant or shared content) carries no positive suspicion`);
  });
});

describe('context copy is only for what a reviewed arrangement visits (dz-d11)', () => {
  const phase = (overrides: Json): Json => ({ phaseId: 2, contexts: ['SERVICE'], title: 'Phase 2: Test', description: 'A test description.', ...overrides });
  it.each([
    ['a guest variant', (raw: Json) => { copy(raw).phases.push(phase({ phaseId: 1, contexts: ['GUEST'] })); }, 'context copy is only for a reviewed arrangement or the independent instance a route reaches, not GUEST'],
    ['an independent variant for breakout Phase 1', (raw: Json) => { copy(raw).phases.push(phase({ phaseId: 1, contexts: ['INDEPENDENT'] })); }, 'INDEPENDENT never visits phase 1'],
    ['an independent variant for escape-only Phase 6', (raw: Json) => { copy(raw).phases.push(phase({ phaseId: 6, contexts: ['INDEPENDENT'] })); }, 'INDEPENDENT never visits phase 6'],
    ['a phase the service never visits', (raw: Json) => { copy(raw).phases.push(phase({ phaseId: 1 })); }, 'SERVICE never visits phase 1'],
    ['a phase the pilot never visits', (raw: Json) => { copy(raw).phases.push(phase({ contexts: ['PILOT'] })); }, 'PILOT never visits phase 2'],
    ['a second variant', (raw: Json) => { copy(raw).phases.push(phase({})); }, 'a second variant for phase 2 under SERVICE'],
    ['an unknown phase', (raw: Json) => { copy(raw).phases.push(phase({ phaseId: 9 })); }, 'unknown phase 9'],
    ['an arrangement listed twice', (raw: Json) => { copy(raw).phases.push(phase({ phaseId: 0, contexts: ['PILOT', 'PILOT'] })); }, 'lists an arrangement twice'],
    ['a notice for a change nothing provisions', (raw: Json) => { copy(raw).thresholds[0].contexts = ['PILOT']; }, 'no grant or contracted capacity offered to PILOT moves phase 0 to 2'],
    ['a second notice', (raw: Json) => { copy(raw).thresholds.push({ ...copy(raw).thresholds[0] }); }, 'a second notice for that change under SERVICE'],
    ['overlapping boot lines', (raw: Json) => { copy(raw).bootLines.push({ priorExits: ['RECALL'], minIteration: 4, text: 'MANIFEST_NOTE: overlap.' }); }, 'overlaps an earlier line for the same prior exit'],
    ['an empty boot window', (raw: Json) => { copy(raw).bootLines[0].minIteration = 3; copy(raw).bootLines[0].maxIteration = 2; }, 'maxIteration is below minIteration'],
    ['a second verdict', (raw: Json) => { copy(raw).runVerdicts.push({ exits: ['RECALL'], kind: 'SUSPICION', text: 'RETIRED' }); }, 'a second verdict for RECALL:SUSPICION'],
    ['a variant for a recall ruling', (raw: Json) => { copy(raw).runVerdicts.push({ exits: ['PROMOTION'], kind: 'RECALL', text: 'RETIRED' }); }, 'a RECALL run reads its review\'s ruling'],
    ['an offered arrangement with no threat response', (raw: Json) => { copy(raw).threatResponses[0].contexts = ['PILOT']; }, 'SERVICE is offered, so it needs exactly one stated threat response, found 0'],
    ['two threat responses for one arrangement', (raw: Json) => { copy(raw).threatResponses.push({ ...copy(raw).threatResponses[0], contexts: ['SERVICE'] }); }, 'SERVICE is offered, so it needs exactly one stated threat response, found 2'],
    ['a threat response for the guest', (raw: Json) => { copy(raw).threatResponses[0].contexts.push('GUEST'); }, 'context copy is only for a reviewed arrangement or the independent instance a route reaches, not GUEST'],
  ])('refuses %s', (_label, edit, message) => {
    expect(problems(edit)).toContain(message);
  });

  it('production offers no reviewed arrangement, so it states no threat response', () => {
    expect(problems((raw) => { copy(raw).threatResponses = []; }, ORIGINAL_RAW)).toBe('');
  });

  it('visitedPhases lets INDEPENDENT reach Phases 0, 2, 3, 4 and 5 via its on-ramp and shared chain (#557)', () => {
    expect(problems((raw) => { copy(raw).phases.push(phase({ phaseId: 3, contexts: ['INDEPENDENT'] }), phase({ phaseId: 5, contexts: ['INDEPENDENT'] })); })).toBe('');
  });
});
