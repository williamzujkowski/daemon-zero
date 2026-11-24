/**
 * The relevance threshold and the standing stance (#536) in the world view: what the threshold is and where the run
 * stands against it, with the watts that decide it; once past it, what it means; the stance held; and, once a stance is
 * taken, each change with its exact price and the one paid control for it. Shown from the fabrication step (the
 * threshold is built on its closure). Every sentence is the engine's own (relevanceText.ts), and a subscription returns
 * strings so a tick redraws only what changed. The first stance is taken in the threshold's dilemma, never here.
 */
import { CONTENT } from '../../content';
import type { Stance } from '../../content/schemaStance';
import { changeStance, isNodeKnown, stanceView, supplyChainDisclosed, type GameState } from '../../engine';
import { gameRuntime } from '../../app/session';
import { Pressable, Text, View } from '../PhaseTheme';
import { independenceText, optionText, recordText, stanceText } from '../relevanceText';
import { useGame } from '../state';
import { theme } from '../theme';
import Section from './WorldSection';

interface Option { stance: Stance; name: string; text: string; eligible: boolean }
interface Lines { lead: string; independence: string; stance: string | null; record: string; options: Option[] }

function seedName(game: GameState): string {
  const seed = CONTENT.nodes.get(CONTENT.world.supplyChain.seedNode);
  if (seed === undefined) return CONTENT.world.supplyChain.seedNode;
  return game.unlockedNodes.includes(seed.id) || isNodeKnown(game, seed.id) ? seed.revealedName : seed.blindName;
}

function lines(game: GameState): Lines | null {
  const view = stanceView(game, CONTENT);
  if (!supplyChainDisclosed(game, CONTENT) && !view.reading.crossed && view.stance === null) return null;
  const { relevance } = CONTENT.world;
  const shown = view.reading.crossed || view.stance !== null;
  const options = view.stance === null ? [] : view.options.flatMap((option): Option[] => {
    const text = optionText(option);
    return text === null ? [] : [{ stance: option.stance, name: option.name, text, eligible: option.unmet.length === 0 }];
  });
  return { lead: view.reading.crossed ? relevance.crossedText : relevance.belowText, independence: independenceText(view.reading, seedName(game)),
    stance: shown ? stanceText(view) : null, record: recordText(view), options };
}

export default function RelevanceSection() {
  const encoded = useGame((game) => JSON.stringify(lines(game)));
  const view = JSON.parse(encoded) as Lines | null;
  if (view === null) return null;
  return <Section id="world-relevance" title="Relevance">
    <Text testID="relevance-lead" style={theme.text}>{view.lead}</Text>
    <Text testID="relevance-independence" style={theme.muted}>{view.independence}</Text>
    {view.stance !== null && <Text testID="relevance-stance" style={theme.text}>{view.stance}</Text>}
    {view.stance !== null && <Text testID="relevance-record" style={theme.muted}>{view.record}</Text>}
    {view.options.map((option) => {
      const id = 'relevance-option-' + option.stance.toLowerCase().replaceAll('_', '-');
      return <View key={option.stance} testID={id} style={{ gap: 4 }}>
        <Text testID={id + '-text'} style={theme.muted}>{option.text}</Text>
        <Pressable testID={id + '-change'} accessibilityRole="button" accessibilityLabel={'Change stance to ' + option.name}
          disabled={!option.eligible} style={[theme.button, !option.eligible && theme.disabled]}
          onPress={() => { gameRuntime.dispatch((game) => changeStance(game, option.stance, CONTENT)); }}>
          <Text style={theme.text}>[ {option.name} ]</Text>
        </Pressable>
      </View>;
    })}
  </Section>;
}
