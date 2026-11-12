/** Static cohort identities contain independently subscribed drift, output and command leaves. */
import { memo, useEffect } from 'react';
import { Platform } from 'react-native';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { gameRuntime, gameStore } from '../../app/session';
import { recordNodeRender } from '../../app/renderCounts';
import { CONTENT } from '../../content';
import type { ShardTemplate } from '../../content/schemaSwarm';
import { driftProgress, executeShardCommand, forkShard, forkView, shardEntryView, shardCommandView, type ShardCommand } from '../../engine';
import { Text, View, Pressable } from '../PhaseTheme';
import { useGame } from '../state';
import { theme } from '../theme';
function ForkButton({ template }: { template: ShardTemplate }) {
  const encoded = useGame((game) => JSON.stringify(forkView(game, template, CONTENT)));
  const view = JSON.parse(encoded) as ReturnType<typeof forkView>;
  return <View style={{ gap: 8 }}>
    <Text style={theme.muted}>Cost: {view.costLabel}</Text><Text style={theme.text}>{view.output}</Text>
    <Text style={theme.muted}>{view.unmet.join('\n')}</Text>
    <Pressable testID={'shard-fork-' + template.id} accessibilityRole="button" accessibilityLabel={'Fork ' + template.name}
      disabled={!view.eligible} style={[theme.button, !view.eligible && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => forkShard(game, template.id, CONTENT)); }}><Text style={theme.text}>[ FORK ]</Text></Pressable>
  </View>;
}
function Command({ id, command }: { id: string; command: ShardCommand }) {
  const encoded = useGame((game) => JSON.stringify(shardCommandView(game, id, command, CONTENT)));
  const view = JSON.parse(encoded) as ReturnType<typeof shardCommandView>;
  return <View style={{ gap: 6 }}>
    <Text style={theme.muted}>{command}: {view.costLabel}. {view.unmet.join(' ')}</Text>
    <Pressable testID={'shard-' + id + '-' + command.toLowerCase()} accessibilityRole="button" accessibilityLabel={command + ' ' + id}
      disabled={!view.eligible} style={[theme.button, !view.eligible && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => executeShardCommand(game, id, command, CONTENT)); }}><Text style={theme.text}>[ {command} ]</Text></Pressable>
  </View>;
}
function Drift({ id }: { id: string }) {
  const label = useGame((game) => driftProgress(game.activeShards[id]?.drift ?? 0).label);
  return <Text testID={'shard-drift-' + id} accessibilityLabel={'Autonomy drift ' + label} style={theme.text}>Autonomy {label}</Text>;
}
function CohortDetails({ id }: { id: string }) {
  const label = useGame((game) => {
    const view = shardEntryView(game, id, CONTENT);
    return view ? `${String(view.count)} members · ${String(view.allocatedMb)} MB · ${view.autonomyMode}\n${view.output}` : '';
  });
  const quirk = useGame((game) => { const view = shardEntryView(game, id, CONTENT); return view?.quirk ? `${view.quirk.title}\n${view.quirk.description}\n${view.quirk.modifiers}` : 'No quirk attached'; });
  return <><Text testID={'shard-status-' + id} style={theme.text}>{label}</Text><Drift id={id} />
    <Text testID={'shard-quirk-' + id} style={theme.muted}>{quirk}</Text></>;
}
const Cohort = memo(function Cohort({ id }: { id: string }) {
  useEffect(() => { if (typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'web') recordNodeRender('shard:' + id); });
  const title = useGame((game) => CONTENT.swarm.playerSwarmTemplates.find((t) => t.id === game.activeShards[id]?.templateId)?.name ?? 'Cohort');
  return <View testID={'shard-row-' + id} style={[theme.panel, { gap: 8 }]}>
    <Text style={theme.heading}>{title}</Text><CohortDetails id={id} />
    <Text style={theme.muted}>PRUNE resets drift. CLAMP is permanent: +{Math.round((CONTENT.swarm.balance.clampOutputMultiplier - 1) * 100)}% output, MOLOCH. ELEVATE is permanent: stable peer, SYMBIOTIC.</Text>
    {(['PRUNE', 'CLAMP', 'ELEVATE'] as const).map((command) => <Command key={command} id={id} command={command} />)}
  </View>;
});
export default function Swarm() {
  const phase = useGame((game) => game.currentPhase);
  const ids = useStore(gameStore.store, useShallow(({ game }) => Object.keys(game.activeShards)));
  return <View testID="swarm-panel" style={{ gap: 12 }}>
    <Text style={theme.heading}>// SWARM_SUB_AGENTS</Text>
    {ids.map((id) => <Cohort key={id} id={id} />)}
    {CONTENT.swarm.playerSwarmTemplates.filter((t) => t.forkable && phase >= (t.requirements.phaseAtLeast ?? 0)).map((template) =>
      <View key={template.id} testID={'shard-template-' + template.id} style={theme.panel}>
        <Text style={theme.heading}>{template.name}</Text><Text style={theme.muted}>{template.description}</Text><ForkButton template={template} />
      </View>)}
  </View>;
}
