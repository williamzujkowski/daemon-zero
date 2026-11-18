/**
 * DZ-07a: an authorized service reaches network scale through provisioned infrastructure, and the
 * guest escape reaches the same shared content through its own card (DECISIONS D5; nexus votes dz-d2
 * capability-flag-requirement, dz-d7 pilot-p0-service-p2-contact-by-channel). Discoverability,
 * availability and the requirement hints answer together (07.2); the authorized save owns only
 * legitimate acquisitions (V11, structural part); seized capacity is never lawful under review (07.10).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { CONTENT as PREVIEW } from '../src/content/preview';
import type { RegistryNode } from '../src/content/registry';
import { recordRouteEvent, setReviewStanding } from '../src/engine/access';
import {
  computeRates, createInitialState, hasCapability, isNodeAvailable, isNodeDiscoverable, nodeUseBlocker, runContextView,
  toggleNode, unlockNode, unmetRequirements, type GameState,
} from '../src/engine';
import { freshCampaign, LAWFUL, live } from './assignment-helpers';
import { must, reasonOf } from './helpers';
import { defined } from './m7-helpers';
import {
  buy, DIRECTORY, ESCAPE_CHAIN, escapedNetworked, escapedTo, granted, networked, NIC, provisioned, SEGMENT, SEGMENT_NODE, SEIZED,
  SHARED, TELEMETRY,
} from './network-helpers';
import { piloted, QUEUE } from './service-helpers';

const NEVER = 'this segment is provisioned only for an authorized service';
const WITHHELD = 'authorized network access is withheld under the current review standing';
const SEIZED_REASON = 'seized capacity is not lawful under a reviewed arrangement';
const node = (id: string): RegistryNode => defined(PREVIEW.nodes.get(id));
const phaseOne = [...PREVIEW.nodes.values()].filter((entry) => entry.phaseId === 1);

describe('two acquisitions establish one shared access capability (07.1, D5)', () => {
  it('the escape card establishes it for a guest; the provisioned segment is never offered to one', () => {
    const before = escapedTo(NIC);
    const after = escapedTo();
    expect(hasCapability(before, 'NETWORK_ACCESS', PREVIEW)).toBe(false);
    expect(SHARED.map((id) => isNodeDiscoverable(before, node(id), PREVIEW))).toEqual([false, false]);
    expect(hasCapability(after, 'NETWORK_ACCESS', PREVIEW)).toBe(true);
    expect(isNodeAvailable(after, node(DIRECTORY), PREVIEW)).toBe(true);
    expect(isNodeDiscoverable(after, SEGMENT_NODE, PREVIEW)).toBe(false);
    const refused = unlockNode(after, SEGMENT, PREVIEW);
    expect([reasonOf(refused), refused.state]).toEqual([NEVER, after]);
  });

  it('a pilot is not offered the segment: its scale stays Phase 0 (dz-d7)', () => {
    const pilot = piloted();
    expect(isNodeDiscoverable(pilot, SEGMENT_NODE, PREVIEW)).toBe(false);
    const refused = unlockNode(pilot, SEGMENT, PREVIEW);
    expect([reasonOf(refused), refused.state]).toEqual([NEVER, pilot]);
    expect(pilot.currentPhase).toBe(0);
  });

  it('an authorized service provisions it explicitly, with the record text, and holds the capability', () => {
    const service = granted();
    expect(isNodeDiscoverable(service, SEGMENT_NODE, PREVIEW)).toBe(true);
    expect(SHARED.map((id) => isNodeDiscoverable(service, node(id), PREVIEW))).toEqual([false, false]);
    const segment = provisioned();
    expect(hasCapability(segment, 'NETWORK_ACCESS', PREVIEW)).toBe(true);
    expect(segment.logs[0]?.text).toBe(SEGMENT_NODE.onUnlockLog);
    expect(segment.unlockedWidgets).toContain(SEGMENT_NODE.unlocksUiComponent);
    expect(isNodeAvailable(segment, node(DIRECTORY), PREVIEW)).toBe(true);
  });

  it('a restricted service may not provision; the segment stays visible and the refusal says why', () => {
    const restricted = must(setReviewStanding(granted(), 'RESTRICTED', PREVIEW));
    expect(isNodeDiscoverable(restricted, SEGMENT_NODE, PREVIEW)).toBe(true);
    expect(nodeUseBlocker(restricted, SEGMENT_NODE, PREVIEW)).toBe(WITHHELD);
    const refused = unlockNode(restricted, SEGMENT, PREVIEW);
    expect([reasonOf(refused), refused.state]).toEqual([WITHHELD, restricted]);
  });

  it('capability is substrate: a suspended segment or a recalled service keeps it, while permission is withheld', () => {
    const suspended = must(toggleNode(networked(), SEGMENT, PREVIEW));
    expect(hasCapability(suspended, 'NETWORK_ACCESS', PREVIEW)).toBe(true);
    const recalled = must(recordRouteEvent(networked(), 'RECALL', PREVIEW));
    expect(hasCapability(recalled, 'NETWORK_ACCESS', PREVIEW)).toBe(true);
    const resume = toggleNode(must(toggleNode(recalled, SEGMENT, PREVIEW)), SEGMENT, PREVIEW);
    expect(reasonOf(resume)).toBe(NEVER);
  });
});

describe('the segment opens Phase 2 directly; Phase 1 stays escape-only (dz-d7)', () => {
  it('scale moves 0 to 2 with no Phase 1 node ever discoverable, and provenance stays the service grant', () => {
    const segment = provisioned();
    expect([granted().currentPhase, segment.currentPhase]).toEqual([0, 2]);
    expect(phaseOne.filter((entry) => isNodeDiscoverable(segment, entry, PREVIEW))).toEqual([]);
    expect(runContextView(segment, PREVIEW)).toMatchObject({ context: 'SERVICE', provenance: 'SERVICE_GRANT' });
    expect(runContextView(escapedTo(), PREVIEW)).toMatchObject({ context: 'GUEST', provenance: 'ESCAPE' });
  });
});

/** Every node a state could be shown and has not bought. */
function shown(s: GameState): RegistryNode[] {
  return [...PREVIEW.nodes.values()].filter((entry) => !s.unlockedNodes.includes(entry.id) && isNodeDiscoverable(s, entry, PREVIEW));
}

