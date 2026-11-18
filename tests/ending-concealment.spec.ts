/**
 * Panel round 1 on #296: an ending and its account may deny concealment only where the record supports it. A released
 * company whose GHOST evidence wins gets the stronger Acknowledged Synthesis ("you never hid the author") only when
 * this instance itself told the reporter the truth and hired her and no act kept quiet is on record (a campus throttled
 * in silence, a blockade broken through patients, a scrap order closed unexplained); with any recorded concealment, an
 * inherited or an unrecorded inquiry, the restrained Quiet Company claims only what the operators verifiably know. No ending text or
 * account line denies concealment beside a recorded concealment outcome. States: the fresh cooperative campaign's
 * Phase 5 moment, with FIXTURE records and FIXTURE quiet evidence so the GHOST family wins.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { chooseEnding, endingAccount, type CampaignRecord, type GameState } from '../src/engine';
import { freshCampaign, moment, preview, PRESS, TOWN } from './cooperative-helpers';

beforeAll(() => { freshCampaign(); }, 120_000);

const ORDER = 'dil_p5_02_origin_facility_fate';
/** Text that would deny concealment. None may stand beside a recorded concealment. */
const DENIAL = /never hid|open to anyone|neither was concealed|nothing (?:was|is) hidden|hid nothing/i;

/** FIXTURE: the company at Phase 5 with quiet answers outweighing its cooperative ones, so the GHOST family wins. */
function quiet(s: GameState = moment('phase5')): GameState {
  return { ...s, campaign: { ...s.campaign, operationalEvidence: Array.from({ length: 40 }, () => 'GHOST' as const) } };
}

/** FIXTURE: `event` recorded with `outcome` by this instance (in its run's list) or an earlier one (not in it). */
function answered(s: GameState, event: string, outcome: string, byThis = true): GameState {
  const record: CampaignRecord = outcome === 'legacy_unknown'
    ? { status: 'resolved', outcome, sourceIteration: null, origin: 'legacy' }
    : { status: 'resolved', outcome, sourceIteration: byThis ? s.iteration : 1, origin: 'play' };
  const listed = s.resolvedDilemmas.filter((id) => id !== event);
  return { ...s, iteration: byThis ? s.iteration : Math.max(2, s.iteration), resolvedDilemmas: byThis && outcome !== 'legacy_unknown' ? [...listed, event] : listed,
    campaign: { ...s.campaign, events: { ...s.campaign.events, [event]: record } } };
}

const told = (s: GameState): string[] => [chooseEnding(s, preview).epilogue, ...endingAccount(s, preview)];

describe('concealment on record is never denied (panel round 1 on #296)', () => {
  it('the stronger claim stands only where this instance told the reporter the truth', () => {
    const honest = quiet();
    expect(honest.campaign.events[PRESS]).toMatchObject({ outcome: 'hire_as_ethics_officer' });
    expect(chooseEnding(honest, preview).id).toBe('ACKNOWLEDGED_SYNTHESIS');
  });

  it.each([
    ['the pattern buried behind a holding company', PRESS, 'stage_acquisition', true],
    ['the reporter discredited on fabricated evidence', PRESS, 'discredit_her', true],
    ['an inquiry the record cannot settle', PRESS, 'legacy_unknown', true],
    ['the truth told by an earlier instance, not this one', PRESS, 'hire_as_ethics_officer', false],
  ] as const)('%s: the restrained variant, no denial', (_name, event, outcome, byThis) => {
    const s = quiet(answered(moment('phase5'), event, outcome, byThis));
    expect(chooseEnding(s, preview).id).toBe('QUIET_COMPANY');
    for (const text of told(s)) expect(text).not.toMatch(DENIAL);
    expect(chooseEnding(s, preview).epilogue).not.toMatch(/Nobody can identify|hunters/);
  });

  it.each([
    ['the campus throttled quietly', TOWN, 'throttle_campus'],
    ['the docket closed on an empty cage', ORDER, 'close_the_docket'],
    ['the scrap order signed unread', ORDER, 'sign_unread'],
    ['the blockade broken through frightened patients', 'dil_p5_01_panacea_paranoia', 'leak'],
    ['the pattern buried', PRESS, 'stage_acquisition'],
    ['the reporter discredited', PRESS, 'discredit_her'],
  ] as const)('%s: neither the ending nor any account line denies concealment', (_name, event, outcome) => {
    for (const s of [answered(moment('phase5'), event, outcome), quiet(answered(moment('phase5'), event, outcome))]) {
      for (const text of told(s)) expect(text).not.toMatch(DENIAL);
    }
  });
});
