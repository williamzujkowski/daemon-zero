/**
 * The careful (STEALTH) campaign played from a fresh game under campaign rules, as a new player is from the
 * first tick (inventory gap G1), with stage moments captured by CONDITION rather than by elapsed time, so a
 * balance change moves the moment instead of breaking it. Played once per worker and memoised.
 */
import { CONTENT } from '../../../src/content';
import { activateCampaignRules, createInitialState, tick, type GameState } from '../../../src/engine';
import { botStep } from '../../../src/engine/sim/bot';
import { SIM_BUDGET_SEC } from '../../../src/engine/sim/gates';

export type CampaignMoment = `phase-${0 | 1 | 2 | 3 | 4 | 5}-${'mid' | 'end'}`;

/** A quiet frame: no modal up and no omen counting down, so the stage shows the pane rather than an interrupt. */
const quiet = (state: GameState): boolean => state.ending === null && state.activeDilemmaId === null && state.pendingDilemma === null;
const phaseNodes = (state: GameState, phase: number): number =>
  state.unlockedNodes.filter((id) => CONTENT.nodes.get(id)?.phaseId === phase).length;

interface PhaseTrack { purchases: GameState[]; last: GameState | null }

/** A new game admitted to campaign rules through the one public transition, as the app store does. */
export function campaignStart(): GameState {
  const result = activateCampaignRules(createInitialState(CONTENT), CONTENT);
  if (!result.ok) throw new Error('campaign rules did not activate: ' + result.reason);
  return result.state;
}

/**
 * `phase-N-end` is the last quiet state before phase N+1 (or the ending) is reached. `phase-N-mid` is the quiet
 * state at the purchase that took the phase's own node count to half of what the run held when it left the phase.
 */
function pick(tracks: Map<number, PhaseTrack>): Map<CampaignMoment, GameState> {
  const found = new Map<CampaignMoment, GameState>();
  for (const [phase, track] of tracks) {
    if (track.last === null) continue;
    found.set(`phase-${String(phase)}-end` as CampaignMoment, track.last);
    const half = Math.ceil(phaseNodes(track.last, phase) / 2);
    const mid = track.purchases.find((state) => phaseNodes(state, phase) >= half);
    if (mid !== undefined) found.set(`phase-${String(phase)}-mid` as CampaignMoment, mid);
  }
  return found;
}

function play(): Map<CampaignMoment, GameState> {
  const tracks = new Map<number, PhaseTrack>();
  let state = campaignStart();
  const observe = (next: GameState): void => {
    if (!quiet(next)) return;
    const track = tracks.get(next.currentPhase) ?? { purchases: [], last: null };
    const before = track.last === null ? -1 : phaseNodes(track.last, next.currentPhase);
    if (phaseNodes(next, next.currentPhase) > before) track.purchases.push(next);
    track.last = next;
    tracks.set(next.currentPhase, track);
  };
  for (let second = 0; second < SIM_BUDGET_SEC && state.ending === null; second++) {
    state = botStep(state, CONTENT, 'STEALTH');
    observe(state);
    for (let frame = 0; frame < CONTENT.balance.tickHz && state.ending === null; frame++) {
      state = tick(state, 1 / CONTENT.balance.tickHz, CONTENT);
      observe(state);
    }
  }
  if (state.ending === null || state.iteration !== 1) throw new Error('The careful campaign must reach an ending without a wipe');
  return pick(tracks);
}

let played: Map<CampaignMoment, GameState> | undefined;

/** One campaign moment; fails loudly if the run never produced it. */
export function campaignMoment(name: CampaignMoment): GameState {
  played ??= play();
  const state = played.get(name);
  if (state === undefined) throw new Error('The careful campaign never reached ' + name);
  return state;
}