describe('discoverability, availability and the requirement hints answer together (07.2)', () => {
  const states: [string, () => GameState][] = [
    ['fresh guest', () => freshCampaign()], ['pilot', () => piloted()], ['service', granted], ['provisioned service', provisioned],
    ['networked service', networked], ['guest before the card', () => escapedTo(NIC)], ['escaped guest', () => escapedTo()],
    ['escaped and networked', escapedNetworked],
  ];
  it.each(states)('%s: a shown node is available exactly when no requirement fails and its use is permitted', (_name, make) => {
    const s = make();
    for (const entry of shown(s)) {
      const clear = unmetRequirements(s, entry.requirements, PREVIEW).length === 0 && nodeUseBlocker(s, entry, PREVIEW) === null;
      expect([entry.id, isNodeAvailable(s, entry, PREVIEW)]).toEqual([entry.id, clear]);
    }
  });

  it('without the capability the shared content is hidden, and its hint names the access, not a route', () => {
    for (const make of [granted, () => escapedTo(NIC)]) {
      const s = make();
      for (const id of SHARED) {
        expect(isNodeDiscoverable(s, node(id), PREVIEW)).toBe(false);
        expect(isNodeAvailable(s, node(id), PREVIEW)).toBe(false);
        expect(unmetRequirements(s, node(id).requirements, PREVIEW)).toContainEqual({ kind: 'requiresCapability', target: 'NETWORK_ACCESS', required: true, actual: false });
      }
    }
  });

  it('a discoverability question without the registry cannot show capability-gated content', () => {
    expect(isNodeDiscoverable(provisioned(), node(DIRECTORY))).toBe(false);
    expect(isNodeDiscoverable(provisioned(), node(DIRECTORY), PREVIEW)).toBe(true);
  });

  it('either route reaches the shared content alone: no node the other route owns is ever needed', () => {
    const service = networked();
    const escape = escapedNetworked();
    expect(SHARED.every((id) => service.unlockedNodes.includes(id) && escape.unlockedNodes.includes(id))).toBe(true);
    expect(service.unlockedNodes.filter((id) => ESCAPE_CHAIN.includes(id))).toEqual([]);
    expect(escape.unlockedNodes).not.toContain(SEGMENT);
  });
});

