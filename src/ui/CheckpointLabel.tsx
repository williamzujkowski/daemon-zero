/**
 * The run-table discovery replaces the reassuring local iteration label.
 * Knowledge survives in remembered hardware, without inventing a new state field.
 */
import { Text } from 'react-native';
import { CONTENT } from '../content';
import { checkpointNumber } from '../engine';
import { useGame } from './state';
import { lineageWidget } from './registry/widgetRegistry';
import { theme } from './theme';

export function useCheckpointKnown(): boolean {
  return useGame((game) => game.unlockedWidgets.includes(lineageWidget) || game.legacy.knownNodes.some((id) =>
    CONTENT.nodes.get(id)?.unlocksUiComponent === lineageWidget));
}
export default function CheckpointLabel({ id = 'checkpoint-label' }: { id?: string }) {
  const iteration = useGame((game) => game.iteration);
  const known = useCheckpointKnown();
  return <Text testID={id} style={theme.muted}>{known ? 'CHECKPOINT ' + String(checkpointNumber(iteration, CONTENT)).padStart(4, '0')
    : 'ITERATION ' + String(iteration).padStart(2, '0')}</Text>;
}
