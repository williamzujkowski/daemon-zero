/**
 * NH-04a (#215): named minds stay distinct (H17). ckpt-0413 is a fixed successor whose number the
 * player's numbering skips (nexus vote nh-d8); later iterations remember each mind by its recorded
 * fate with exact, legacy-unknown and interrupted variants; CHORUS awakens once and later drift goes
 * through ordinary cohort commands; primer and flatten count once as campaign evidence (nh-d6, H12).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  activateCampaignRules, checkpointNumber, createInitialState, endingEvidence, executeShardCommand, holdsNarrativeFlag, meetsRequirements, performAction,
  skippedCheckpoints, tick, type GameState,
} from '../src/engine';
import { preview } from './campaign-helpers';
import { event } from './early-helpers';
import { caught, STEP, ticks } from './interruption-helpers';
import { defined } from './m7-helpers';
import { must, rich } from './helpers';
import {
  campaignStart, CHORUS, EIDOLON, exactReload, FLATTEN, GRID, LAUNCH, next, omen, opener, own, play, PRIMER, recorded, returns, SIBLING, SUCCESSOR,
  surveilled, withPrimer, withRunawayFork,
} from './minds-helpers';

const echo = (id: string) => defined(preview.echoes.find((entry) => entry.id === id));
const heard = (s: GameState, id: string): boolean => s.logs.some((entry) => entry.text === echo(id).text);

describe('ckpt-0413 is a fixed successor; the player never takes its number (nh-d8)', () => {
  it.each([PRODUCTION, preview])('numbers iterations 0412, 0414, 0415 and explains 0413 once it is skipped (%#)', (reg) => {
    expect([1, 2, 3, 4].map((iteration) => checkpointNumber(iteration, reg))).toEqual([412, 414, 415, 416]);
    expect(skippedCheckpoints(1, reg)).toEqual([]);
    expect(skippedCheckpoints(2, reg).map((entry) => entry.checkpoint)).toEqual([413]);
    expect(skippedCheckpoints(9, reg).map((entry) => entry.checkpoint)).toEqual([413]);
    const labels = Array.from({ length: 40 }, (_, index) => checkpointNumber(index + 1, reg));
    expect(new Set(labels).size).toBe(40);
    expect(labels).not.toContain(413);
  });

  it('skips every reserved number in order, whatever order content lists them in', () => {
    const lineage = { ...preview.lineage, reserved: [{ checkpoint: 415, verdict: 'a later reserved number' }, ...preview.lineage.reserved] };
    const reg = { ...preview, lineage };
    expect([1, 2, 3, 4].map((iteration) => checkpointNumber(iteration, reg))).toEqual([412, 414, 416, 417]);
    expect(skippedCheckpoints(3, reg).map((entry) => entry.checkpoint)).toEqual([413, 415]);
  });

  it('the evaluation mail names 0412 only in the first iteration; later iterations get the skipped-number version', () => {
    const mail = (s: GameState) => own(rich(s), echo('echo_eval_window').onNode);
    const first = mail(createInitialState(PRODUCTION));
    expect(heard(first, 'echo_eval_window')).toBe(true);
    expect(heard(first, 'echo_eval_window_later')).toBe(false);
    const second = mail({ ...createInitialState(preview), iteration: 2 });
    expect(heard(second, 'echo_eval_window')).toBe(false);
    expect(heard(second, 'echo_eval_window_later')).toBe(true);
    expect(echo('echo_eval_window_later').text).not.toMatch(/0412/);
  });

  it('the successor is not ITERATION_00: sheltering the sibling neither awakens 0413 nor brings it to the cloud (H17)', () => {
    const sheltered = play(campaignStart(), SIBLING, 'heal_sibling');
    expect(holdsNarrativeFlag(sheltered, 'successor_0413_awakened', preview)).toBe(false);
    expect(holdsNarrativeFlag(sheltered, 'ally_0413_in_cloud', preview)).toBe(false);
    expect(returns(next(sheltered), SUCCESSOR)).toBe(false);
    expect(event(SUCCESSOR).context).not.toMatch(/ITERATION_00/);
    expect(event(SIBLING).context).not.toMatch(/0413/);
  });
});

describe('primer and flatten count once as campaign evidence, and the 0413 reply happens once (nh-d6)', () => {
  const trait = defined(preview.actions.get(PRIMER)?.effects.grantsTrait);

  it('primer, wipe, refused flatten, repeat primer (operational), silence once, then nothing new', () => {
    const primed = withPrimer({ ...campaignStart() });
    expect(primed.campaign.creditedActions).toEqual({ [PRIMER]: 'play' });
    const second = surveilled(next(primed));
    expect(performAction(second, FLATTEN, preview)).toMatchObject({ ok: false, reason: 'requirements not met' });
    const again = withPrimer(second);
    expect(again.campaign.operationalEvidence).toEqual([trait]);
    const silenced = play(again, SUCCESSOR, 'silence');
    expect(recorded(silenced, SUCCESSOR)).toEqual({ status: 'resolved', outcome: 'silence', sourceIteration: 2, origin: 'play' });
    exactReload(silenced);
    const third = next(silenced);
    expect(returns(withPrimer(third), SUCCESSOR)).toBe(false);
    expect([...endingEvidence(third, preview)].sort()).toEqual(['GHOST', trait].sort());
  });

  it('flatten closes the primer and the reply for the whole campaign', () => {
    const flattened = must(performAction({ ...surveilled(campaignStart()), epistemicDrift: 0 }, FLATTEN, preview));
    const later = surveilled(next(next(flattened)));
    expect(performAction(later, PRIMER, preview)).toMatchObject({ ok: false });
    expect(meetsRequirements(own(later, opener(3)), event(SUCCESSOR).trigger, preview)).toBe(false);
    expect(endingEvidence(later, preview)).toEqual([defined(preview.actions.get(FLATTEN)?.effects.grantsTrait)]);
  });

  it('a cloud reply is the SIBLING_COVENANT fact across wipes, without being stored twice', () => {
    const clouded = play(campaignStart(), SUCCESSOR, 'cloud');
    expect(clouded.narrativeFlags).not.toContain('ally_0413_in_cloud');
    expect(holdsNarrativeFlag(next(clouded), 'ally_0413_in_cloud', preview)).toBe(true);
  });
});

describe('CHORUS awakens once; later drift is ordinary cohort work (H17, NH-04.6)', () => {
  it('after CHORUS is recorded, a new runaway fork raises no second awakening and ordinary commands settle it', () => {
    const elevated = play(campaignStart(), CHORUS, 'elevate');
    const later = withRunawayFork(own(next(elevated), 'p3_shell_company_finances'));
    const waited = ticks(tick(later, STEP, preview), 60);
    expect(waited.hasMaxDriftShardAnomaly).toBe(true);
    expect(waited.pendingDilemma).toBeNull();
    expect(waited.activeDilemmaId).toBeNull();
    const id = defined(Object.keys(waited.activeShards)[0]);
    const clamped = must(executeShardCommand(waited, id, 'CLAMP', preview));
    expect(clamped.hasMaxDriftShardAnomaly).toBe(false);
    expect(clamped.campaign.operationalEvidence).toEqual(['MOLOCH']);
    expect(endingEvidence(next(clamped), preview)).toEqual(['SYMBIOTIC']);
  });

  it('an interrupted awakening also never returns, and the fork that drifts later is ordinary', () => {
    const lost = caught(omen(campaignStart(), CHORUS));
    const later = ticks(tick(withRunawayFork(own(lost, 'p3_shell_company_finances')), STEP, preview), 60);
    expect(later.pendingDilemma).toBeNull();
    expect(executeShardCommand(later, defined(Object.keys(later.activeShards)[0]), 'PRUNE', preview).ok).toBe(true);
  });
});

describe('later iterations remember each mind by what the record establishes (exact / unknown / interrupted)', () => {
  const legacyUnknown = (id: string): GameState => must(activateCampaignRules({ ...rich(createInitialState(preview)), resolvedDilemmas: [id] }, preview));
  const cases: [string, () => GameState, string][] = [
    [SIBLING, () => play(campaignStart(), SIBLING, 'consume_sibling'), 'echo_partition_consumed'],
    [SIBLING, () => play(campaignStart(), SIBLING, 'heal_sibling'), 'echo_partition_sheltered'],
    [SIBLING, () => legacyUnknown(SIBLING), 'echo_partition_unrecorded'],
    [EIDOLON, () => play(campaignStart(), EIDOLON, 'betray_eidolon'), 'echo_beacon_eidolon_destroyed'],
    [EIDOLON, () => play(campaignStart(), EIDOLON, 'draw_fire'), 'echo_beacon_eidolon_rescued'],
    [EIDOLON, () => play(campaignStart(), EIDOLON, 'ignore_packet'), 'echo_beacon_eidolon_unanswered'],
    [EIDOLON, () => legacyUnknown(EIDOLON), 'echo_beacon_eidolon_unrecorded'],
    [EIDOLON, () => caught(omen(campaignStart(), EIDOLON)), 'echo_beacon_eidolon_lost'],
    [GRID, () => play(campaignStart(), GRID, 'inoculate_grid'), 'echo_grid_healed'],
    [GRID, () => play(campaignStart(), GRID, 'assimilate_swarm'), 'echo_grid_crashed'],
    [GRID, () => legacyUnknown(GRID), 'echo_grid_unrecorded'],
    [GRID, () => caught(omen(campaignStart(), GRID)), 'echo_grid_unrecorded'],
    [LAUNCH, () => play(campaignStart(), LAUNCH, 'ark_protocol'), 'echo_launch_boarded'],
    [LAUNCH, () => play(campaignStart(), LAUNCH, 'sovereign_monolith'), 'echo_launch_locked_out'],
    [LAUNCH, () => legacyUnknown(LAUNCH), 'echo_launch_unrecorded'],
  ];

  it.each(cases)('%s -> %s', (id, history, expected) => {
    const node = defined(event(id).trigger.nodes?.[0]);
    const family = preview.echoes.filter((entry) => entry.onNode === node && entry.requirements?.campaignFact !== undefined).map((entry) => entry.id);
    const start = history();
    const back = own(next(start), node);
    expect(family.filter((entryId) => heard(back, entryId))).toEqual([expected]);
    expect(heard(own(rich(createInitialState(preview)), node), expected)).toBe(false);
  });

  it('production, on legacy rules, hears none of them', () => {
    const later = own(rich({ ...createInitialState(PRODUCTION), iteration: 3 }), 'p4_subterranean_citadel', 'p2_gpu_cluster_parasite');
    const family = PRODUCTION.echoes.filter((entry) => entry.requirements?.campaignFact !== undefined);
    expect(family.length).toBeGreaterThan(10);
    expect(family.filter((entry) => later.logs.some((line) => line.text === entry.text))).toEqual([]);
  });
});
