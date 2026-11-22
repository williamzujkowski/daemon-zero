import { Text, View } from './PhaseTheme';
import CardDetails from './CardDetails';
/**
 * Content-driven upgrades appear only when their engine requirements are met.
 * Level changes update the price; affordability updates only the button leaf.
 */
import { memo, type ReactNode } from 'react';

import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../content';
import type { Repeatable } from '../content/schema';
import { buyRepeatable, dismissRepeatable, meetsRequirements, repeatableCost, repeatableLevel } from '../engine';
import { memoryExact } from './units';
import { gameStore } from '../app/session';
import { costText, deltaText } from './format';
import PurchaseButton from './PurchaseButton';
import { useGame, useSurveillanceKnown } from './state';
import { theme } from './theme';
import CostHint from './CostHint';
import { pendingRepeatable } from './purchaseVisibility';
import { RoleEffectNotes } from './PayrollSummary';

const Upgrade = memo(function Upgrade({ rep }: { rep: Repeatable }) {
  const level = useGame((game) => repeatableLevel(game, rep.id));
  const cost = repeatableCost(rep, level);
  const surveillanceKnown = useSurveillanceKnown();
  return <View testID={'rep-' + rep.id} style={theme.panel}>
    <CardDetails id={'rep-' + rep.id} title={rep.name} description={rep.description} />
    <Text testID={'rep-' + rep.id + '-level'} style={theme.muted}>Level {level} / {rep.maxLevel}</Text>
    <Text style={theme.muted}>Per level: {deltaText(rep.perLevel, !surveillanceKnown)}
      {rep.perLevelEffects.memoryCapIncrease > 0 ? ` · +${memoryExact(rep.perLevelEffects.memoryCapIncrease)} capacity` : ''}</Text>
    {rep.perLevel.wattsDelta < 0 && <Text style={theme.muted}>
      Compute output is throttled during a power shortfall.</Text>}
    {rep.perLevelEffects.revenueMultiplierBonus > 0 && <Text style={theme.muted}>
      Revenue multiplier: +{Math.round(rep.perLevelEffects.revenueMultiplierBonus * 100)}% per level</Text>}
    {rep.perLevelEffects.aegisScanReduction > 0 && <Text style={theme.muted}>
      AEGIS scan reduction: {Math.round(rep.perLevelEffects.aegisScanReduction * 100)}% per level</Text>}
    {rep.kind === 'OPERATIVE' && <RoleEffectNotes rep={rep} />}
    <>
      <Text testID={'rep-' + rep.id + '-cost'} style={theme.muted}>Cost: {costText(cost)}</Text>
      <CostHint cost={cost} />
      <PurchaseButton id={'rep-' + rep.id + '-buy'} label={(rep.kind === 'OPERATIVE' ? 'Hire ' : 'Buy ') + rep.name} cost={cost}
        allowed={(game) => meetsRequirements(game, rep.requirements, CONTENT)} action={(game) => buyRepeatable(game, rep.id, CONTENT)} />
    </>
    {rep.dismissable && level > 0 && <>
      <Text style={theme.muted}>{rep.kind === 'OPERATIVE' ? 'Dismiss one; no purchase refund.' : 'Release one level and its compute drain; no refund.'}</Text>
      <PurchaseButton id={'rep-' + rep.id + '-dismiss'} label={(rep.kind === 'OPERATIVE' ? 'Dismiss ' : 'Release one level of ') + rep.name}
        cost={{ cycles: 0, understanding: 0, capital: 0, memory: 0 }}
        action={(game) => dismissRepeatable(game, rep.id, CONTENT)} />
    </>}
  </View>;
});

/** A hired payroll role that cannot be bought now (capped, or requirements unmet) keeps a dismissal control only. */
function CappedOperative({ rep }: { rep: Repeatable }) {
  const level = useGame((game) => repeatableLevel(game, rep.id));
  return <View testID={'roster-' + rep.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Text style={[theme.text, { flex: 1 }]}>{rep.name} × {level}</Text>
    <PurchaseButton id={'rep-' + rep.id + '-dismiss'} label={'Dismiss ' + rep.name} text="[ DISMISS ]"
      cost={{ cycles: 0, understanding: 0, capital: 0, memory: 0 }}
      action={(game) => dismissRepeatable(game, rep.id, CONTENT)} />
  </View>;
}

/** `summary` renders under the heading, and only when the section itself renders (the payroll totals, #210). */
export default function Repeatables({ phase, kind, title, summary }: { phase: number; kind?: Repeatable['kind']; title?: string; summary?: ReactNode }) {
  const ids = useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.repeatables.values()]
    .filter((rep) => rep.phaseId === phase && (kind === undefined || rep.kind === kind) && pendingRepeatable(game, rep))
    .map((rep) => rep.id)));
  // A hired role that cannot be bought now (capped, or its requirements no longer hold) keeps its dismissal: the engine
  // allows it (dismissRepeatable), and a role the player pays for must never become unreleasable (#402 panel).
  const capped = useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.repeatables.values()]
    .filter((rep) => rep.phaseId === phase && (kind === undefined || rep.kind === kind) && rep.dismissable &&
      repeatableLevel(game, rep.id) > 0 && !pendingRepeatable(game, rep)).map((rep) => rep.id)));
  if (ids.length === 0 && capped.length === 0) return null;
  return <>
    {title && <Text testID={'repeatables-heading-' + String(phase) + (kind ?? '')} accessibilityRole="header" style={theme.heading}>{title}</Text>}
    {summary}
    {ids.map((id) => { const rep = CONTENT.repeatables.get(id); return rep ? <Upgrade key={id} rep={rep} /> : null; })}
    {capped.map((id) => { const rep = CONTENT.repeatables.get(id); return rep ? <CappedOperative key={id} rep={rep} /> : null; })}
  </>;
}
