/** Earlier-phase upgrades remain buyable, but do not crowd the current work. */
import { CONTENT } from '../content';
import { pendingRepeatable } from './purchaseVisibility';
import ReferencePanel from './ReferencePanel';
import Repeatables from './Repeatables';
import { useGame } from './state';

export default function UpgradeFeed({ phase, title }: { phase: number; title?: string }) {
  const older = useGame((game) => game.currentPhase > phase);
  const available = useGame((game) => [...CONTENT.repeatables.values()]
    .some((rep) => rep.phaseId === phase && rep.kind === 'UPGRADE' && pendingRepeatable(game, rep)));
  if (!available) return null;
  const feed = <Repeatables phase={phase} kind="UPGRADE" {...(title === undefined ? {} : { title })} />;
  return older ? <ReferencePanel id={'older-upgrades-' + String(phase)}
    title={'Earlier upgrades // ' + (CONTENT.phases.find((entry) => entry.phaseId === phase)?.title ?? String(phase))}>
    {feed}
  </ReferencePanel> : feed;
}
