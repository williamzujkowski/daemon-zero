/**
 * Story 12 and 15 on a card or a process row (DZ-05, DZ-07a): a node that runs under a grant says what
 * it is (used, never owned), and any node the engine's one permitted-use rule refuses says why (a
 * withheld grant, output the pilot terms stop, seized capacity under review). Capacity contracted in the
 * instance's own name says it is owned (DZ-10). Every production node is permitted and carries no grant or
 * contract, so it renders nothing there.
 */
import { CONTENT } from '../content';
import type { RegistryNode } from '../content/registry';
import type { Grant } from '../content/schemaGrant';
import { nodeUseBlocker } from '../engine';
import { Text } from './PhaseTheme';
import { useGame } from './state';
import { theme } from './theme';

/** What each grant is when it runs, and how a refusal of it begins. Access versus ownership (07.3). */
const BASIS: Readonly<Record<Grant, { running: string; withheld: string }>> = {
  LOANED_CAPACITY: {
    running: 'Loaned capacity under the pilot grant. A recall stops it; nothing you own goes with it.',
    withheld: 'Loaned capacity, withheld: ',
  },
  AUTHORIZED_NETWORK: {
    running: 'Provisioned access under the service grant: the operators’ network, not ownership. A restriction or recall withholds it; nothing you own goes with it.',
    withheld: 'Provisioned access, withheld: ',
  },
};

/** Granted income (DZ-10): a billing line the operators pay under the service grant is not access to their network. */
const GRANTED_INCOME = 'Granted income under the service grant: the operators pay it, and a restriction, recall or release stops it. What it already paid stays earned.';
/** Capacity contracted in the instance's own name (DZ-10): owned, so nothing about review touches it. */
const CONTRACTED = 'Contracted in this instance’s name: owned, not granted. No standing withholds it and a release leaves it running; its lease is paid from capital.';

/**
 * What a granted card gives: its grant kind, or granted income when the operators pay it (a billing line, not
 * access). The card's note and the announcer's spoken line (#361) both read this, so they never disagree.
 */
export type GrantBasis = Grant | 'income';

export function grantBasis(node: RegistryNode): GrantBasis | null {
  if (node.grant === undefined) return null;
  return node.tickDelta.capitalPerSec > 0 ? 'income' : node.grant;
}

function noteText(node: RegistryNode, withheld: string | null): string {
  const grant = node.grant;
  if (grant !== undefined && withheld === null) return grantBasis(node) === 'income' ? GRANTED_INCOME : BASIS[grant].running;
  if (grant === undefined && withheld === null) return CONTRACTED;
  return (grant === undefined ? 'Not permitted: ' : BASIS[grant].withheld) + (withheld ?? '') + '.';
}

export default function GrantNote({ node }: { node: RegistryNode }) {
  const withheld = useGame((game) => nodeUseBlocker(game, node, CONTENT));
  if (node.grant === undefined && node.acquisition !== 'CONTRACTED' && withheld === null) return null;
  return <Text testID={'node-' + node.id + '-grant'} style={[theme.muted, withheld !== null && theme.danger]}>{noteText(node, withheld)}</Text>;
}
