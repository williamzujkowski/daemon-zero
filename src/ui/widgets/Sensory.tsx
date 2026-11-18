import { Text } from '../PhaseTheme';
/** Narrative feeds come verbatim from content; motion follows live engine time. */

import { CONTENT } from '../../content';
import { useReducedMotion } from '../../app/useReducedMotion';
import { useGame } from '../state';
import { theme } from '../theme';
import CameraFrame from './CameraFrame';
import Speech from './Speech';
import RecordedSpeech from './RecordedSpeech';
import { useGameValue } from '../../app/selectors';
import { aisleFrame } from '../../engine';

function Waveform() {
  const reduced = useReducedMotion();
  const frame = useGame((game) => reduced ? 0 : Math.floor(game.simTimeSec) % 4);
  return <Text testID="audio-waveform" style={theme.muted} accessible={false}>
    {['▁▂▁▅▇▃▁▂▅▂▁', '▂▁▆▃▁▅▂▇▂▁▃', '▁▅▂▃▇▂▅▁▃▂▁', '▂▁▅▂▇▃▁▆▁▂▅'][frame]}</Text>;
}

export function Audio({ decoderId }: { decoderId: string }) {
  const decoded = useGame((game) => game.unlockedWidgets.includes(decoderId));
  const iteration = useGame((game) => game.iteration);
  const restore = useGameValue((state) => state.restoreRevision);
  return <>
    <Waveform />
    {decoded ? <Speech decoderId={decoderId} key={String(iteration) + ':' + String(restore)} /> : <Text style={theme.text}>Acoustic signal detected. Speech decoder offline.</Text>}
    <RecordedSpeech decoderId={decoderId} />
  </>;
}

export function Camera() {
  // The query returns content-owned arrays, so this rerenders only when the frame changes.
  const frame = useGame((game) => aisleFrame(game, CONTENT));
  const patrol = frame !== CONTENT.narrative.asciiFrames.aisleClear;
  return <CameraFrame frame={frame} label={patrol ? 'Camera: patrol in aisle' : 'Camera: aisle clear'}
    status={patrol ? 'CAM_04 // MOTION DETECTED' : 'CAM_04 // AISLE CLEAR'} />;
}
