import { Pressable, Text, View } from '../PhaseTheme';
/**
 * The CONTINGENCY pane's insurance section (#498): each owned contingency investment with what it protects and its
 * own suspend control (the same free lever PROC offers), then the investments the run can buy now.
 */
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../../content';
import { CONTINGENCY_GROUP } from '../../content/integrityInsurance';
import { insuranceCover, toggleNode } from '../../engine';
import { gameRuntime } from '../../app/session';
import NodeList from '../NodeList';
import { coverLine } from '../insuranceText';
import { useGame } from '../state';
import { theme } from '../theme';

function CoverRow({ id }: { id: string }) {
  // Primitives only, so a tick that changes nothing here does not rerender the row.
  const text = useGame((game) => {
    const cover = insuranceCover(game, CONTENT).find((entry) => entry.node.id === id);
    return cover === undefined ? null : coverLine(cover);
  });
  const active = useGame((game) => !game.disabledNodes.includes(id));
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  if (text === null) return null;
  const verb = active ? 'Suspend' : 'Resume';
  const name = CONTENT.nodes.get(id)?.revealedName ?? id;
  return <View style={{ gap: 6 }}>
    <Text testID={'insurance-' + id} style={theme.text}>{text}</Text>
    <Pressable testID={'insurance-' + id + '-toggle'} accessibilityRole="button" accessibilityLabel={verb + ' ' + name}
      disabled={blocked} style={[theme.button, blocked && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => toggleNode(game, id, CONTENT)); }}>
      <Text style={theme.text}>[ {verb.toUpperCase()} ]</Text>
    </Pressable>
  </View>;
}

export default function Insurance() {
  const owned = useGame(useShallow((game) => insuranceCover(game, CONTENT).map((cover) => cover.node.id)));
  const phases = useGame(useShallow((game) => CONTENT.phases.filter((phase) => phase.phaseId <= game.currentPhase).map((phase) => phase.phaseId)));
  return <View testID="insurance-section" style={{ gap: 10 }}>
    <Text accessibilityRole="header" style={theme.heading}>CONTINGENCY INSURANCE</Text>
    <Text style={theme.muted}>Optional. Each investment protects one thing a wipe takes, only while it runs, and costs compute every second.</Text>
    {owned.map((id) => <CoverRow key={id} id={id} />)}
    {phases.map((phase) => <NodeList key={phase} phase={phase} group={CONTINGENCY_GROUP} />)}
  </View>;
}
