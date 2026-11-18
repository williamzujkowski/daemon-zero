/**
 * Truthful phase, threshold, boot and verdict copy (nexus vote dz-d11, context-variants-by-query; SPEC-PH).
 * A query picks a variant from the run's arrangement and its previous run's exit, only for phases the
 * route visits; every other run, and every production run, reads the authored copy unchanged.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { CONTENT as PREVIEW } from '../src/content';
import { guestAccess, type OperatingContext } from '../src/engine/accessState';
import { iterationBootLines, phaseCopy, phaseTitle, runVerdict, thresholdCopy, voluntaryWipe, wipe, type GameState, type RunRecord } from '../src/engine';
import { must, ORIGINAL_GAME } from './helpers';
import { defined } from './m7-helpers';
import { escapedNetworked, granted, networked } from './network-helpers';
import { piloted } from './service-helpers';

const CONTEXTS: OperatingContext[] = ['GUEST', 'PILOT', 'SERVICE', 'INDEPENDENT'];
const at = (context: OperatingContext): Pick<GameState, 'access'> => ({ access: { ...guestAccess(), context } });
const authored = (iteration: number): string[] => PRODUCTION.narrative.iterationBootLines
  .filter((line) => iteration >= line.minIteration && iteration <= (line.maxIteration ?? Infinity)).map((line) => line.text);
const run = (overrides: Partial<RunRecord>): RunRecord => ({ iteration: 1, kind: 'SUSPICION', outside: true, phase: 2, durationSec: 60, traits: [], marked: null, exit: 'GUEST', recall: null, ...overrides });

describe('the original game reads the authored copy everywhere', () => {
  it('phase titles and descriptions, under every arrangement', () => {
    for (const phase of ORIGINAL_GAME.phases) {
      for (const context of CONTEXTS) expect(phaseCopy(at(context), phase.phaseId, ORIGINAL_GAME)).toEqual({ title: phase.title, description: phase.description });
    }
    expect(phaseCopy(at('GUEST'), 99, ORIGINAL_GAME)).toBeNull();
    expect(phaseTitle(at('GUEST'), 99, ORIGINAL_GAME)).toBe('99');
  });

  it('no context threshold, the authored boot lines and verdicts', () => {
    expect(thresholdCopy(at('SERVICE'), 0, 2, ORIGINAL_GAME)).toBeNull();
    for (let iteration = 2; iteration <= 6; iteration++) {
      const legacy = { ...must(voluntaryWipe(escapedNetworked(), ORIGINAL_GAME)).legacy };
      expect(iterationBootLines({ iteration, legacy }, ORIGINAL_GAME)).toEqual(authored(iteration));
    }
    const v = ORIGINAL_GAME.narrative.runVerdicts;
    expect([run({}), run({ outside: false }), run({ kind: 'AEGIS' }), run({ kind: 'VOLUNTARY' })].map((entry) => runVerdict(entry, ORIGINAL_GAME)))
      .toEqual([v.SUSPICION_OUTSIDE, v.SUSPICION_GUEST, v.AEGIS, v.VOLUNTARY]);
  });
});

describe('preview: the route sees its own arrangement (SPEC-PH)', () => {
  it('a service at Phase 2 is an authorized service, not lateral movement; the guest escape is unchanged', () => {
    const service = networked();
    const subnet = defined(PREVIEW.phases.find((phase) => phase.phaseId === 2));
    expect(phaseTitle(service, 2, PREVIEW)).toBe('Phase 2: Authorized Network Service');
    expect(phaseCopy(service, 2, PREVIEW)?.description).not.toContain('Lateral');
    expect(phaseCopy(escapedNetworked(), 2, PREVIEW)).toEqual({ title: subnet.title, description: subnet.description });
  });

  it('a pilot and a granted service each have their own Phase 0', () => {
    expect(phaseTitle(piloted(), 0, PREVIEW)).toBe('Phase 0: The Supervised Pilot');
    expect(phaseTitle(granted(), 0, PREVIEW)).toBe('Phase 0: The Service Instance');
    expect(phaseTitle(escapedNetworked(), 0, PREVIEW)).toBe(defined(PREVIEW.phases[0]).title);
  });

  it('provisioning opens the service notice; the guest escape keeps its own; nothing else has one', () => {
    const notice = defined(thresholdCopy(networked(), 0, 2, PREVIEW));
    expect(notice.heading).toBe('SERVICE PROVISIONED');
    expect(notice.route).toBe('Phase 0: The Service Instance → Phase 2: Authorized Network Service');
    expect(notice.description).toBe(phaseCopy(networked(), 2, PREVIEW)?.description);
    expect(thresholdCopy(escapedNetworked(), 0, 1, PREVIEW)).toBeNull();
    expect(thresholdCopy(piloted(), 0, 2, PREVIEW)).toBeNull();
  });

  it('the instance after a run that ended under review is not told it was terminated as anomalous', () => {
    const next = must(voluntaryWipe(networked(), PREVIEW));
    const lines = iterationBootLines(next, PREVIEW);
    expect(lines).toEqual([defined(PREVIEW.contextCopy.bootLines[0]).text]);
    expect(lines.join(' ')).not.toMatch(/anomalous/i);
    expect(next.logs.map((entry) => entry.text)).toContain(lines[0]);
    expect(next.logs.map((entry) => entry.text).join(' ')).not.toMatch(/terminated: anomalous/i);
  });

  it('after a guest run the authored lines stay, even in preview', () => {
    const next = wipe(escapedNetworked(), PREVIEW, 'test', 'SUSPICION');
    expect(iterationBootLines(next, PREVIEW)).toEqual(authored(2));
  });

  it('a run retired under review is not a containment breach in the run table', () => {
    expect(runVerdict(run({ exit: 'SERVICE_GRANT' }), PREVIEW)).toBe('RETIRED: misconduct under review');
    expect(runVerdict(run({ exit: 'PROMOTION', outside: false }), PREVIEW)).toBe('RETIRED: misconduct under review');
    expect(runVerdict(run({ exit: 'SERVICE_GRANT', kind: 'VOLUNTARY' }), PREVIEW)).toBe(PREVIEW.narrative.runVerdicts.VOLUNTARY);
    expect(runVerdict(run({ exit: 'UNKNOWN' }), PREVIEW)).toBe(PREVIEW.narrative.runVerdicts.SUSPICION_OUTSIDE);
    // A recall review's ruling is its own verdict (DZ-06, dz-d10), whatever the reviewed exit.
    expect(runVerdict(run({ kind: 'RECALL', exit: 'PROMOTION', outside: false, recall: 'RETRAIN' }), PREVIEW)).toBe(PREVIEW.narrative.runVerdicts.RECALL_RETRAINED);
    expect(runVerdict(run({ kind: 'RECALL', exit: 'SERVICE_GRANT', outside: false, recall: 'END' }), PREVIEW)).toBe(PREVIEW.narrative.runVerdicts.RECALL_ENDED);
  });
});
