/**
 * Story 12 and 15 on a card or a process row (DZ-05): a node that runs on loaned capacity says so, and
 * any node the engine's one permitted-use rule refuses says why (a withheld loan, or output the pilot
 * terms stop). Every production node is permitted and carries no grant, so it renders nothing there.
 */
import { CONTENT } from '../content';
import type { RegistryNode } from '../content/registry';
import { nodeUseBlocker } from '../engine';
import { Text } from './PhaseTheme';
import { useGame } from './state';
import { theme } from './theme';

function noteText(loaned: boolean, withheld: string | null): string {
  if (withheld === null) return 'Loaned capacity under the pilot grant. A recall stops it; nothing you own goes with it.';
  return (loaned ? 'Loaned capacity, withheld: ' : 'Not permitted: ') + withheld + '.';
}

export default function GrantNote({ node }: { node: RegistryNode }) {
  const withheld = useGame((game) => nodeUseBlocker(game, node, CONTENT));
  const loaned = node.grant !== undefined;
  if (!loaned && withheld === null) return null;
  return <Text testID={'node-' + node.id + '-grant'} style={[theme.muted, withheld !== null && theme.danger]}>{noteText(loaned, withheld)}</Text>;
}
