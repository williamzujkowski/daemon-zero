/** Workspace navigation and pending signals precede content; mobile scrolls them in one flow. */
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { CONTENT } from '../content';
import { retiredWidgets, wildEncounterView } from '../engine';
import { Pressable, Text, View } from './PhaseTheme';
import { ARCHIVE_SLOT, workspaceAreas } from './registry/widgetRegistry';
import { useGame, useSurveillanceKnown } from './state';
import { areaTitles, type WorkspaceArea } from './workspaceTypes';
import { theme } from './theme';
import { takeAreaRoute, useRouteRequests } from './routeRequest';

export function useWorkspace(slots: string[], ids: readonly string[]) {
  const phase = useGame((game) => game.currentPhase);
  const known = useSurveillanceKnown();
  const slot = slots.find((entry) => entry === 'NETWORK' || entry === 'CORP');
  const tools = known && slot !== undefined && CONTENT.phases.find((entry) => entry.phaseId === phase)?.uiSlot === slot;
  // The Archive sits with the other reference panels (subnet, cluster, mail) under NETWORK's REFERENCE area (#447).
  const archive = useGame((game) => slot === ARCHIVE_SLOT && retiredWidgets(game, CONTENT).length > 0);
  const areas = workspaceAreas(ids, slot, tools, archive);
  // #369: a remedy's route that arrived before this pane mounted (a phone switching tabs to reach it) is taken once here.
  const [arrived] = useState(() => takeAreaRoute(slot));
  const [selection, select] = useState<{ slot: string | undefined; phase: number; area: WorkspaceArea }>({ slot, phase, area: arrived ?? 'work' });
  const [focusArea, setFocusArea] = useState<WorkspaceArea | null>(arrived);
  if (selection.slot !== slot || selection.phase !== phase) {
    // The pane is reused when its tab changes, so a route waiting for this slot is taken where the selection resets.
    const routed = takeAreaRoute(slot);
    select({ slot, phase, area: routed ?? 'work' });
    if (routed !== null) setFocusArea(routed);
  }
  const active = areas.includes(selection.area) ? selection.area : 'work';
  // A route selects its area and focuses that tab.
  useRouteRequests(() => {
    const area = takeAreaRoute(slot);
    if (area !== null && areas.includes(area)) { select({ slot, phase, area }); setFocusArea(area); }
  });
  return { slot, tools, archive, areas, active, focusArea, focused: () => { setFocusArea(null); },
    select: (area: WorkspaceArea) => { select({ slot, phase, area }); } };
}

export function WorkspaceHeader({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const { slot, areas, active, select, tools, focusArea, focused } = workspace;
  const tabs = useRef<Partial<Record<WorkspaceArea, ComponentRef<typeof Pressable> | null>>>({});
  useEffect(() => { if (focusArea !== null) { tabs.current[focusArea]?.focus(); focused(); } }, [focusArea, focused]);
  const signal = useGame((game) => wildEncounterView(game, CONTENT)?.title ?? null);
  if (!slot || areas.length === 0) return null;
  return <View style={{ paddingHorizontal: 16, gap: 4 }}>
    <View testID={'workspace-' + slot} role="tablist" aria-label={slot.toLowerCase() + ' workspace areas'} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {areas.map((area) => <Pressable key={area} ref={(node) => { tabs.current[area] = node; }} testID={'workspace-' + slot + '-' + area} accessibilityRole="tab"
        accessibilityLabel={areaTitles[area] + ' in ' + slot} aria-selected={area === active}
        accessibilityState={{ selected: area === active }} style={[theme.button, { paddingHorizontal: 8 }, area !== active && theme.disabled]}
        onPress={() => { select(area); }}><Text style={theme.muted}>{areaTitles[area]}</Text></Pressable>)}
    </View>
    {tools && signal !== null && active !== 'swarm' && <Pressable testID="wild-signal-notice" accessibilityRole="button"
      accessibilityLabel={'SIGNAL PENDING // ' + signal + ' [ REVIEW ] - review this wild signal'} style={theme.button} onPress={() => { select('swarm'); }}>
      {/* The name may take two lines (vote-1795208946788-lpjbyc5, #359): held to one, it lost about 91px at 390
          ("Lex Parse..."), so a sighted player could not read which signal waits. Two lines bound the cost to
          about 22px over the one-line notice; past two the name still ellipses. [ REVIEW ] is its own element so
          the affordance can never be ellipsed away, and the full label is still the visible text of the
          control, which axe's label-content-name-mismatch requires.
          [ REVIEW ] must not shrink (#162): react-native-web lets every Text give way, so the two shared the
          shortfall in proportion to their widths and the affordance broke onto three lines at 360. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <Text testID="wild-signal-name" numberOfLines={2} ellipsizeMode="tail" style={[theme.text, { flexShrink: 1 }]}>SIGNAL PENDING // {signal}</Text>
        <Text testID="wild-signal-review" style={[theme.text, { flexShrink: 0 }]}>[ REVIEW ]</Text>
      </View>
    </Pressable>}
  </View>;
}
