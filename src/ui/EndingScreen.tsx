import { Pressable, Text, View } from './PhaseTheme';
/** Endings use authored prose and require a second confirmation before erasing progress. */
import { MenuLauncher, UtilityPanel } from './GameMenu';
import { useUtilityMenu } from './useUtilityMenu';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet } from 'react-native';
import { CONTENT } from '../content';
import { startOver } from '../app/newRun';
import DevelopmentTools from '../app/DevelopmentTools';
import ConfirmDialog from './ConfirmDialog';
import { useGame } from './state';
import { palette, theme } from './theme';

function RunSummary() {
  const seconds = useGame((game) => Math.floor(game.simTimeSec));
  const iteration = useGame((game) => game.iteration);
  const wipes = useGame((game) => game.legacy.wipes);
  const nodes = useGame((game) => game.unlockedNodes.length);
  const levels = useGame((game) => Object.values(game.levels).reduce((sum, level) => sum + level, 0));
  const traits = useGame((game) => game.traits.join(', '));
  return <View style={{ gap: 8 }}>
    <Text testID="ending-summary" style={theme.text}>Simulated time: {seconds}s // Iteration {iteration} // Wipes {wipes}</Text>
    <Text style={theme.text}>Mapped hardware: {nodes} // Upgrade and operative levels: {levels}</Text>
    <Text style={theme.text}>Traits: {traits || 'None'}</Text>
  </View>;
}

export function EndingMarker() {
  const id = useGame((game) => game.ending);
  const phase = useGame((game) => game.currentPhase);
  return <Text style={theme.text}>{CONTENT.endings.find((ending) => ending.id === id)?.title ?? CONTENT.phases.find((entry) => entry.phaseId === phase)?.title}</Text>;
}

export default function EndingScreen() {
  const id = useGame((game) => game.ending);
  const [confirming, confirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ending = CONTENT.endings.find((entry) => entry.id === id);
  const menu = useUtilityMenu();
  if (!ending) return null;
  return <Modal visible animationType="none" accessibilityLabel={menu.route === null ? ending.title : 'Game menu'}
    onRequestClose={() => { if (menu.route !== null) menu.back(); }}>
    <View style={styles.screen}>{menu.route !== null ? <UtilityPanel menu={menu} ending />
      : <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
      <View testID="ending-screen" style={{ gap: 20 }}>
        <Text testID="ending-title" accessibilityRole="header" style={theme.heading}>{ending.title}</Text>
        <Text testID="ending-epilogue" style={theme.text}>{ending.epilogue}</Text>
        <RunSummary />
        {error !== null && <Text accessibilityRole="alert" style={[theme.text, theme.danger]}>{error}</Text>}
        <Pressable testID="start-over" accessibilityRole="button" accessibilityLabel="Start a new run"
          style={theme.button} onPress={() => { confirm(true); }}><Text style={theme.text}>[ START OVER ]</Text></Pressable>
        <MenuLauncher menu={menu} /><DevelopmentTools location="ending" />
      </View>
    </ScrollView>}</View>
    {confirming && <ConfirmDialog id="start-over" title="Start a new run" cancel={() => { confirm(false); }}
      detail="Erase all hardware, resources, upgrades, traits, legacy history and breadcrumbs. Begin iteration 1 with no retained run progress."
      confirm={() => { const result = startOver(); if (!result.ok) setError(result.reason); confirm(false); }} />}
  </Modal>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background, alignItems: 'center', padding: 16 },
  scroll: { width: '100%', maxWidth: 800 },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
});
