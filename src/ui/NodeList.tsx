/**
 * Discovery is structural: a first manual probe reveals the initial blind node.
 * Requirements stay visible after prerequisites, while permission uses the engine.
 */
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../content';
import { gameStore } from '../app/session';
import NodeCard from './NodeCard';

export default function NodeList({ owned }: { owned?: boolean }) {
  const ids = useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.nodes.values()]
    .filter((node) => (owned === undefined || game.unlockedNodes.includes(node.id) === owned) && node.phaseId === 1 && (game.unlockedNodes.includes(node.id) ||
      ((game.cycles > 0 || game.unlockedNodes.length > 0) && node.prerequisites.every((id) => game.unlockedNodes.includes(id)))))
    .map((node) => node.id)));
  return <>{ids.map((id) => {
    const node = CONTENT.nodes.get(id);
    return node ? <NodeCard key={id} node={node} /> : null;
  })}</>;
}
