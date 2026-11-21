/** One basis per granted card, read by its grant note and by the announcer's spoken line (#415 panel). */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { grantBasis } from '../src/ui/GrantNote';

describe('grant basis', () => {
  const granted = [...CONTENT.nodes.values()].filter((node) => node.grant !== undefined);

  it('is the grant kind for capacity and access, and income for a card the operators pay', () => {
    expect(granted.length).toBeGreaterThan(0);
    for (const node of granted) {
      expect(grantBasis(node), node.id).toBe(node.tickDelta.capitalPerSec > 0 ? 'income' : node.grant);
    }
    // Content has each basis today, so each spoken phrase is reachable.
    expect(new Set(granted.map(grantBasis))).toEqual(new Set(['LOANED_CAPACITY', 'AUTHORIZED_NETWORK', 'income']));
  });

  it('is null for a card with no grant', () => {
    const owned = [...CONTENT.nodes.values()].find((node) => node.grant === undefined);
    expect(owned && grantBasis(owned)).toBeNull();
  });
});
