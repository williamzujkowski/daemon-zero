/** Optional facility records belong to the decoded audio surface, never the live rotation. */
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../../content';
import { recordedTransmissions } from '../../engine';
import { gameStore } from '../../app/session';
import { useSpeechPreference } from '../../app/musicSession';
import { hasVoiceClip, playVoiceClip, setVoiceVolume, stopVoiceClip, voiceSpeaking } from '../../app/voicePlayer';
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
  // READ becomes STOP while this record talks, the same control the live feed offers (#462).
  const talking = useStore(voiceSpeaking, (state) => state.id === record.id);
  const style = [theme.button, { minHeight: 44, justifyContent: 'center' as const }];
  return <View testID={'recorded-speech-' + record.id} style={{ gap: 8 }}>
    <Text style={theme.heading}>{record.title}</Text>
    <Text style={theme.text}>{record.text}</Text>
    {audible && hasVoiceClip(record.id) && (talking
      ? <Pressable testID={'recorded-speech-stop-' + record.id} accessibilityRole="button"
        accessibilityLabel={'[ ■ STOP ] Stop reading ' + record.title + ' aloud'} style={style}
        onPress={() => { stopVoiceClip(record.id); }}><Text style={theme.text}>[ ■ STOP ]</Text></Pressable>
      : <Pressable testID={'recorded-speech-read-' + record.id} accessibilityRole="button"
        accessibilityLabel={'[ ▶ READ ] Play ' + record.title + ' aloud'} style={style}
        onPress={() => { playVoiceClip(record.id, volume); }}><Text style={theme.text}>[ ▶ READ ]</Text></Pressable>)}
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
