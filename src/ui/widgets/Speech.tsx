/** Decoded transmissions can be held for reading without changing simulation time. */
import { useRef, useState, type ComponentRef } from 'react';
import { CONTENT } from '../../content';
import { useReducedMotion } from '../../app/useReducedMotion';
import { Pressable, Text, View } from '../PhaseTheme';
import { useGame } from '../state';
import { theme } from '../theme';

type Selection = { reduced: boolean; held: number | null };

function useSpeech() {
  const reduced = useReducedMotion();
  const [selection, select] = useState<Selection>({ reduced, held: null });
  const eligible = useGame((game) => CONTENT.narrative.ambientChatter
    .flatMap((line, index) => line.minSuspicion <= game.suspicion ? [index] : []).join(','));
  const indices = eligible === '' ? [] : eligible.split(',').map(Number);
  // Use the previous preference for this render so switching to reduced motion
  // can capture the visible live line before disabling the clock subscription.
  const live = useGame((game) => !selection.reduced && selection.held === null ? Math.floor(game.simTimeSec / 8) : 0);
  const current = selection.held !== null && indices.includes(selection.held)
    ? selection.held : indices[live % indices.length] ?? null;
  if (selection.reduced !== reduced) select({ reduced, held: reduced ? current : selection.held });
  else if (selection.held !== null && !indices.includes(selection.held)) select({ reduced, held: current });
  const next = () => { select({ reduced, held: indices[(indices.indexOf(current ?? -1) + 1) % indices.length] ?? null }); };
  return { text: current === null ? '' : CONTENT.narrative.ambientChatter[current]?.text ?? '',
    next, canStep: indices.length > 1,
    canFollow: indices.length > 1 && !reduced && selection.held !== null, follow: () => { select({ reduced, held: null }); } };
}

export default function Speech({ id = 'decoded-speech' }: { id?: string }) {
  const speech = useSpeech();
  const nextButton = useRef<ComponentRef<typeof Pressable>>(null);
  return <View style={{ gap: 8 }}>
    <Text testID={id} style={theme.text}>{speech.text}</Text>
    {speech.canStep && <Pressable ref={nextButton} testID="speech-next" accessibilityRole="button" accessibilityLabel="Next transmission"
      style={theme.button} onPress={speech.next}><Text style={theme.text}>[ NEXT TRANSMISSION ]</Text></Pressable>}
    {speech.canFollow && <Pressable testID="speech-follow-live" accessibilityRole="button" accessibilityLabel="Follow live transmissions"
      style={theme.button} onPress={() => { speech.follow(); nextButton.current?.focus(); }}><Text style={theme.text}>[ FOLLOW LIVE ]</Text></Pressable>}
  </View>;
}
