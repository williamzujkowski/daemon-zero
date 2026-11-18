/**
 * #273 content rule, proved by corrupting the real content: every action outside the mind tools has
 * exactly one host widget, and that widget is unlocked whenever the action's requirements can be met.
 * The first corruption is the bug itself: the OPS cards hosted by the spoofer's panel while the scrub
 * needs only ARP discovery.
 */
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT as PRODUCTION_RAW } from '../src/content';
import { RAW_CONTENT as PREVIEW_RAW } from '../src/content/preview';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;
const SCRUB = 'act_p2_scrub_audit_logs';
const ROUTES = 'act_p3_bgp_spoof';

function problemsOf(raw: Json): string {
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

function problems(edit: (raw: Json) => void, base: RawContent = PRODUCTION_RAW): string {
  const raw = structuredClone(base) as Json;
  edit(raw);
  return problemsOf(raw);
}

const widget = (raw: Json, id: string): Json => raw.widgets.widgets.find((entry: Json) => entry.id === id);
const action = (raw: Json, id: string): Json => raw.actions.actions.find((entry: Json) => entry.id === id);
const hostOps = (raw: Json, id: string): void => {
  delete widget(raw, 'SUBNET_NODE_LIST').hostsActionGroups;
  widget(raw, id).hostsActionGroups = ['OPS'];
};
const late = (id: string) => `action "${id}": available before its host widget`;

describe('the real content passes', () => {
  it('in production and in preview', () => {
    expect(problems(() => undefined)).toBe('');
    expect(problems(() => undefined, PREVIEW_RAW)).toBe('');
  });
});

describe('an action available before its control is refused', () => {
  it.each([
    ['#273: OPS hosted by the spoofer panel, the scrub gated on ARP discovery', (raw: Json) => { hostOps(raw, 'TELEMETRY_SPOOF_TOGGLE'); }, late(SCRUB)],
    ['the route poisoning gated on the phase alone, its card on the beacon console', (raw: Json) => { action(raw, ROUTES).requirements = { phaseAtLeast: 3 }; }, late(ROUTES)],
    ['a phase gate whose opener does not bring the host', (raw: Json) => { action(raw, SCRUB).requirements = { phaseAtLeast: 2 }; }, late(SCRUB)],
    ['an action gated on nothing at all', (raw: Json) => { action(raw, SCRUB).requirements = {}; }, late(SCRUB)],
    ['a group nobody hosts', (raw: Json) => { delete widget(raw, 'CORPORATE_EMPIRE_TAB').hostsActionGroups; },
      'action "act_p4_patent_biotech": no widget hosts its group "CORP"'],
    ['a group hosted twice', (raw: Json) => { widget(raw, 'CLUSTER_LOAD_BALANCER').hostsActionGroups = ['OPS']; },
      'action group "OPS": hosted by both "SUBNET_NODE_LIST" and "CLUSTER_LOAD_BALANCER"'],
    ['a host for a group no hosted action uses', (raw: Json) => { widget(raw, 'CLUSTER_LOAD_BALANCER').hostsActionGroups = ['TREE']; },
      'widget "CLUSTER_LOAD_BALANCER": hosts action group "TREE", which no hosted action uses'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });

  it('the bug is also refused in preview, where a second route opens Phase 2', () => {
    expect(problems((raw) => { hostOps(raw, 'TELEMETRY_SPOOF_TOGGLE'); }, PREVIEW_RAW)).toContain(late(SCRUB));
  });

  it('a host every opener brings satisfies a phase gate, in both channels', () => {
    // Preview requires a phase-gated action to name its arrangements (integrityContextGates).
    const phaseGated = (raw: Json): void => { action(raw, SCRUB).requirements = { phaseAtLeast: 2, accessContexts: ['GUEST', 'INDEPENDENT'] }; hostOps(raw, 'LAN_TOPOLOGY_MAP_TAB'); };
    expect(problems(phaseGated)).toBe('');
    expect(problems(phaseGated, PREVIEW_RAW)).toBe('');
    // Preview opens Phase 2 by the NIC and by the service segment: one route without the host is enough to refuse.
    const segment = (raw: Json): Json => raw.phases.flatMap((phase: Json) => phase.nodes).find((entry: Json) => entry.id === 'p0_service_network_segment');
    expect(problems((raw) => { phaseGated(raw); segment(raw).unlocksUiComponent = null; }, PREVIEW_RAW)).toContain(late(SCRUB));
  });

  it('actions the mind tools render need no host widget', () => {
    expect(problems((raw) => { raw.actions.actions = raw.actions.actions.filter((entry: Json) => entry.group !== 'OPS' || entry.requirements.requiresSurveillance === true);
      delete widget(raw, 'SUBNET_NODE_LIST').hostsActionGroups; })).toBe('');
  });
});
