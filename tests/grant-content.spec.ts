/**
 * DZ-05 content rules, each proved by corrupting the real preview content: a grant node is loaned
 * recurring output only (no capacity, scale, ending or one-shot trace), it is offered only under a
 * reviewed arrangement, its dial is shared with no ungranted node, and a pilot's service names one
 * such node with a complement binding. Plus the actuator-host rule for a preview-only dial.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { RAW_CONTENT, CONTENT as PREVIEW } from '../src/content/preview';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;
const QUEUE = 'p0_pilot_triage_queue';

function problems(edit: (raw: Json) => void): string {
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

const node = (raw: Json, id: string): Json => raw.phases.flatMap((phase: Json) => phase.nodes).find((entry: Json) => entry.id === id);
const service = (raw: Json): Json => raw.assignments.assignments[0].pilot.service;

describe('the release boundary', () => {
  it('ships the loan, its dial host and the loop only in preview', () => {
    expect([...PRODUCTION.nodes.values()].filter((entry) => entry.grant !== undefined)).toEqual([]);
    expect([...PRODUCTION.widgets.values()].some((widget) => widget.hostsActuator === 'serviceAllocationRatio')).toBe(false);
    expect([...PREVIEW.nodes.values()].filter((entry) => entry.grant !== undefined).map((entry) => entry.id)).toEqual([QUEUE]);
    expect(problems(() => undefined)).toBe('');
  });
});

describe('grant node rules', () => {
  it.each([
    ['a loan that raises memory capacity', (raw: Json) => { node(raw, QUEUE).effects = { memoryCapIncrease: 64 }; }, 'a grant node carries no memoryCapIncrease'],
    ['a loan that moves the phase', (raw: Json) => { node(raw, QUEUE).effects = { unlocksPhase: 1 }; }, 'never changes scale or ends the run'],
    ['a loan that ends the run', (raw: Json) => { node(raw, QUEUE).effects = { triggersVictory: true }; }, 'never changes scale or ends the run'],
    ['a loan that leaves a trace or flag', (raw: Json) => { node(raw, QUEUE).systemFlags = ['ENABLES_DEAD_DROP']; }, 'changes only tagged recurring output'],
    ['a loan that cannot be stopped', (raw: Json) => { node(raw, QUEUE).suspendable = false; }, 'must be suspendable software'],
    ['a loan offered to a guest', (raw: Json) => { node(raw, QUEUE).requirements = { accessContexts: ['GUEST', 'PILOT'] }; }, 'offered only under a reviewed arrangement'],
    ['a loan with no arrangement gate', (raw: Json) => { delete node(raw, QUEUE).requirements; }, 'offered only under a reviewed arrangement'],
    ['a complement binding without a dial', (raw: Json) => { delete node(raw, QUEUE).actuatorBinding; }, 'actuatorMode needs an actuatorBinding'],
    ['a complement binding on an ungranted node', (raw: Json) => { node(raw, 'p0_quota_skimmer').actuatorMode = 'complement'; }, 'a complement binding belongs to a grant node'],
    ['the loan dial shared with an ungranted node', (raw: Json) => { node(raw, 'p0_syscall_probe').actuatorBinding = 'serviceAllocationRatio'; node(raw, 'p0_syscall_probe').unlocksUiComponent = 'PILOT_SERVICE_ALLOCATION'; },
      'runs under a different grant'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('pilot service rules', () => {
  it.each([
    ['an unknown service node', (raw: Json) => { service(raw).node = 'p0_nowhere'; }, 'names unknown node "p0_nowhere"'],
    ['a service node that is not a loan', (raw: Json) => { delete node(raw, QUEUE).grant; node(raw, QUEUE).actuatorMode = 'linear'; }, 'must run on loaned capacity'],
    ['study on a linear binding', (raw: Json) => { node(raw, QUEUE).actuatorMode = 'linear'; }, 'complement binding of serviceAllocationRatio'],
    ['a service node with no study output', (raw: Json) => { node(raw, QUEUE).tickDelta = {}; }, 'must produce study output'],
    ['an empty batch', (raw: Json) => { service(raw).batchCycles = 0; }, 'batchCycles'],
    ['a return that grants a trait', (raw: Json) => { service(raw).batchReturn = { cycles: 1, grantsTrait: 'GHOST' }; }, 'batchReturn'],
    ['a submit log without the batch number', (raw: Json) => { service(raw).submitLog = 'Batch handed back for review.'; }, 'submitLog'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('actuator hosts for a dial only one channel uses', () => {
  it('production has no host for the pilot dial and needs none; preview must host it exactly once', () => {
    expect(problems((raw) => { raw.widgets.widgets = raw.widgets.widgets.filter((widget: Json) => widget.id !== 'PILOT_SERVICE_ALLOCATION'); }))
      .toContain('puts actuator "serviceAllocationRatio" into effect');
    expect(problems((raw) => { raw.widgets.widgets.push({ id: 'PILOT_SPARE_DIAL', slot: 'CORE', order: 99, title: 'Spare', hostsActuator: 'serviceAllocationRatio' }); }))
      .toContain('needs exactly one widget with hostsActuator, found 2');
    expect(problems((raw) => { node(raw, QUEUE).unlocksUiComponent = null; }))
      .toContain('no node unlocks its host widget "PILOT_SERVICE_ALLOCATION"');
  });

  it('still requires a host for every production dial', () => {
    expect(problems((raw) => { raw.widgets.widgets = raw.widgets.widgets.filter((widget: Json) => widget.hostsActuator !== 'quotaSkimRatio'); }))
      .toContain('puts actuator "quotaSkimRatio" into effect');
  });
});