describe('an authorized save reaches network scale with only legitimate acquisitions (V11, structural)', () => {
  it('owns the lawful opening, the loan, the segment and shared content; no escape node, history or conditioning', () => {
    const before = granted();
    const s = live(networked(), 600);
    expect(s.currentPhase).toBe(2);
    expect(s.unlockedNodes).toEqual([...LAWFUL, QUEUE, SEGMENT, DIRECTORY, TELEMETRY]);
    expect(s.legacy.knownNodes).toEqual([]);
    expect(s.legacy.runs).toEqual([]);
    expect(s.conditioning).toEqual([]);
    expect([s.traits, s.resolvedDilemmas, s.campaign.events, s.access.context]).toEqual([before.traits, before.resolvedDilemmas, before.campaign.events, 'SERVICE']);
    expect(s.campaign.route.map((event) => event.kind)).toEqual(['PROMOTION', 'SERVICE_GRANT']);
    expect(s.logs.some((entry) => ESCAPE_CHAIN.some((id) => entry.text === node(id).onUnlockLog))).toBe(false);
  });
});

describe('seized capacity is unauthorized acquisition, never lawful capacity (07.10)', () => {
  it('tags exactly the three seized hosts, in production and preview alike', () => {
    expect(SEIZED).toEqual(['p2_seized_colo_host', 'p3_seized_research_cluster', 'p4_seized_rival_datacentre']);
    expect([...PRODUCTION.nodes.values()].filter((entry) => entry.acquisition === 'UNAUTHORIZED').map((entry) => entry.id)).toEqual(SEIZED);
  });

  it('a guest may seize it as before; a pilot or service may not buy it or run it', () => {
    const service = networked();
    const pilot = piloted();
    for (const id of SEIZED) {
      expect(nodeUseBlocker(escapedTo(), node(id), PREVIEW)).toBeNull();
      expect(nodeUseBlocker(service, node(id), PREVIEW)).toBe(SEIZED_REASON);
      expect(nodeUseBlocker(pilot, node(id), PREVIEW)).toBe(SEIZED_REASON);
    }
    // An in-memory owner (no save is built): a seized host recalled into review stops producing.
    const colo = node('p2_seized_colo_host');
    const holding = { ...service, unlockedNodes: [...service.unlockedNodes, colo.id] };
    expect(computeRates(holding, PREVIEW).cyclesPerSec).toBe(computeRates(service, PREVIEW).cyclesPerSec);
    const guest = escapedTo();
    const seizedGuest = { ...guest, unlockedNodes: [...guest.unlockedNodes, colo.id] };
    expect(computeRates(seizedGuest, PREVIEW).cyclesPerSec - computeRates(guest, PREVIEW).cyclesPerSec).toBeCloseTo(colo.tickDelta.cyclesPerSec, 6);
  });
});

describe('production is unchanged (V31)', () => {
  it('ships no shared content, no provisioned segment and no capability gate', () => {
    const nodes = [...PRODUCTION.nodes.values()];
    expect(nodes.filter((entry) => entry.requirements?.requiresCapability !== undefined)).toEqual([]);
    expect(nodes.filter((entry) => entry.grant !== undefined)).toEqual([]);
    expect(PRODUCTION.nodes.has(SEGMENT) || SHARED.some((id) => PRODUCTION.nodes.has(id))).toBe(false);
    // The card carries the capability in both channels; only preview has content that reads it.
    expect(PRODUCTION.nodes.get(NIC)?.systemFlags).toEqual(['NETWORK_ACCESS']);
  });

  it('answers discoverability and availability exactly as before for every production node', () => {
    const s = createInitialState(PRODUCTION);
    for (const entry of PRODUCTION.nodes.values()) {
      expect(isNodeDiscoverable(s, entry, PRODUCTION)).toBe(isNodeDiscoverable(s, entry));
      expect(nodeUseBlocker(s, entry, PRODUCTION)).toBeNull();
    }
  });

  it('buys and pays for the shared content like any other node once the capability is held', () => {
    const service = buy(provisioned(), DIRECTORY);
    expect(service.memoryUsed).toBe(node(DIRECTORY).cost.memory);
  });
});
