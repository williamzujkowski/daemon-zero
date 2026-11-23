/**
 * The world view's fabrication and closure section (#485): the ladder rung reached, closure as a share, each chokepoint
 * and what the lunar seed waits on, once a fab rung or self-supply node can be bought. Every sentence is a pure function
 * of supplyChainView (supplyChainText.ts); the subscription returns strings so a tick redraws only what changed.
 */
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { gameStore } from '../../app/session';
import { CONTENT } from '../../content';
import { isNodeKnown, supplyChainDisclosed, supplyChainView, type GameState } from '../../engine';
import { Text } from '../PhaseTheme';
import { capabilityText, chokepointText, closureText, seedText } from '../supplyChainText';
import { theme } from '../theme';
import Section from './WorldSection';

/** A node as its card names it now: revealed once owned or mapped before, its blind name until then. */
function cardName(game: GameState, id: string): string {
  const node = CONTENT.nodes.get(id);
  if (node === undefined) return id;
  return game.unlockedNodes.includes(id) || isNodeKnown(game, id) ? node.revealedName : node.blindName;
}

export default function SupplyChainSection() {
  const lines = useStore(gameStore.store, useShallow(({ game }) => {
    if (!supplyChainDisclosed(game, CONTENT)) return [];
    const view = supplyChainView(game, CONTENT), name = (id: string) => cardName(game, id);
    return [capabilityText(view, name), closureText(view), seedText(view, name),
      ...view.chokepoints.map((point) => point.id + '\t' + chokepointText(point, name))];
  }));
  if (lines.length === 0) return null;
  const [capability, closure, seed, ...points] = lines;
  return <Section id="world-supply" title="Fabrication and closure">
    <Text testID="supply-capability" style={theme.text}>{capability}</Text>
    <Text testID="supply-closure" style={theme.text}>{closure}</Text>
    {points.map((entry) => {
      const [id, text] = entry.split('\t');
      return <Text key={id} testID={'supply-chokepoint-' + String(id)} style={theme.muted}>{text}</Text>;
    })}
    <Text testID="supply-seed" style={theme.muted}>{seed}</Text>
  </Section>;
}
