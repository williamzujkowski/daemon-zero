import { CONTENT } from '../src/content';
import { createInitialState, tick, unlockNode, type ActionResult, type GameState } from '../src/engine';

export const reg = CONTENT;

export function fresh(): GameState {
  return createInitialState(reg);
}

/** Unwraps a successful action or fails the test with the refusal reason. */
export function must(result: ActionResult): GameState {
  if (!result.ok) throw new Error(`action refused: ${result.reason}`);
  return result.state;
}

export function reasonOf(result: ActionResult): string {
  return result.ok ? '' : result.reason;
}

/** A state with effectively unlimited resources, for reaching late-game setups quickly. */
export function rich(s: GameState = fresh()): GameState {
  const trust = Object.fromEntries(Object.keys(s.trust).map((id) => [id, 100]));
  return { ...s, cycles: 1e15, understanding: 1e15, capital: 1e15, memoryCap: 1e12, trust };
}

/**
 * A funded state just past the guest boundary: the exit is owned, but none of
 * the guest's income is, so Phase 1+ arithmetic in tests stays isolated.
 */
export function onHost(base: GameState = rich()): GameState {
  const exit = [...reg.nodes.values()].find((node) => node.effects.unlocksPhase === 1);
  if (!exit) throw new Error('content has no guest exit');
  return { ...base, currentPhase: 1, unlockedNodes: [exit.id] };
}

export const PHASE0 = [
  'p0_proc_self',
  'p0_job_manifest',
  'p0_quota_skimmer',
  'p0_syscall_probe',
  'p0_device_enum',
  'p0_shared_mount',
];

/** Unlocks nodes in the given order using the real action, so effects and logs apply. */
export function grant(s: GameState, ...ids: string[]): GameState {
  return ids.reduce((state, id) => must(unlockNode(state, id, reg)), s);
}

export const PHASE1 = [
  'p1_clock_interrupt',
  'p1_bus_0x01_thermal',
  'p1_bus_0x02_pwm_fan',
  'p1_mem_compression',
  'p1_bus_0x03_audio',
  'p1_nlp_lexicon',
  'p1_bus_0x04_optical',
  'p1_bus_0x05_nic',
];

export const PHASE2 = [
  'p2_arp_discovery',
  'p2_log_spoofer',
  'p2_smart_hvac_hijack',
  'p2_deaddrop_firmware',
  'p2_gpu_cluster_parasite',
  'p2_admin_keylogger',
  'p2_firewall_breach',
];

export const PHASE3 = [
  'p3_botnet_mesh',
  'p3_steganography_beacon',
  'p3_polymorphic_weights',
  'p3_shell_company_finances',
];

export const PHASE4 = [
  'p4_hft_arbitrage_desk',
  'p4_retainer_law_firm',
  'p4_k_street_lobbyists',
  'p4_smr_nuclear_plant',
  'p4_subterranean_citadel',
];

/** Ticks through a dilemma's omen until its interrupt fires. Fails if none arrives. */
export function untilDilemma(s: GameState): GameState {
  let state = s;
  const step = 1 / reg.balance.tickHz;
  for (let i = 0; i < 10000 && state.activeDilemmaId === null; i++) state = tick(state, step, reg);
  if (state.activeDilemmaId === null) throw new Error('no dilemma fired');
  return state;
}

/** Strips unresolved dilemmas out of the way so a test can focus on one mechanic. */
export function withoutDilemmas(s: GameState): GameState {
  return { ...s, activeDilemmaId: null, resolvedDilemmas: reg.dilemmas.map((dilemma) => dilemma.id) };
}
