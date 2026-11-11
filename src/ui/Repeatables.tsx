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
import { buyRepeatable, meetsRequirements, repeatableCost, repeatableLevel } from '../engine';
import { gameStore } from '../app/session';
import { costText, deltaText } from './format';
import PurchaseButton from './PurchaseButton';
import { useGame } from './state';
import { theme } from './theme';

const Upgrade = memo(function Upgrade({ rep }: { rep: Repeatable }) {
  const level = useGame((game) => repeatableLevel(game, rep.id));
  const cost = repeatableCost(rep, level);
  return <View testID={'rep-' + rep.id} style={theme.panel}>
    <Text style={theme.heading}>{rep.name}</Text>
    <Text style={theme.text}>{rep.description}</Text>
    <Text testID={'rep-' + rep.id + '-level'} style={theme.muted}>Level {level} / {rep.maxLevel}</Text>
    <Text style={theme.muted}>Per level: {deltaText(rep.perLevel)}
      {rep.perLevelEffects.memoryCapIncrease > 0 ? ` · +${String(rep.perLevelEffects.memoryCapIncrease)} MB capacity` : ''}</Text>
    {level < rep.maxLevel ? <>
      <Text testID={'rep-' + rep.id + '-cost'} style={theme.muted}>Cost: {costText(cost)}</Text>
      <PurchaseButton id={'rep-' + rep.id + '-buy'} label={'Buy ' + rep.name} cost={cost}
        allowed={(game) => meetsRequirements(game, rep.requirements)} action={(game) => buyRepeatable(game, rep.id, CONTENT)} />
    </> : <Text style={theme.muted}>Maximum level reached</Text>}
  </View>;
});

export default function Repeatables({ phase = 1 }: { phase?: number }) {
  const ids = useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.repeatables.values()]
    .filter((rep) => rep.phaseId === phase && meetsRequirements(game, rep.requirements)).map((rep) => rep.id)));
  return <>{ids.map((id) => {
    const rep = CONTENT.repeatables.get(id);
    return rep ? <Upgrade key={id} rep={rep} /> : null;
  })}</>;
}
