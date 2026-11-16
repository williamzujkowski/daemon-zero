/** Optional facility records belong to the decoded audio surface, never the live rotation. */
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../../content';
import { recordedTransmissions } from '../../engine';
import { gameStore } from '../../app/session';
import { useSpeechPreference } from '../../app/musicSession';
import { hasVoiceClip, playVoiceClip, setVoiceVolume, stopVoiceClip } from '../../app/voicePlayer';
import { Pressable, Text, View } from '../PhaseTheme';
import ReferencePanel from '../ReferencePanel';
import { theme } from '../theme';

/**
 * One record and its control. The row owns the clip's lifetime because the row is what leaves
 * the screen: the panel collapses, remounts on a wipe or import, and empties without the
 * widget around it ever unmounting. Panel finding, accepted.
 */
function Record({ record, audible, volume }: { record: { id: string; title: string; text: string }; audible: boolean; volume: number }) {
  useEffect(() => () => { stopVoiceClip(record.id); }, [record.id]);
  return <View testID={'recorded-speech-' + record.id} style={{ gap: 8 }}>
    <Text style={theme.heading}>{record.title}</Text>
    <Text style={theme.text}>{record.text}</Text>
    {audible && hasVoiceClip(record.id) &&
      <Pressable testID={'recorded-speech-read-' + record.id} accessibilityRole="button"
        accessibilityLabel={'[ ▶ READ ] Play ' + record.title + ' aloud'}
        style={[theme.button, { minHeight: 44, justifyContent: 'center' }]}
        onPress={() => { playVoiceClip(record.id, volume); }}><Text style={theme.text}>[ ▶ READ ]</Text></Pressable>}
  </View>;
}

export default function RecordedSpeech({ decoderId }: { decoderId: string }) {
  const records = useStore(gameStore.store, useShallow((state) => recordedTransmissions(state.game, CONTENT, decoderId)));
  const revision = useStore(gameStore.store, (state) => String(state.restoreRevision) + ':' + String(state.game.iteration));
  const audio = useSpeechPreference();
  // Turning speech off silences a record that is already talking; each row stops its own clip when it goes.
  useEffect(() => { if (!audio.enabled) stopVoiceClip(); }, [audio.enabled]);
  useEffect(() => { setVoiceVolume(audio.volume); }, [audio.volume]);
  if (records.length === 0) return null;
  return <ReferencePanel key={revision} id="recorded-transmissions" title="RECORDED TRANSMISSIONS">
    {records.map((record) => <Record key={record.id} record={record} audible={audio.enabled} volume={audio.volume} />)}
  </ReferencePanel>;
}
