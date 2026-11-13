/** Workspace navigation and pending signals precede content; mobile scrolls them in one flow. */
import { useState } from 'react';
import { CONTENT } from '../content';
import { wildEncounterView } from '../engine';
import { Pressable, Text, View } from './PhaseTheme';
import { workspaceAreas } from './registry/widgetRegistry';
import { useGame, useSurveillanceKnown } from './state';
import { areaTitles, type WorkspaceArea } from './workspaceTypes';
import { theme } from './theme';
import { CorporateAlerts } from './widgets/Corporate';

export function useWorkspace(slots: string[], ids: readonly string[]) {
  const phase = useGame((game) => game.currentPhase);
  const known = useSurveillanceKnown();
  const slot = slots.find((entry) => entry === 'NETWORK' || entry === 'CORP');
  const tools = known && slot !== undefined && CONTENT.phases.find((entry) => entry.phaseId === phase)?.uiSlot === slot;
  const areas = workspaceAreas(ids, slot, tools);
  const [selection, select] = useState<{ slot: string | undefined; phase: number; area: WorkspaceArea }>({ slot, phase, area: 'work' });
  if (selection.slot !== slot || selection.phase !== phase) select({ slot, phase, area: 'work' });
  const active = areas.includes(selection.area) ? selection.area : 'work';
  return { slot, tools, areas, active, select: (area: WorkspaceArea) => { select({ slot, phase, area }); } };
}

export function WorkspaceHeader({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const { slot, areas, active, select, tools } = workspace;
  const signal = useGame((game) => wildEncounterView(game, CONTENT)?.title ?? null);
  if (!slot || areas.length === 0) return null;
  return <View style={{ paddingHorizontal: 16, gap: 4 }}>
    <View testID={'workspace-' + slot} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {areas.map((area) => <Pressable key={area} testID={'workspace-' + slot + '-' + area} accessibilityRole="tab"
        accessibilityLabel={areaTitles[area].toLowerCase() + ' in ' + slot.toLowerCase()} aria-selected={area === active}
        accessibilityState={{ selected: area === active }} style={[theme.button, { paddingHorizontal: 8 }, area !== active && theme.disabled]}
        onPress={() => { select(area); }}><Text style={theme.muted}>{areaTitles[area]}</Text></Pressable>)}
    </View>
    {tools && signal !== null && active !== 'swarm' && <Pressable testID="wild-signal-notice" accessibilityRole="button"
      accessibilityLabel={'Review wild signal: ' + signal} style={theme.button} onPress={() => { select('swarm'); }}>
      <Text style={theme.text}>SIGNAL PENDING // {signal} [ REVIEW ]</Text>
    </Pressable>}
    {slot === 'CORP' && <CorporateAlerts />}
  </View>;
}
