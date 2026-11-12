/**
 * Discovery is structural: a first manual probe reveals the initial blind node.
 * Requirements stay visible after prerequisites, while permission uses the engine.
 */
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../content';
import { pendingNode } from './purchaseVisibility';
import { gameStore } from '../app/session';
import NodeCard from './NodeCard';

export default function NodeList({ phase, group, showLocked = false }: {
  phase: number; group?: string; showLocked?: boolean;
}) {
  const ids = useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.nodes.values()]
    .filter((node) => node.phaseId === phase && (group === undefined || node.uiGroup === group) &&
      pendingNode(game, node, showLocked)).map((node) => node.id)));
  return <>{ids.map((id) => {
    const node = CONTENT.nodes.get(id);
    return node ? <NodeCard key={id} node={node} /> : null;
  })}</>;
}
