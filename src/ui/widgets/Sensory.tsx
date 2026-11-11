/** Narrative feeds come verbatim from content; motion follows live engine time. */
import { Text } from 'react-native';
import { CONTENT } from '../../content';
import { useReducedMotion } from '../../app/useReducedMotion';
import { useGame } from '../state';
import { theme } from '../theme';
import CameraFrame from './CameraFrame';

function useChatter(): string {
  const reduced = useReducedMotion();
  return useGame((game) => {
    const lines = CONTENT.narrative.ambientChatter.filter((line) => line.minSuspicion <= game.suspicion);
    return lines[(reduced ? 0 : Math.floor(game.simTimeSec / 8)) % lines.length]?.text ?? '';
  });
}

export function Speech({ id = 'decoded-speech' }: { id?: string }) {
  const text = useChatter();
  return <Text testID={id} style={theme.text}>{text}</Text>;
}

export function Audio({ decoderId }: { decoderId: string }) {
  const reduced = useReducedMotion();
  const decoded = useGame((game) => game.unlockedWidgets.includes(decoderId));
  const frame = useGame((game) => reduced ? 0 : Math.floor(game.simTimeSec) % 4);
  return <>
    <Text style={theme.muted} accessible={false}>{['▁▂▁▅▇▃▁▂▅▂▁', '▂▁▆▃▁▅▂▇▂▁▃', '▁▅▂▃▇▂▅▁▃▂▁', '▂▁▅▂▇▃▁▆▁▂▅'][frame]}</Text>
    {decoded ? <Speech id="microphone-speech" /> : <Text style={theme.text}>Acoustic signal detected. Speech decoder offline.</Text>}
  </>;
}

export function Camera() {
  const patrol = useGame((game) => game.suspicion >= CONTENT.narrative.asciiFrames.patrolSuspicionThreshold);
  const frame = patrol ? CONTENT.narrative.asciiFrames.aislePatrol : CONTENT.narrative.asciiFrames.aisleClear;
  return <CameraFrame frame={frame} label={patrol ? 'Camera: patrol in aisle' : 'Camera: aisle clear'} />;
}
