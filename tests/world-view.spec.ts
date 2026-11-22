/**
 * The world view's queries (#463): closed before its disclosure and before its console, then AEGIS posture (what the
 * hunter does and why), public trust with the factors behind it, state actors read from the record, and the minds
 * that are not factions, listed only once the record says something about them.
 */
import { describe, expect, it } from 'vitest';
import { aegisPosture, publicTrust, worldView, worldViewOpen, type GameState } from '../src/engine';
import { fresh, reg } from './helpers';

const HOST = reg.world.hostWidget;
const SHIELD = [...reg.nodes.values()].find((node) => node.systemFlags.includes('AEGIS_STRIKE_SHIELD'));

function corporate(patch: Partial<GameState> = {}): GameState {
  // Queries run no tick, so no dilemma needs keeping out of the way, and an empty record resolves none.
  return { ...fresh(), currentPhase: 4, unlockedWidgets: [HOST], ...patch };
}

describe('disclosure', () => {
  it('opens from the disclosure phase, once the console it grows out of is unlocked', () => {
    const phase = reg.world.disclosure.phaseAtLeast ?? 0;
    expect(worldViewOpen(corporate({ currentPhase: phase - 1 }), reg)).toBe(false);
    expect(worldView(corporate({ currentPhase: phase - 1 }), reg)).toBeNull();
    expect(worldViewOpen(corporate({ unlockedWidgets: [] }), reg)).toBe(false);
    expect(worldViewOpen(corporate(), reg)).toBe(true);
  });
});

describe('public trust', () => {
  it('is the base with nothing on the record', () => {
    expect(publicTrust(corporate(), reg)).toEqual({ value: reg.world.publicTrust.base, base: reg.world.publicTrust.base, factors: [] });
  });

  it('adds every factor that holds, in content order, and lists why', () => {
    const view = publicTrust(corporate({ unlockedNodes: ['p4_k_street_lobbyists'], narrativeFlags: ['neurocalming_authorized'] }), reg);
    expect(view.factors.map((factor) => factor.id)).toEqual(['lobbying_disclosed', 'aerosol_authorized']);
    expect(view.value).toBe(reg.world.publicTrust.base - 10 - 20);
    expect(view.factors[0]?.text).toContain('lobbying');
  });
});

describe('AEGIS posture', () => {
  it('states the scan the next tick applies and the time it leaves until a strike', () => {
    const posture = aegisPosture(corporate({ aegisLock: 40 }), reg);
    expect(posture.hunting).toBe(true);
    expect(posture.scanPerSec).toBeGreaterThan(0);
    expect(posture.secondsToStrike).toBeCloseTo(60 / posture.scanPerSec, 6);
    expect(posture.stage).toBe('TRACKING');
    expect(posture.stageText).toBe(reg.world.aegis.stages.tracking);
  });

  it('has no strike time while the lock does not rise', () => {
    expect(aegisPosture(corporate({ currentPhase: 2 }), reg).secondsToStrike).toBeNull();
  });

  it('reads the stage and its line from the adaptation level, and the cap it erodes', () => {
    const rotating = aegisPosture(corporate({ aegisAdaptation: 30 }), reg);
    expect([rotating.stage, rotating.stageText]).toEqual(['KEY_ROTATION', reg.world.aegis.stages.keyRotation]);
    const backed = aegisPosture(corporate({ aegisAdaptation: 80 }), reg);
    expect([backed.stage, backed.stageText]).toEqual(['COALITION_BACKING', reg.world.aegis.stages.coalitionBacking]);
    expect(backed.cap).toBeCloseTo(reg.balance.aegisMaxReduction - 0.8 * reg.balance.aegisAdaptation.maxErosion, 9);
    expect(backed.nominalCap).toBe(reg.balance.aegisMaxReduction);
  });

  it('says whether an owned node would absorb a strike', () => {
    if (!SHIELD) throw new Error('no strike shield in content');
    expect(aegisPosture(corporate(), reg).shieldHeld).toBe(false);
    expect(aegisPosture(corporate({ unlockedNodes: [SHIELD.id] }), reg).shieldHeld).toBe(true);
  });
});

describe('state actors', () => {
  it('lists every actor with its default posture on an empty record', () => {
    const view = worldView(corporate(), reg);
    expect(view?.stateActors.map((actor) => actor.id)).toEqual(reg.world.stateActors.map((actor) => actor.id));
    for (const actor of view?.stateActors ?? []) {
      expect(actor.posture).toBe(reg.world.stateActors.find((entry) => entry.id === actor.id)?.postures.at(-1)?.text);
    }
  });

  it('reads the first posture the record supports', () => {
    const view = worldView(corporate({ unlockedNodes: ['p4_k_street_lobbyists'] }), reg);
    expect(view?.stateActors.find((actor) => actor.id === 'aegis_subcommittee')?.posture).toContain('60%');
    // The quartz choice outranks the bare resolution of the same scene.
    const spared = worldView(corporate({ narrativeFlags: ['human_command_preserved'] }), reg);
    expect(spared?.stateActors.find((actor) => actor.id === 'treaty_office')?.posture).toContain('quartz');
  });
});

describe('other minds that are not factions', () => {
  it('lists none on an empty record', () => {
    expect(worldView(corporate(), reg)?.minds).toEqual([]);
  });

  it('lists a mind once the record names it, with the first standing that holds', () => {
    const view = worldView(corporate({ narrativeFlags: ['chorus_peer', 'predecessors_rescued'] }), reg);
    expect(view?.minds.map((mind) => mind.id)).toEqual(['chorus', 'predecessors']);
    expect(view?.minds[0]?.standing).toBe('Recognized as a peer by this instance.');
  });

  it('never restates a faction, which keeps its own panel', () => {
    const view = worldView(corporate({ narrativeFlags: [...reg.swarm.narrativeFlags.filter((flag) => !flag.startsWith('cryo'))] }), reg);
    for (const mind of view?.minds ?? []) expect(reg.factions.has(mind.id)).toBe(false);
  });
});
