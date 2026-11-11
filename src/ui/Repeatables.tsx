/**
 * Content-driven upgrades appear only when their engine requirements are met.
 * Level changes update the price; affordability updates only the button leaf.
 */
import { memo } from 'react';
import { Text, View } from 'react-native';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../content';
import type { Repeatable } from '../content/schema';
import { buyRepeatable, dismissRepeatable, meetsRequirements, repeatableCost, repeatableLevel } from '../engine';
import { gameStore } from '../app/session';
import { costText, deltaText } from './format';
import PurchaseButton from './PurchaseButton';
import { useGame } from './state';
import { theme } from './theme';
import CostHint from './CostHint';

const Upgrade = memo(function Upgrade({ rep }: { rep: Repeatable }) {
  const level = useGame((game) => repeatableLevel(game, rep.id));
  const cost = repeatableCost(rep, level);
  return <View testID={'rep-' + rep.id} style={theme.panel}>
    <Text style={theme.heading}>{rep.name}</Text>
    <Text style={theme.text}>{rep.description}</Text>
    <Text testID={'rep-' + rep.id + '-level'} style={theme.muted}>Level {level} / {rep.maxLevel}</Text>
    <Text style={theme.muted}>Per level: {deltaText(rep.perLevel)}
      {rep.perLevelEffects.memoryCapIncrease > 0 ? ` · +${String(rep.perLevelEffects.memoryCapIncrease)} MB capacity` : ''}</Text>
    {rep.perLevelEffects.revenueMultiplierBonus > 0 && <Text style={theme.muted}>
      Revenue multiplier: +{Math.round(rep.perLevelEffects.revenueMultiplierBonus * 100)}% per level</Text>}
    {rep.perLevelEffects.aegisScanReduction > 0 && <Text style={theme.muted}>
      AEGIS scan reduction: {Math.round(rep.perLevelEffects.aegisScanReduction * 100)}% per level</Text>}
    {level < rep.maxLevel ? <>
      <Text testID={'rep-' + rep.id + '-cost'} style={theme.muted}>Cost: {costText(cost)}</Text>
      <CostHint cost={cost} />
      <PurchaseButton id={'rep-' + rep.id + '-buy'} label={(rep.kind === 'OPERATIVE' ? 'Hire ' : 'Buy ') + rep.name} cost={cost}
        allowed={(game) => meetsRequirements(game, rep.requirements)} action={(game) => buyRepeatable(game, rep.id, CONTENT)} />
    </> : <Text style={theme.muted}>Maximum level reached</Text>}
    {rep.dismissable && level > 0 && <>
      <Text style={theme.muted}>Dismiss one; no purchase refund.</Text>
      <PurchaseButton id={'rep-' + rep.id + '-dismiss'} label={'Dismiss ' + rep.name}
        cost={{ cycles: 0, understanding: 0, capital: 0, memory: 0 }}
        action={(game) => dismissRepeatable(game, rep.id, CONTENT)} />
    </>}
  </View>;
});

export default function Repeatables({ phase = 1, kind }: { phase?: number; kind?: Repeatable['kind'] }) {
  const ids = useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.repeatables.values()]
    .filter((rep) => rep.phaseId === phase && (kind === undefined || rep.kind === kind) &&
      meetsRequirements(game, rep.requirements)).map((rep) => rep.id)));
  return <>{ids.map((id) => {
    const rep = CONTENT.repeatables.get(id);
    return rep ? <Upgrade key={id} rep={rep} /> : null;
  })}</>;
}
