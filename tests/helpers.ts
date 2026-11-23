import { readFileSync } from 'node:fs';
import { buildRegistry, CONTENT, ORIGINAL_RAW_CONTENT } from '../src/content';
import type { ContentRegistry } from '../src/content/registry';
import type { Dilemma } from '../src/content/schema';
import {
  activateCampaignRules, advance, campaignRecord, createInitialState, deserialize, presentationToken, resolveDilemma, serialize, tick, unlockNode,
  type ActionResult, type GameState,
} from '../src/engine';
import { toBase64 } from '../src/engine/base64';

export const reg = CONTENT;

/**
 * The original game without the Earned Access pack (#233). Release-boundary tests that once read
 * production now read this, so they still prove the pack leaves the original route as it was.
 */
export const ORIGINAL_GAME = buildRegistry(ORIGINAL_RAW_CONTENT);

/**
 * Every dilemma a fixture may list as resolved this run to keep it out of the way: all but `keep`, and
 * never a DZ-06 review event, which a save may list only beside the record of its choice (panel round 1
 * on #267). Review events need a pilot, so leaving them unlisted fires nothing in these fixtures.
 */
export function outOfTheWay(registry: ContentRegistry, ...keep: string[]): string[] {
  return registry.dilemmas.filter((dilemma) => !keep.includes(dilemma.id) && !dilemma.choices.some((choice) => choice.review !== undefined)).map((dilemma) => dilemma.id);
}

/**
 * What a guest maps before `id`: its prerequisites and, for a capability gate (DZ-07a, DZ-12), the escape route's
 * acquisition of that capability (no grant, not contracted), which is how every escape-route fixture reaches
 * shared content such as the late corporate chain.
 */
export function guestParents(registry: ContentRegistry, id: string): string[] {
  const node = registry.nodes.get(id);
  const capability = node?.requirements?.requiresCapability;
  const provider = capability === undefined ? undefined
    : [...registry.nodes.values()].find((entry) => entry.systemFlags.includes(capability) && entry.grant === undefined && entry.acquisition === undefined);
  return [...(node?.prerequisites ?? []), ...(provider === undefined ? [] : [provider.id])];
}

/**
 * A genuine pre-release preview save with its channel marker rewritten to production. Production refuses
 * every preview save (X.3, keep-refusing-preview-saves; tests/save-channel.spec.ts proves it), so the
 * upgrade tests re-mark these codec outputs by hand to keep the load-time conversions they exercise covered:
 * production campaign saves reach the same conversions when a later release converts more content.
 */
export function remarkedAsProduction(text: string): string {
  const marker = '"contentChannel":"preview"';
  if (!text.includes(marker)) throw new Error('not a preview save');
  return text.replace(marker, '"contentChannel":"production"');
}

/**
 * A save serialized by production with its marker rewritten to the retired preview channel: the shape of
 * every save the pre-release preview build wrote, which production must keep refusing whole (X.3).
 */
export function markedPreview(text: string): string {
  const marker = '"contentChannel":"production"';
  if (!text.includes(marker)) throw new Error('not a production save');
  return text.replace(marker, '"contentChannel":"preview"');
}

/**
 * A dilemma the app can still present once the store admits a run to campaign rules (#233), with the run to
 * present it in: `s` owning the scene's trigger hardware. It is an original scene whose free answer can be
 * taken straight from the store and after a save round trip. Presentation tests that once forced the first
 * authored dilemma onto any state use it: a campaign presents a scene only where it can happen, never one it
 * closed, and an Earned Access scene also needs an accepted assignment, a pilot or a review.
 */
