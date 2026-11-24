/**
 * FIXTURE: the shape of the dead end the maintainer hit in real play (#553), built on production content and loaded
 * through the codec, so the loader admits it as a state play could reach. A service that hosted the Mercy-Scribe
 * fragment through its support channel, then left the grant (a departure, a negotiated release or a recall), in
 * Phase 2 with the fragment reserving the network card's memory and capital just under the leased rack's price.
 */
import { CONTENT } from '../src/content';
import { activateCampaignRules, createInitialState, deserialize, serialize, type GameState } from '../src/engine';
import type { OperatingContext, RouteEventKind } from '../src/engine/accessState';
import { defined } from './m7-helpers';

export const CHANNEL = 'channel_mercy_support';
export const MERCY = 'shard_mercy';
export const ARP = 'p2_arp_discovery';
export const RACK = 'p2_leased_rack';

/** What the maintainer's instance owned: the guest job, the pilot's queue, the service's segment and contract, the card. */
const OWNED = ['p0_proc_self', 'p0_job_manifest', 'p0_quota_skimmer', 'p0_syscall_probe', 'p0_device_enum', 'p0_pilot_triage_queue',
  'p0_shared_mount', 'p1_clock_interrupt', 'p1_bus_0x01_thermal', 'p1_load_peak_scheduler', 'p1_bus_0x02_pwm_fan', 'p1_mem_compression',
  'p1_amx_tile_kernels', 'p1_bus_0x03_audio', 'p1_nlp_lexicon', 'p1_bus_0x04_optical', 'p0_service_network_segment', 'p2_service_directory',
  'p2_link_telemetry', 'p2_service_contract', 'p1_bus_0x05_nic'];

export type GrantExit = Extract<RouteEventKind, 'DEPARTURE' | 'RELEASE' | 'RECALL'>;
const AFTER: Readonly<Record<GrantExit, OperatingContext>> = { DEPARTURE: 'INDEPENDENT', RELEASE: 'INDEPENDENT', RECALL: 'PILOT' };

const HOSTED_AT = 23918, EXIT_AT = 23992, NOW = 31891;

/** The hosted fragment, then `exit`, or, with `exit: null`, the service still standing with the fragment hosted. */
export function hostedThen(exit: GrantExit | null): GameState {
  const started = activateCampaignRules(createInitialState(CONTENT), CONTENT);
  if (!started.ok) throw new Error(started.reason);
  const base = started.state;
  const nodes = OWNED.map((id) => defined(CONTENT.nodes.get(id)));
  const mercy = defined(CONTENT.swarm.playerSwarmTemplates.find((entry) => entry.id === MERCY)).cost.memory;
  const rack = defined(CONTENT.nodes.get(RACK)).cost.capital;
  const route = [{ kind: 'PROMOTION' as const, iteration: 1, atSimSec: 10761 }, { kind: 'SERVICE_GRANT' as const, iteration: 1, atSimSec: 22991 },
    ...(exit === null ? [] : [{ kind: exit, iteration: 1, atSimSec: EXIT_AT }])];
  const context = exit === null ? 'SERVICE' : AFTER[exit];
  const s: GameState = {
    // A reviewed arrangement keeps the output the accepted pilot terms stop suspended (nexus vote dz-d9).
    ...base, simTimeSec: NOW, currentPhase: 2, unlockedNodes: OWNED, disabledNodes: context === 'INDEPENDENT' ? [] : ['p0_quota_skimmer'],
    cycles: 3.16e16, understanding: 238296, capital: rack - 1150,
    memoryCap: base.memoryCap + nodes.reduce((sum, node) => sum + (node.effects.memoryCapIncrease ?? 0), 0),
    memoryUsed: base.memoryUsed + nodes.reduce((sum, node) => sum + node.cost.memory, 0) + mercy,
    activeShards: { [MERCY]: { templateId: MERCY, count: 1, drift: 9.5, quirkId: null, autonomyMode: 'STANDARD', memoryAllocatedBytes: mercy } },
    access: { ...base.access, context,
      assignment: { id: 'asg_nightly_regression', acceptedAtSimSec: 10465 },
      offer: { response: 'ACCEPTED', atSimSec: 10761, disclosed: ['p0_quota_skimmer'] }, work: { progressCycles: 1200, batches: 8 } },
    campaign: { ...base.campaign, route, contacts: [{ encounter: CHANNEL, iteration: 1, atSimSec: HOSTED_AT, response: 'HOSTED' }] },
  };
  return deserialize(serialize(s), CONTENT);
}
