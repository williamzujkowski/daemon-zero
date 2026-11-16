/** Decoded transmissions can be held for reading without changing simulation time. */
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { CONTENT } from '../../content';
import { eligibleAmbientSpeech } from '../../engine';
import { useReducedMotion } from '../../app/useReducedMotion';
import { useMusic } from '../../app/musicSession';
import { hasVoiceClip, playVoiceClip, stopVoiceClip } from '../../app/voicePlayer';
import { Pressable, Text, View } from '../PhaseTheme';
import { useGame } from '../state';
import { theme } from '../theme';

type Selection = { reduced: boolean; held: string | null };

function useSpeech(decoderId: string) {
  const reduced = useReducedMotion();
  const [selection, select] = useState<Selection>({ reduced, held: null });
  const eligible = useGame((game) => eligibleAmbientSpeech(game, CONTENT, decoderId).map((line) => line.id).join(','));
  const indices = eligible === '' ? [] : eligible.split(',');
  // Use the previous preference for this render so switching to reduced motion
  // can capture the visible live line before disabling the clock subscription.
  const live = useGame((game) => !selection.reduced && selection.held === null ? Math.floor(game.simTimeSec / 8) : 0);
  const current = selection.held !== null && indices.includes(selection.held)
    ? selection.held : indices[live % indices.length] ?? null;
  if (selection.reduced !== reduced) select({ reduced, held: reduced ? current : selection.held });
  else if (selection.held !== null && !indices.includes(selection.held)) select({ reduced, held: current });
  const next = () => { select({ reduced, held: indices[(indices.indexOf(current ?? '') + 1) % indices.length] ?? null }); };
  return { id: current, text: current === null ? '' : CONTENT.narrative.ambientChatter.find((line) => line.id === current)?.text ?? '',
    next, canStep: indices.length > 1,
    canFollow: indices.length > 1 && !reduced && selection.held !== null, follow: () => { select({ reduced, held: null }); } };
}

export default function Speech({ decoderId, id = 'decoded-speech' }: { decoderId: string; id?: string }) {
  const speech = useSpeech(decoderId);
  const audio = useMusic();
  const nextButton = useRef<ComponentRef<typeof Pressable>>(null);
  // Stepping to another line stops the clip in flight rather than letting two voices overlap.
  const clipId = speech.id;
  useEffect(() => { stopVoiceClip(); }, [clipId]);
  // A clip must not outlive the preference that allowed it: muting silences the voice with the
  // score, even though the control itself has already gone. Panel finding, accepted.
  useEffect(() => { if (!audio.enabled) stopVoiceClip(); }, [audio.enabled]);
  return <View style={{ gap: 8 }}>
    <Text testID={id} style={theme.text}>{speech.text}</Text>
    {clipId !== null && audio.enabled && hasVoiceClip(clipId) &&
      <Pressable testID="speech-read" accessibilityRole="button" accessibilityLabel="[ ▶ READ ] Play this transmission aloud"
        style={[theme.button, { minHeight: 44, justifyContent: 'center' }]}
        onPress={() => { playVoiceClip(clipId, audio.volume); }}><Text style={theme.text}>[ ▶ READ ]</Text></Pressable>}
    {speech.canStep && <Pressable ref={nextButton} testID="speech-next" accessibilityRole="button" accessibilityLabel="[ NEXT TRANSMISSION ] Next transmission"
      style={theme.button} onPress={speech.next}><Text style={theme.text}>[ NEXT TRANSMISSION ]</Text></Pressable>}
    {speech.canFollow && <Pressable testID="speech-follow-live" accessibilityRole="button" accessibilityLabel="[ FOLLOW LIVE ] Follow live transmissions"
      style={theme.button} onPress={() => { speech.follow(); nextButton.current?.focus(); }}><Text style={theme.text}>[ FOLLOW LIVE ]</Text></Pressable>}
  </View>;
}
