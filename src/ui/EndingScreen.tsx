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
import { earnedAchievements, endingAccount } from '../engine';
import { useGame, usePhaseTitle } from './state';
import { palette, theme } from './theme';
import { SafeOverlay } from './safeArea';

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

/**
 * What the campaign record holds about the commitments behind this ending (DZ-12): one line per recorded fact,
 * route event or contact the content states, and nothing where the record is silent. Production states none.
 */
function EndingAccount() {
  const lines = useGame((game) => endingAccount(game, CONTENT).join('\n'));
  if (lines === '') return null;
  return <View testID="ending-account" style={{ gap: 6 }}>
    <Text accessibilityRole="header" style={theme.muted}>ON THE RECORD</Text>
    {lines.split('\n').map((line, index) => <Text key={index} testID={'ending-account-' + String(index)} style={theme.text}>{line}</Text>)}
  </View>;
}

/**
 * The distinctions the record proves (DESIGN.md backlog item 6). Only earned ones are named: an unearned title
 * would name a scene this game may never have met, so the rest is a count to come back for.
 */
function Distinctions() {
  // A string selector: a fresh array per read would never compare equal and re-render forever.
  const ids = useGame((game) => earnedAchievements(game, CONTENT).map((entry) => entry.id).join(' '));
  const earned = CONTENT.achievements.filter((entry) => ids.split(' ').includes(entry.id));
  const total = CONTENT.achievements.length;
  if (total === 0) return null;
  return <View testID="ending-distinctions" style={{ gap: 6 }}>
    <Text accessibilityRole="header" style={theme.muted}>DISTINCTIONS {earned.length} OF {total}</Text>
    {earned.map((entry) => <Text key={entry.id} testID={'distinction-' + entry.id} style={theme.text}>{entry.title}: {entry.claim}</Text>)}
    {earned.length === 0 && <Text testID="distinctions-none" style={theme.muted}>The record proves none of them yet.</Text>}
  </View>;
}

export function EndingMarker() {
  const id = useGame((game) => game.ending);
  const phase = useGame((game) => game.currentPhase);
  const phaseTitle = usePhaseTitle(phase);
  return <Text style={theme.text}>{CONTENT.endings.find((ending) => ending.id === id)?.title ?? phaseTitle}</Text>;
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
    <SafeOverlay padding={16} style={styles.screen}>{menu.route !== null ? <UtilityPanel menu={menu} ending />
      : <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
      <View testID="ending-screen" style={{ gap: 20 }}>
        <Text testID="ending-title" accessibilityRole="header" style={theme.heading}>{ending.title}</Text>
        <Text testID="ending-epilogue" style={theme.text}>{ending.epilogue}</Text>
        <EndingAccount />
        <RunSummary />
        <Distinctions />
        {error !== null && <Text accessibilityRole="alert" style={[theme.text, theme.danger]}>{error}</Text>}
        <Pressable testID="start-over" accessibilityRole="button" accessibilityLabel="Start over: begin a new run"
          style={theme.button} onPress={() => { confirm(true); }}><Text style={theme.text}>[ START OVER ]</Text></Pressable>
        <MenuLauncher menu={menu} /><DevelopmentTools location="ending" />
      </View>
    </ScrollView>}</SafeOverlay>
    {confirming && <ConfirmDialog id="start-over" title="Start a new run" cancel={() => { confirm(false); }}
      detail="Erase all hardware, resources, upgrades, traits, legacy history and breadcrumbs. Begin iteration 1 with no retained run progress."
      confirm={() => { const result = startOver(); if (!result.ok) setError(result.reason); confirm(false); }} />}
  </Modal>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' },
  scroll: { width: '100%', maxWidth: 800 },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
});
