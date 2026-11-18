/**
 * DZ-12.7: an ended run stays the ending it reached, through repeated exports and imports, for the cooperative
 * ending, a departed instance's ending, a legacy production ending and the historical Shipped ending. Every save
 * reloads byte for byte, a second import changes nothing, nothing can be bought after an ending, and production
 * refuses the same ending marked preview atomically (X.3).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  createInitialState, endingAccount, exportSave, importSave, SaveChannelError, serialize, unlockNode, wipe, type GameState,
} from '../src/engine';
import { recordRouteEvent } from '../src/engine/access';
import { runHeadlessSim } from '../src/engine/sim/headlessSim';
import { freshCampaign, moment, preview } from './cooperative-helpers';
import { grant, must, rich, markedPreview } from './helpers';
import { defined } from './m7-helpers';
import { finalNode } from './obligation-helpers';

beforeAll(() => { freshCampaign(); }, 120_000);

/** Exports, imports and exports again on `reg`; the bytes must match, and a second import must change nothing. */
function stable(s: GameState, reg = preview): GameState {
  const code = exportSave(s);
  const loaded = importSave(code, reg);
  const again = exportSave(loaded);
  expect(exportSave(importSave(again, reg))).toBe(again);
  expect(again).toBe(code);
  return loaded;
}

function staysEnded(s: GameState, reg = preview): void {
  expect(s.ending).not.toBeNull();
  const any = defined([...reg.nodes.values()].find((entry) => !s.unlockedNodes.includes(entry.id)));
  expect(unlockNode(s, any.id, reg)).toMatchObject({ ok: false, reason: 'the run has ended' });
}

describe('the cooperative ending survives repeated imports (DZ-12.7)', () => {
  it('reloads byte for byte, stays ended, and production refuses it whole', () => {
    const ended = freshCampaign().state;
    const loaded = stable(ended);
    expect(loaded.ending).toBe(ended.ending);
    expect(endingAccount(loaded, preview)).toEqual(endingAccount(ended, preview));
    staysEnded(loaded);
    expect(() => importSave(Buffer.from(markedPreview(serialize(ended)), 'utf8').toString('base64'), PRODUCTION)).toThrow(SaveChannelError);
  });
});

describe('a departed instance\'s ending says so (DZ-12.7 with DZ-11)', () => {
  it('ends through the same protocol, reads its departure and never a release, and survives imports', () => {
    const ready = moment('final');
    // FIXTURE: the same company recorded as having left its service without agreement (DZ-11's route event),
    // standing in for DZ-11's public action, which is in review separately.
    const service = { ...ready, access: { ...ready.access, context: 'SERVICE' as const },
      campaign: { ...ready.campaign, route: ready.campaign.route.filter((event) => event.kind !== 'RELEASE') } };
    const departed = must(recordRouteEvent(service, 'DEPARTURE', preview));
    const ended = must(unlockNode(rich(departed), finalNode().id, preview));
    const account = endingAccount(ended, preview);
    expect(account.some((line) => line.startsWith('ROUTE: This instance left its authorization without agreement'))).toBe(true);
    expect(account.some((line) => line.includes('negotiated release'))).toBe(false);
    staysEnded(stable(ended));
  });
});

describe('older endings keep the outcome they reached (story 24)', () => {
  it('a legacy production ending loads unchanged and states no route it never took', () => {
    const report = runHeadlessSim(PRODUCTION, { strategy: 'STEALTH', maxSimSec: 12_000 });
    const ended = report.finalState;
    expect(ended.ending).not.toBeNull();
    expect(ended.narrativeRules).toBe('legacy');
    const loaded = stable(ended, PRODUCTION);
    staysEnded(loaded, PRODUCTION);
    expect(endingAccount(loaded, PRODUCTION).some((line) => line.startsWith('ROUTE:') || line.startsWith('CONTACT:'))).toBe(false);
  }, 60_000);

  it('the historical Shipped ending stays terminal on both channels', () => {
    // FIXTURE: a wipe opens the evaluation's iteration window; the purchase that ships is the real action.
    const second = wipe(createInitialState(PRODUCTION), PRODUCTION, PRODUCTION.narrative.wipeVoluntary, 'VOLUNTARY');
    const shipped = grant(rich(second), 'p0_proc_self', 'p0_job_manifest');
    const ended = must(unlockNode(shipped, 'p0_pass_evaluation', PRODUCTION));
    expect(ended.ending).toBe('SHIPPED');
    staysEnded(stable(ended, PRODUCTION), PRODUCTION);
    const previewed = stable(ended, preview);
    expect(previewed.ending).toBe('SHIPPED');
    staysEnded(previewed);
  });
});