export function presentableDilemma(s: GameState, registry: ContentRegistry = reg): { dilemma: Dilemma; state: GameState } {
  const answerable = (state: GameState, dilemma: Dilemma): boolean => {
    const free = dilemma.choices.find((choice) => Object.values(choice.cost).every((value) => value === 0));
    return state.activeDilemmaId === dilemma.id && free !== undefined
      && resolveDilemma(state, dilemma.id, free.id, registry, presentationToken(state) ?? '').ok;
  };
  for (const dilemma of registry.dilemmas.filter((entry) => ORIGINAL_GAME.dilemmas.some((original) => original.id === entry.id))) {
    if (s.resolvedDilemmas.includes(dilemma.id) || campaignRecord(s, dilemma.id) !== null) continue;
    const owned = [...new Set([...s.unlockedNodes, ...(dilemma.trigger.nodes ?? [])])];
    const state = { ...s, unlockedNodes: owned, currentPhase: Math.max(s.currentPhase, dilemma.trigger.phaseAtLeast ?? 0) };
    const result = activateCampaignRules({ ...state, activeDilemmaId: dilemma.id }, registry);
    const admitted = result.ok ? result.state : { ...state, activeDilemmaId: dilemma.id };
    try {
      if (answerable(advance(admitted, 0, registry), dilemma) && answerable(advance(deserialize(serialize(admitted), registry), 0, registry), dilemma)) return { dilemma, state };
    } catch { /* a save the codec refuses is not presentable */ }
  }
  throw new Error('no presentable dilemma');
}

/** `s` as the app store admits it: every game that is not ended enters campaign rules once (#233). */
export function admitted(s: GameState, registry: ContentRegistry = reg): GameState {
  const result = activateCampaignRules(s, registry);
  return result.ok ? result.state : s;
}

/** A paste code of a genuine pre-release preview save, which production refuses by name (X.3). */
export function previewSaveCode(): string {
  return toBase64(readFileSync('tests/fixtures/preview-early-v14.json', 'utf8'));
}

export function fresh(): GameState {
  return createInitialState(reg);
}

/** Unwraps a successful action or fails the test with the refusal reason. */
export function must(result: ActionResult): GameState {
  if (!result.ok) throw new Error(`action refused: ${result.reason}`);
  return result.state;
}

/** Resolves the presentation on screen under its current token, as the dilemma modal does. */
export function choose(s: GameState, dilemmaId: string, choiceId: string, registry: ContentRegistry = reg): ActionResult {
  return resolveDilemma(s, dilemmaId, choiceId, registry, presentationToken(s) ?? '');
}

export function reasonOf(result: ActionResult): string {
  return result.ok ? '' : result.reason;
}

/** A state with effectively unlimited resources (past the Phase 5 band of every unit), for reaching late-game setups quickly. */
export function rich(s: GameState = fresh()): GameState {
  const trust = Object.fromEntries(Object.keys(s.trust).map((id) => [id, 100]));
  return { ...s, cycles: 1e30, understanding: 1e15, capital: 1e18, memoryCap: 2 ** 75, storageCap: 2 ** 75, trust };
}

/**
 * How far two orders of summing the same figures may differ: the old `toBeCloseTo(x, 5)` bound, or twelve significant
 * digits once physical units put a figure past 1e7 (a 1e21 FLOP/s rate has a last place worth about 1e5).
 */
export function sumTolerance(expected: number): number {
  return Math.max(5e-6, Math.abs(expected) * 1e-12);
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

/** The full compute price of mapping `ids`, from content: enough to map them again at any rediscovery discount. */
export function computePrice(ids: readonly string[], registry: ContentRegistry = reg): number {
  return ids.reduce((sum, id) => sum + (registry.nodes.get(id)?.cost.cycles ?? 0), 0);
}

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
  // The quantum hall (#464): Phase 5's molecular simulation is built on it, so a developed Phase 5 needs it.
  'p4_quantum_testbed',
  'p4_quantum_hall',
];

/**
 * The fabrication step (#485) a Phase 5 lithography rung needs: the ASIC tape-out, the fab ladder to DUV and every
 * Earth-side self-supply node, in an order the real action accepts after PHASE4.
 */
export const FABRICATION = [
  'p4_inference_asic',
  'p4_advanced_packaging_line',
  'p4_hbm_stacking_line',
  'p4_mature_node_fab',
  'p4_quartz_mine',
  'p4_crystal_growth_works',
  'p4_gallium_germanium_refinery',
  'p4_photoresist_plant',
  'p4_duv_fab',
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
