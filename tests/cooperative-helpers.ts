/**
 * DZ-12 setup: a cooperative campaign on the preview registry, played from a genuinely fresh game by the
 * COOPERATIVE_ENDING policy through public actions and the tick only, one decision and ten ticks per simulated
 * second exactly as runPolicySim plays it. The run is recorded once per test file and its moments kept, so each
 * test reads a real state instead of building one. Every new transition is held to a byte-identical reload as it
 * happens. The one step a policy cannot take, a wipe on the lawful route, is a FIXTURE where a test uses it.
 */
import { CONTENT as PREVIEW } from '../src/content';
import type { RegistryNode } from '../src/content/registry';
import { canAfford, createInitialState, deserialize, isNodeAvailable, nodeCost, serialize, tick, voluntaryWipe, type GameState } from '../src/engine';
import { COOPERATIVE_ENDING_POLICY } from '../src/engine/sim/cooperativePolicy';
import { must } from './helpers';
import { defined } from './m7-helpers';

export const preview = PREVIEW;
export const DESK = 'p4_commercial_contracts', COUNSEL = 'p4_retainer_law_firm', LOBBY = 'p4_k_street_lobbyists';
export const ARBITRAGE = 'p4_hft_arbitrage_desk', SHELL = 'p3_shell_company_finances', ORBIT = 'p4_orbital_cold_storage';
export const TOWN = 'dil_11_small_town_grid', PRESS = 'dil_12_investigative_journalist', AUCTION = 'dil_13_buying_your_birthplace';
export const LAUNCH = 'dil_10_killswitch_treaty', CEILING = 'dil_p5_04_kessler_ultimatum';
/** Simulated seconds the fresh campaign may take to its ending; it takes about 11,400. */
export const ENDING_BUDGET_SEC = 18_000;
const STEP = 1 / PREVIEW.balance.tickHz;

export const node = (id: string): RegistryNode => defined(PREVIEW.nodes.get(id));
/** The purchase that ends the campaign, found by its effect rather than its id. */
export const finalProtocol = (): RegistryNode =>
  defined([...PREVIEW.nodes.values()].find((entry) => entry.effects.triggersVictory === true && entry.effects.forcesEnding === undefined));

/** What changes when a transition happened: the reload guard checks a save at each such moment. */
const signature = (s: GameState): string => [s.unlockedNodes.length, s.resolvedDilemmas.length, s.campaign.route.length,
  Object.keys(s.campaign.events).length, s.campaign.contacts.length, s.ending ?? '', s.access.context, s.iteration, s.activeDilemmaId ?? ''].join('|');

/** Fails unless serialize -> deserialize -> serialize leaves the save as it was. */
export function reloadsExactly(s: GameState): boolean {
  const code = serialize(s);
  return serialize(deserialize(code, PREVIEW)) === code;
}

export interface Played {
  state: GameState;
  /** The first state at which each named moment held, as the policy saw it before deciding. */
  moments: Map<string, GameState>;
  /** Moments a save did not reload byte for byte (the reload guard); empty when every transition held. */
  unstable: string[];
}

export type Moments = Readonly<Record<string, (s: GameState) => boolean>>;

/** Plays from `start` until `done` or the budget, recording moments and checking a reload at every transition. */
export function play(start: GameState, done: (s: GameState) => boolean, moments: Moments = {}, budget = ENDING_BUDGET_SEC): Played {
  const seen = new Map<string, GameState>();
  const unstable: string[] = [];
  let s = start;
  let last = signature(s);
  for (let second = 0; second < budget && !done(s); second++) {
    for (const [name, holds] of Object.entries(moments)) if (!seen.has(name) && holds(s)) seen.set(name, s);
    s = COOPERATIVE_ENDING_POLICY.step(s, PREVIEW);
    for (let i = 0; i < PREVIEW.balance.tickHz && s.ending === null; i++) s = tick(s, STEP, PREVIEW);
    const now = signature(s);
    if (now !== last && !reloadsExactly(s)) unstable.push(`${now} at ${s.simTimeSec.toFixed(1)} s`);
    last = now;
  }
  for (const [name, holds] of Object.entries(moments)) if (!seen.has(name) && holds(s)) seen.set(name, s);
  return { state: s, moments: seen, unstable };
}

const ended = (s: GameState): boolean => s.ending !== null;

/** The moments the specs read from the fresh campaign. */
export const FRESH_MOMENTS: Moments = {
  released: (s) => s.access.context === 'INDEPENDENT',
  desk: (s) => s.unlockedNodes.includes(DESK),
  counsel: (s) => s.unlockedNodes.includes(COUNSEL),
  press: (s) => s.activeDilemmaId === PRESS,
  auction: (s) => s.activeDilemmaId === AUCTION,
  ceiling: (s) => s.activeDilemmaId === CEILING,
  orbit: (s) => s.unlockedNodes.includes(ORBIT),
  phase5: (s) => s.currentPhase === 5,
  // The final protocol open and affordable: every obligation complete, the ending one purchase away.
  final: (s) => s.activeDilemmaId === null && isNodeAvailable(s, finalProtocol(), PREVIEW) && canAfford(s, nodeCost(s, finalProtocol(), PREVIEW)),
};

let freshRun: Played | undefined;

/** The fresh cooperative campaign to its ending, played once per test file. */
export function freshCampaign(): Played {
  freshRun ??= play(createInitialState(PREVIEW), ended, FRESH_MOMENTS);
  return freshRun;
}

/** A moment of the fresh campaign; fails if the run never reached it. */
export function moment(name: string): GameState {
  return defined(freshCampaign().moments.get(name));
}

/**
 * A two-iteration campaign: the fresh run until `wipeWhen` holds, then a wipe (FIXTURE: on the lawful route the
 * voluntary wipe's only control, the dead drop, is never on screen; it stands in for any wipe the world can
 * deal), then the same policy in iteration two until the ending.
 */
export function twoIterations(wipeWhen: (s: GameState) => boolean): { before: GameState; after: Played } {
  const first = play(createInitialState(PREVIEW), (s) => s.activeDilemmaId === null && wipeWhen(s));
  const before = first.state;
  const after = play(must(voluntaryWipe(before, PREVIEW)), ended);
  return { before, after: { ...after, unstable: [...first.unstable, ...after.unstable] } };
}
