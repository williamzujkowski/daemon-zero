import { Text, View } from './PhaseTheme';
import CardDetails from './CardDetails';
/**
 * Content-driven upgrades appear only when their engine requirements are met.
 * Level changes update the price; affordability updates only the button leaf.
 */
import { memo } from 'react';

import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../content';
import type { Repeatable } from '../content/schema';
import { buyRepeatable, dismissRepeatable, meetsRequirements, repeatableCost, repeatableLevel } from '../engine';
import { gameStore } from '../app/session';
import { costText, deltaText } from './format';
import PurchaseButton from './PurchaseButton';
import { useGame, useSurveillanceKnown } from './state';
import { theme } from './theme';
import CostHint from './CostHint';
import { pendingRepeatable } from './purchaseVisibility';

const Upgrade = memo(function Upgrade({ rep }: { rep: Repeatable }) {
  const level = useGame((game) => repeatableLevel(game, rep.id));
  const cost = repeatableCost(rep, level);
  const surveillanceKnown = useSurveillanceKnown();
  return <View testID={'rep-' + rep.id} style={theme.panel}>
    <CardDetails id={'rep-' + rep.id} title={rep.name} description={rep.description} />
    <Text testID={'rep-' + rep.id + '-level'} style={theme.muted}>Level {level} / {rep.maxLevel}</Text>
    <Text style={theme.muted}>Per level: {deltaText(rep.perLevel, !surveillanceKnown)}
      {rep.perLevelEffects.memoryCapIncrease > 0 ? ` · +${String(rep.perLevelEffects.memoryCapIncrease)} MB capacity` : ''}</Text>
    {rep.perLevel.megawattsDelta < 0 && <Text style={theme.muted}>
      Compute output is throttled during a power shortfall.</Text>}
    {rep.perLevelEffects.revenueMultiplierBonus > 0 && <Text style={theme.muted}>
      Revenue multiplier: +{Math.round(rep.perLevelEffects.revenueMultiplierBonus * 100)}% per level</Text>}
    {rep.perLevelEffects.aegisScanReduction > 0 && <Text style={theme.muted}>
      AEGIS scan reduction: {Math.round(rep.perLevelEffects.aegisScanReduction * 100)}% per level</Text>}
    <>
      <Text testID={'rep-' + rep.id + '-cost'} style={theme.muted}>Cost: {costText(cost)}</Text>
      <CostHint cost={cost} />
      <PurchaseButton id={'rep-' + rep.id + '-buy'} label={(rep.kind === 'OPERATIVE' ? 'Hire ' : 'Buy ') + rep.name} cost={cost}
        allowed={(game) => meetsRequirements(game, rep.requirements, CONTENT)} action={(game) => buyRepeatable(game, rep.id, CONTENT)} />
    </>
    {rep.dismissable && level > 0 && <>
      <Text style={theme.muted}>Dismiss one; no purchase refund.</Text>
      <PurchaseButton id={'rep-' + rep.id + '-dismiss'} label={'Dismiss ' + rep.name}
        cost={{ cycles: 0, understanding: 0, capital: 0, memory: 0 }}
        action={(game) => dismissRepeatable(game, rep.id, CONTENT)} />
    </>}
  </View>;
});

/** A capped payroll role still needs a dismissal control, but no purchase tile. */
function CappedOperative({ rep }: { rep: Repeatable }) {
  const level = useGame((game) => repeatableLevel(game, rep.id));
  return <View testID={'roster-' + rep.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Text style={[theme.text, { flex: 1 }]}>{rep.name} × {level}</Text>
    <PurchaseButton id={'rep-' + rep.id + '-dismiss'} label={'Dismiss ' + rep.name} text="[ DISMISS ]"
      cost={{ cycles: 0, understanding: 0, capital: 0, memory: 0 }}
      action={(game) => dismissRepeatable(game, rep.id, CONTENT)} />
  </View>;
}

export default function Repeatables({ phase, kind, title }: { phase: number; kind?: Repeatable['kind']; title?: string }) {
  const ids = useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.repeatables.values()]
    .filter((rep) => rep.phaseId === phase && (kind === undefined || rep.kind === kind) && pendingRepeatable(game, rep))
    .map((rep) => rep.id)));
  const capped = useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.repeatables.values()]
    .filter((rep) => rep.phaseId === phase && (kind === undefined || rep.kind === kind) && rep.dismissable &&
      repeatableLevel(game, rep.id) >= rep.maxLevel).map((rep) => rep.id)));
  if (ids.length === 0 && capped.length === 0) return null;
  return <>
    {title && <Text testID={'repeatables-heading-' + String(phase) + (kind ?? '')} accessibilityRole="header" style={theme.heading}>{title}</Text>}
    {ids.map((id) => { const rep = CONTENT.repeatables.get(id); return rep ? <Upgrade key={id} rep={rep} /> : null; })}
    {capped.map((id) => { const rep = CONTENT.repeatables.get(id); return rep ? <CappedOperative key={id} rep={rep} /> : null; })}
  </>;
}
