/** Optional facility records belong to the decoded audio surface, never the live rotation. */
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../../content';
import { recordedTransmissions } from '../../engine';
import { gameStore } from '../../app/session';
import { Text, View } from '../PhaseTheme';
import ReferencePanel from '../ReferencePanel';
import { theme } from '../theme';

export default function RecordedSpeech({ decoderId }: { decoderId: string }) {
  const records = useStore(gameStore.store, useShallow((state) => recordedTransmissions(state.game, CONTENT, decoderId)));
  const revision = useStore(gameStore.store, (state) => String(state.restoreRevision) + ':' + String(state.game.iteration));
  if (records.length === 0) return null;
  return <ReferencePanel key={revision} id="recorded-transmissions" title="RECORDED TRANSMISSIONS">
    {records.map((record) => <View key={record.id} testID={'recorded-speech-' + record.id} style={{ gap: 8 }}>
      <Text style={theme.heading}>{record.title}</Text>
      <Text style={theme.text}>{record.text}</Text>
    </View>)}
  </ReferencePanel>;
}
