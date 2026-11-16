/** Optional facility records belong to the decoded audio surface, never the live rotation. */
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../../content';
import { recordedTransmissions } from '../../engine';
import { gameStore } from '../../app/session';
import { useMusic } from '../../app/musicSession';
import { hasVoiceClip, playVoiceClip, stopVoiceClip } from '../../app/voicePlayer';
import { Pressable, Text, View } from '../PhaseTheme';
import ReferencePanel from '../ReferencePanel';
import { theme } from '../theme';

export default function RecordedSpeech({ decoderId }: { decoderId: string }) {
  const records = useStore(gameStore.store, useShallow((state) => recordedTransmissions(state.game, CONTENT, decoderId)));
  const revision = useStore(gameStore.store, (state) => String(state.restoreRevision) + ':' + String(state.game.iteration));
  const audio = useMusic();
  // Records are held open while the player reads them; leaving the panel must not leave a clip
  // running, and neither must muting the audio while the panel stays open.
  useEffect(() => () => { stopVoiceClip(); }, []);
  useEffect(() => { if (!audio.enabled) stopVoiceClip(); }, [audio.enabled]);
  if (records.length === 0) return null;
  return <ReferencePanel key={revision} id="recorded-transmissions" title="RECORDED TRANSMISSIONS">
    {records.map((record) => <View key={record.id} testID={'recorded-speech-' + record.id} style={{ gap: 8 }}>
      <Text style={theme.heading}>{record.title}</Text>
      <Text style={theme.text}>{record.text}</Text>
      {audio.enabled && hasVoiceClip(record.id) &&
        <Pressable testID={'recorded-speech-read-' + record.id} accessibilityRole="button"
          accessibilityLabel={'[ ▶ READ ] Play ' + record.title + ' aloud'}
          style={[theme.button, { minHeight: 44, justifyContent: 'center' }]}
          onPress={() => { playVoiceClip(record.id, audio.volume); }}><Text style={theme.text}>[ ▶ READ ]</Text></Pressable>}
    </View>)}
  </ReferencePanel>;
}
