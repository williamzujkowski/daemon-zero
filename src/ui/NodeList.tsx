/**
 * Discovery is structural: a first manual probe reveals the initial blind node.
 * Requirements stay visible after prerequisites, while permission uses the engine.
 */
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../content';
import { gameStore } from '../app/session';
import NodeCard from './NodeCard';

export default function NodeList({ owned, phase = 1, group, showLocked = false }: {
  owned?: boolean; phase?: number; group?: string; showLocked?: boolean;
}) {
  const ids = useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.nodes.values()]
    .filter((node) => (owned === undefined || game.unlockedNodes.includes(node.id) === owned) && node.phaseId === phase &&
      (group === undefined || node.uiGroup === group) && (game.unlockedNodes.includes(node.id) || showLocked ||
      ((game.cycles > 0 || game.unlockedNodes.length > 0) && node.prerequisites.every((id) => game.unlockedNodes.includes(id)))))
    .map((node) => node.id)));
  return <>{ids.map((id) => {
    const node = CONTENT.nodes.get(id);
    return node ? <NodeCard key={id} node={node} /> : null;
  })}</>;
}
