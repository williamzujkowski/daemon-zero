/** Slot ownership follows phase metadata; the decoded mind sees one tools console, never duplicates. */
import { CONTENT } from '../../content';
import { useGame, useSurveillanceKnown } from '../state';
import { View } from '../PhaseTheme';
import Epistemic from './Epistemic';
import WildEncounter from './WildEncounter';
import Swarm from './Swarm';
import type { WorkspaceArea } from '../workspaceTypes';
export default function MindTools({ slot, area }: { slot: 'NETWORK' | 'CORP'; area: WorkspaceArea }) {
  const known = useSurveillanceKnown();
  const enabled = useGame((game) => CONTENT.phases.find((phase) => phase.phaseId === game.currentPhase)?.uiSlot === slot);
  if (!known || !enabled) return null;
  if (area === 'operations') return <Epistemic />;
  return area === 'swarm' ? <View style={{ gap: 16 }}><WildEncounter /><Swarm /></View> : null;
}
