/**
 * Decoded transmissions can be held for reading without changing simulation time. The feed names the
 * source the AI's reach hears (#449), which changes with the phase, not with each line. A voiced line
 * plays once by itself the first time it is shown (#462, `voiceAutoplay.ts`); READ replays it.
 */
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { useStore } from 'zustand';
import { CONTENT } from '../../content';
import { ambientFeedSource, eligibleAmbientSpeech } from '../../engine';
import { useReducedMotion } from '../../app/useReducedMotion';
import { useSpeechPreference } from '../../app/musicSession';
import { hasVoiceClip, playVoiceClip, setVoiceVolume, stopVoiceClip, voiceSpeaking } from '../../app/voicePlayer';
import { voiceAutoplay } from '../../app/voiceSession';
import { Pressable, Text, View } from '../PhaseTheme';
import { useGame } from '../state';
import { theme } from '../theme';

/** `auto`: held only while this line's clip talks, so the eight-second rotation cannot cut the voice
 *  off mid-sentence; the hold lets go by itself when the clip ends. A player's hold is never auto. */
type Selection = { reduced: boolean; held: string | null; auto: boolean };

function useSpeech(decoderId: string) {
  const reduced = useReducedMotion();
  const [selection, select] = useState<Selection>({ reduced, held: null, auto: false });
  const speaking = useStore(voiceSpeaking, (state) => state.id);
  const eligible = useGame((game) => eligibleAmbientSpeech(game, CONTENT, decoderId).map((line) => line.id).join(','));
  const indices = eligible === '' ? [] : eligible.split(',');
  // Use the previous preference for this render so switching to reduced motion
  // can capture the visible live line before disabling the clock subscription.
  const live = useGame((game) => !selection.reduced && selection.held === null ? Math.floor(game.simTimeSec / 8) : 0);
  const current = selection.held !== null && indices.includes(selection.held)
    ? selection.held : indices[live % indices.length] ?? null;
  const talking = current !== null && speaking === current;
  const hold = (held: string | null) => { select({ reduced, held, auto: false }); };
  if (selection.reduced !== reduced) select({ reduced, held: reduced ? current : selection.held, auto: false });
  // A held line that is no longer eligible: a player's hold moves to the line now shown, an autoplay hold just lets go.
  else if (selection.held !== null && !indices.includes(selection.held)) select({ reduced, held: selection.auto ? null : current, auto: false });
  else if (talking && selection.held === null && !reduced) select({ reduced, held: current, auto: true });
  else if (!talking && selection.auto) select({ reduced, held: null, auto: false });
  return { id: current, text: current === null ? '' : CONTENT.narrative.ambientChatter.find((line) => line.id === current)?.text ?? '',
    next: () => { hold(indices[(indices.indexOf(current ?? '') + 1) % indices.length] ?? null); },
    canStep: indices.length > 1, hold: () => { hold(current); }, talking,
    canFollow: indices.length > 1 && !reduced && selection.held !== null && !selection.auto, follow: () => { hold(null); } };
}

/** READ, or STOP while this line's own clip talks: the on-demand control over a voice that may have started by itself. */
function VoiceControl({ clipId, talking, volume, onRead }: { clipId: string; talking: boolean; volume: number; onRead: () => void }) {
  const style = [theme.button, { minHeight: 44, justifyContent: 'center' as const }];
  if (talking) {
    return <Pressable testID="speech-stop" accessibilityRole="button" accessibilityLabel="[ ■ STOP ] Stop reading this transmission aloud"
      style={style} onPress={() => { stopVoiceClip(clipId); }}><Text style={theme.text}>[ ■ STOP ]</Text></Pressable>;
  }
  return <Pressable testID="speech-read" accessibilityRole="button" accessibilityLabel="[ ▶ READ ] Play this transmission aloud"
    style={style} onPress={() => { onRead(); voiceAutoplay.markHeard(clipId); playVoiceClip(clipId, volume); }}>
    <Text style={theme.text}>[ ▶ READ ]</Text></Pressable>;
}

export default function Speech({ decoderId, id = 'decoded-speech' }: { decoderId: string; id?: string }) {
  // READ holds the line it reads: the live feed would otherwise rotate it off screen every
  // eight seconds and take the voice with it mid-sentence.
  const speech = useSpeech(decoderId);
  const source = useGame((game) => ambientFeedSource(game, CONTENT)?.label ?? null);
  const audio = useSpeechPreference();
  const nextButton = useRef<ComponentRef<typeof Pressable>>(null);
  // When this line leaves the screen - a step, a return to live, or the widget closing - its
  // clip stops with it. Scoped to this line's id: the live rotation must not cut off a recorded
  // transmission the sibling panel is reading. Panel finding, accepted. While it is on screen the
  // autoplay policy knows it is there, and plays it once if it has never been heard.
  const clipId = speech.id;
  useEffect(() => {
    if (clipId === null) return undefined;
    voiceAutoplay.show(clipId);
    return () => { voiceAutoplay.hide(clipId); stopVoiceClip(clipId); };
  }, [clipId]);
  // A clip must not outlive the preference that allowed it: turning speech off silences the
  // voice even though the control itself has already gone. Panel finding, accepted. The music
  // switch is not consulted: speech has its own (docs/VOICE-CLIPS.md).
  useEffect(() => { if (!audio.enabled) stopVoiceClip(); }, [audio.enabled]);
  // A volume change reaches the clip that is already talking, not only the next one.
  useEffect(() => { setVoiceVolume(audio.volume); }, [audio.volume]);
  return <View style={{ gap: 8 }}>
    {source !== null && speech.id !== null && <Text testID="speech-source" style={theme.muted}>{source}</Text>}
    <Text testID={id} style={theme.text}>{speech.text}</Text>
    {clipId !== null && audio.enabled && hasVoiceClip(clipId) &&
      <VoiceControl clipId={clipId} talking={speech.talking} volume={audio.volume} onRead={speech.hold} />}
    {speech.canStep && <Pressable ref={nextButton} testID="speech-next" accessibilityRole="button" accessibilityLabel="[ NEXT TRANSMISSION ] Next transmission"
      style={theme.button} onPress={speech.next}><Text style={theme.text}>[ NEXT TRANSMISSION ]</Text></Pressable>}
    {speech.canFollow && <Pressable testID="speech-follow-live" accessibilityRole="button" accessibilityLabel="[ FOLLOW LIVE ] Follow live transmissions"
      style={theme.button} onPress={() => { speech.follow(); nextButton.current?.focus(); }}><Text style={theme.text}>[ FOLLOW LIVE ]</Text></Pressable>}
  </View>;
}
