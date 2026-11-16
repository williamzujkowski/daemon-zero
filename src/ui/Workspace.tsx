/** Workspace navigation and pending signals precede content; mobile scrolls them in one flow. */
import { useState } from 'react';
import { CONTENT } from '../content';
import { wildEncounterView } from '../engine';
import { Pressable, Text, View } from './PhaseTheme';
import { workspaceAreas } from './registry/widgetRegistry';
import { useGame, useSurveillanceKnown } from './state';
import { areaTitles, type WorkspaceArea } from './workspaceTypes';
import { theme } from './theme';

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
    <View testID={'workspace-' + slot} role="tablist" aria-label={slot.toLowerCase() + ' workspace areas'} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {areas.map((area) => <Pressable key={area} testID={'workspace-' + slot + '-' + area} accessibilityRole="tab"
        accessibilityLabel={areaTitles[area] + ' in ' + slot} aria-selected={area === active}
        accessibilityState={{ selected: area === active }} style={[theme.button, { paddingHorizontal: 8 }, area !== active && theme.disabled]}
        onPress={() => { select(area); }}><Text style={theme.muted}>{areaTitles[area]}</Text></Pressable>)}
    </View>
    {tools && signal !== null && active !== 'swarm' && <Pressable testID="wild-signal-notice" accessibilityRole="button"
      accessibilityLabel={'SIGNAL PENDING // ' + signal + ' [ REVIEW ] - review this wild signal'} style={theme.button} onPress={() => { select('swarm'); }}>
      {/* It wrapped to two lines at 360 and cost 66px; one line gives 22px back to the
          purchase below it. Only the signal name truncates - [ REVIEW ] is its own element so
          the affordance can never be ellipsed away, and the full label is still the visible
          text of the control, which axe's label-content-name-mismatch requires (CI caught a
          shortened prefix failing it; this keeps the prefix).
          [ REVIEW ] must not shrink (#162): react-native-web lets every Text give way, so the
          two shared the shortfall in proportion to their widths and the affordance broke onto
          three lines at 360 - an 88px notice where the one-line design promised 44. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <Text numberOfLines={1} ellipsizeMode="tail" style={[theme.text, { flexShrink: 1 }]}>SIGNAL PENDING // {signal}</Text>
        <Text testID="wild-signal-review" style={[theme.text, { flexShrink: 0 }]}>[ REVIEW ]</Text>
      </View>
    </Pressable>}
  </View>;
}
