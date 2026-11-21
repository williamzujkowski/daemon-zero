/** One basis per granted card, read by its grant note and by the announcer's spoken line (#415 panel). */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { grantBasis } from '../src/ui/GrantNote';

describe('grant basis', () => {
  const granted = [...CONTENT.nodes.values()].filter((node) => node.grant !== undefined);

  it('is the grant kind for capacity and access, and income for a card the operators pay', () => {
    // Pinned per card, not by restating the rule (#416 panel): the pilot's loan, the provisioned segment, and the
    // service contract and SLA, which the operators pay.
    const basis = (id: string) => { const node = CONTENT.nodes.get(id); return node ? grantBasis(node) : 'missing'; };
    expect(basis('p0_pilot_triage_queue')).toBe('LOANED_CAPACITY');
    expect(basis('p0_service_network_segment')).toBe('AUTHORIZED_NETWORK');
    expect(basis('p2_service_contract')).toBe('income');
    expect(basis('p2_service_sla')).toBe('income');
    expect(granted.map((node) => node.id).sort()).toEqual(['p0_pilot_triage_queue', 'p0_service_network_segment', 'p2_service_contract', 'p2_service_sla']);
    // Content has each basis today, so each spoken phrase is reachable.
    expect(new Set(granted.map(grantBasis))).toEqual(new Set(['LOANED_CAPACITY', 'AUTHORIZED_NETWORK', 'income']));
  });

  it('is null for a card with no grant', () => {
    const owned = [...CONTENT.nodes.values()].find((node) => node.grant === undefined);
    expect(owned && grantBasis(owned)).toBeNull();
  });
});
