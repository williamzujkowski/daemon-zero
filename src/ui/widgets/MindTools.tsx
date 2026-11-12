/** Slot ownership follows phase metadata; the decoded mind sees one tools console, never duplicates. */
import { CONTENT } from '../../content';
import { useGame, useSurveillanceKnown } from '../state';
import { View } from '../PhaseTheme';
import Epistemic from './Epistemic';
import WildEncounter from './WildEncounter';
import Swarm from './Swarm';
export default function MindTools({ slot, signalOnly = false }: { slot: 'NETWORK' | 'CORP'; signalOnly?: boolean }) {
  const known = useSurveillanceKnown();
  const enabled = useGame((game) => CONTENT.phases.find((phase) => phase.phaseId === game.currentPhase)?.uiSlot === slot);
  if (!known || !enabled) return null;
  return signalOnly ? <WildEncounter /> : <View style={{ gap: 16 }}><Epistemic /><Swarm /></View>;
}
