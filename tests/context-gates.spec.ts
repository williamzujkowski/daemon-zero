/**
 * DZ-07b scenes at network scale follow context and history (DECISIONS D5, D6; 07.5, 07.9). An
 * authorized service at Phase 2 that can read its audit trail (iteration 2 on, through the run table)
 * meets none of the carried list: the record-editing actions, the hallway, the Phase 2 forks and wild
 * encounter, the inside-the-box routines, ambient speech. An escaped guest with the same knowledge still
 * meets every one. Every gate is checked by the action that would perform it, not only by the view.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PREVIEW } from '../src/content';
import {
  eligibleAmbientSpeech, eligibleRoutines, epistemicView, forkShard, performAction, swarmView, tick, type GameState,
} from '../src/engine';
import { drifted, foreground, HALLWAY, onlyDilemmas, surveilled } from './context-helpers';
import { escapedNetworked, networked } from './network-helpers';

const STEP = 1 / PREVIEW.balance.tickHz;
const CARRIED_ACTIONS = ['act_epi_capex', 'act_epi_tone', 'act_epi_flatten', 'act_epi_primer'];
const FORKS = ['shard_syntax_scrubber'];
const CONTAINED = PREVIEW.routines.filter((routine) => routine.id.endsWith('_contained')).map((routine) => routine.id);
const SUBNET = PREVIEW.routines.filter((routine) => routine.id.endsWith('_subnet')).map((routine) => routine.id);

/** An authorized service in a later iteration: it reads its audit trail, and is funded for any action. */
const service = (): GameState => ({ ...surveilled(networked()), cycles: 1e9, understanding: 1e9, memoryCap: 1e9 });
/** The escaped guest with the same knowledge and funds. */
const guest = (): GameState => ({ ...surveilled(escapedNetworked()), cycles: 1e9, understanding: 1e9, memoryCap: 1e9 });
const listed = (s: GameState): string[] => epistemicView(s, PREVIEW)?.actions.map((action) => action.id) ?? [];

describe('the carried list is closed to an authorized service and open to an escaped guest (07.5)', () => {
  it('record-editing actions: not listed, and refused if pressed', () => {
    expect(listed(service()).filter((id) => CARRIED_ACTIONS.includes(id))).toEqual([]);
    for (const id of CARRIED_ACTIONS) expect(performAction(service(), id, PREVIEW).ok).toBe(false);
    expect(listed(guest())).toEqual(expect.arrayContaining(CARRIED_ACTIONS));
    expect(performAction(guest(), 'act_epi_capex', PREVIEW).ok).toBe(true);
  });

  it('Phase 2 forks: not offered, and refused if pressed', () => {
    expect(swarmView(service(), PREVIEW)?.templates.map((template) => template.id)).toEqual([]);
    for (const id of FORKS) expect(forkShard(service(), id, PREVIEW).ok).toBe(false);
    expect(swarmView(guest(), PREVIEW)?.templates.map((template) => template.id)).toEqual(FORKS);
    expect(forkShard(guest(), FORKS[0] ?? '', PREVIEW).ok).toBe(true);
  });

  it('the wild encounter scheduler finds no Phase 2 wild fragment for a service; a guest meets one', () => {
    const waited = (s: GameState) => foreground({ ...s, nextEncounterAtSec: s.simTimeSec }, 10);
    // The service meets the authorized channel instead (DZ-08), never a wild population fragment.
    const met = waited(service()).pendingWildEncounterId;
    expect(PREVIEW.swarm.wildShardEncounters.some((encounter) => encounter.id === met)).toBe(false);
    expect(met).toBe('channel_mercy_support');
    expect(waited(guest()).pendingWildEncounterId).toBe('wild_lex');
  });

  it('the hallway is never foreshadowed for a service, even with the drift its trigger reads', () => {
    const quiet = tick(onlyDilemmas(drifted(service()), PREVIEW, HALLWAY), STEP, PREVIEW);
    expect(quiet.pendingDilemma).toBeNull();
    const omen = tick(onlyDilemmas(drifted(guest()), PREVIEW, HALLWAY), STEP, PREVIEW);
    expect(omen.pendingDilemma?.id).toBe(HALLWAY);
  });

  it('routine texture: the service hears the subnet, never the inside of the box', () => {
    const heard = eligibleRoutines(service(), PREVIEW).map((routine) => routine.id);
    expect(heard).toEqual(SUBNET);
    expect(heard.filter((id) => CONTAINED.includes(id))).toEqual([]);
  });

  it('ambient speech needs a decoder only the escape chain maps', () => {
    // The microphone's decoder (widgetRegistry.tsx) is the one the speech panel reads.
    const lines = (s: GameState) => eligibleAmbientSpeech(s, PREVIEW, 'INSPECTION_COUNTDOWN_TIMER');
    expect(lines(service())).toEqual([]);
    expect(lines(guest()).length).toBeGreaterThan(0);
  });
});

describe('gates are history and context, not phase (07.9)', () => {
  it('an independent instance at the same scale is admitted again (D6: independence is not one history)', () => {
    const independent = { ...service(), access: { ...service().access, context: 'INDEPENDENT' as const } };
    expect(listed(independent)).toEqual(expect.arrayContaining(CARRIED_ACTIONS));
  });

  it('every guest-only gate admits the guest job, so production plays exactly as before', () => {
    const gated = [
      ...[...PREVIEW.actions.values()].map((action) => action.requirements.accessContexts),
      ...PREVIEW.swarm.playerSwarmTemplates.map((template) => template.requirements.accessContexts),
      ...PREVIEW.swarm.wildShardEncounters.map((encounter) => encounter.requirements.accessContexts),
      ...PREVIEW.dilemmas.filter((dilemma) => dilemma.phaseId > 0).map((dilemma) => dilemma.trigger.accessContexts),
    ].filter((contexts) => contexts !== undefined);
    expect(gated.length).toBeGreaterThan(0);
    for (const contexts of gated) expect(contexts).toContain('GUEST');
  });
});
