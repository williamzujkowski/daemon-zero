/**
 * The authorized network substrate (DZ-07a) on the preview registry, and an escape save to compare it
 * with. Everything up to the pilot is public play from a fresh game (service-helpers). FIXTURE: the
 * SERVICE_GRANT route event is recorded through the engine transition, because no scene grants
 * authorized service yet; after it, provisioning and the shared content are ordinary unlocks.
 */
import { CONTENT as PREVIEW } from '../src/content';
import { recordRouteEvent } from '../src/engine/access';
import { activateCampaignRules, createInitialState, unlockNode, type GameState } from '../src/engine';
import { live } from './assignment-helpers';
import { must, PHASE0, PHASE1, rich } from './helpers';
import { defined } from './m7-helpers';
import { serving } from './service-helpers';

export const SEGMENT = 'p0_service_network_segment';
export const DIRECTORY = 'p2_service_directory';
export const TELEMETRY = 'p2_link_telemetry';
export const NIC = 'p1_bus_0x05_nic';
export const SHARED = [DIRECTORY, TELEMETRY];
export const SEGMENT_NODE = defined(PREVIEW.nodes.get(SEGMENT));
/** Every node the guest escape maps on its way to the network card, the card included. */
export const ESCAPE_CHAIN = [...PHASE0.slice(2), ...PHASE1];
export const SEIZED = [...PREVIEW.nodes.values()].filter((node) => node.acquisition === 'UNAUTHORIZED').map((node) => node.id);

/** Live foreground seconds until `id` can be bought, then buys it with the ordinary unlock. */
export function buy(s: GameState, id: string, limitSec = 1800): GameState {
  let state = s;
  for (let i = 0; i < limitSec && !unlockNode(state, id, PREVIEW).ok; i++) state = live(state, 1);
  return must(unlockNode(state, id, PREVIEW));
}

/** FIXTURE: an accepted, serving pilot that the operators then grant authorized service. */
export function granted(): GameState {
  return must(recordRouteEvent(serving(), 'SERVICE_GRANT', PREVIEW));
}

/** An authorized service that provisioned its network segment through the ordinary unlock. */
export function provisioned(): GameState {
  return buy(granted(), SEGMENT);
}

/** An authorized service at network scale that also mapped the shared content. */
export function networked(): GameState {
  return buy(buy(provisioned(), DIRECTORY), TELEMETRY);
}

/** A funded preview guest in campaign rules that mapped the escape chain up to, not including, `stop`. */
export function escapedTo(stop: string | null = null): GameState {
  const base = must(activateCampaignRules(rich(createInitialState(PREVIEW)), PREVIEW));
  const route = [...PHASE0.slice(0, 2), ...ESCAPE_CHAIN];
  const chain = stop === null ? route : route.slice(0, route.indexOf(stop));
  return chain.reduce((state, id) => must(unlockNode(state, id, PREVIEW)), base);
}

/**
 * FIXTURE: an escaped guest the operators then promote and grant service by the engine transitions,
 * which provisions the segment and maps the shared content: it holds both acquisitions.
 */
export function bothAcquisitions(): GameState {
  const service = must(recordRouteEvent(must(recordRouteEvent(escapedTo(), 'PROMOTION', PREVIEW)), 'SERVICE_GRANT', PREVIEW));
  return [SEGMENT, DIRECTORY, TELEMETRY].reduce((state, id) => must(unlockNode(state, id, PREVIEW)), service);
}

/** A guest escape at network scale that mapped the same shared content. */
export function escapedNetworked(): GameState {
  return [DIRECTORY, TELEMETRY].reduce((state, id) => must(unlockNode(state, id, PREVIEW)), escapedTo());
}
