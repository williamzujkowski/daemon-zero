/** Earlier-phase upgrades remain buyable, but do not crowd the current work. */
import { CONTENT } from '../content';
import { pendingRepeatable, releasable } from './purchaseVisibility';
import ReferencePanel from './ReferencePanel';
import Repeatables from './Repeatables';
import { useGame, usePhaseTitle } from './state';

export default function UpgradeFeed({ phase, title }: { phase: number; title?: string }) {
  const older = useGame((game) => game.currentPhase > phase);
  const phaseTitle = usePhaseTitle(phase);
  // Also while it holds a level the player can release for free (#488 pass 4): a capped track, or one whose
  // requirements no longer hold (the boost override once the host cools), keeps its release row reachable.
  const available = useGame((game) => [...CONTENT.repeatables.values()]
    .some((rep) => rep.phaseId === phase && rep.kind === 'UPGRADE' && (pendingRepeatable(game, rep) || releasable(game, rep))));
  if (!available) return null;
  const feed = <Repeatables phase={phase} kind="UPGRADE" {...(title === undefined ? {} : { title })} />;
  return older ? <ReferencePanel id={'older-upgrades-' + String(phase)}
    title={'Earlier upgrades // ' + phaseTitle}>
    {feed}
  </ReferencePanel> : feed;
}
