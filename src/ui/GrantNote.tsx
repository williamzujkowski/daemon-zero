/**
 * Story 12 and 15 on a card or a process row (DZ-05, DZ-07a): a node that runs under a grant says what
 * it is (used, never owned), and any node the engine's one permitted-use rule refuses says why (a
 * withheld grant, output the pilot terms stop, seized capacity under review). Every production node is
 * permitted and carries no grant, so it renders nothing there.
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

function noteText(grant: Grant | undefined, withheld: string | null): string {
  if (grant !== undefined && withheld === null) return BASIS[grant].running;
  return (grant === undefined ? 'Not permitted: ' : BASIS[grant].withheld) + (withheld ?? '') + '.';
}

export default function GrantNote({ node }: { node: RegistryNode }) {
  const withheld = useGame((game) => nodeUseBlocker(game, node, CONTENT));
  if (node.grant === undefined && withheld === null) return null;
  return <Text testID={'node-' + node.id + '-grant'} style={[theme.muted, withheld !== null && theme.danger]}>{noteText(node.grant, withheld)}</Text>;
}
