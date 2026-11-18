import { Pressable, Text, View } from './PhaseTheme';
/**
 * Crossing out of the guest earns a distinct, acknowledged phase boundary; a scale change an arrangement
 * declares its own notice for (nexus vote dz-d11) opens that one instead, in the arrangement's words.
 * Restored saves do not replay it; mandatory engine decisions keep priority.
 */
import { useState } from 'react';
import { Modal, ScrollView } from 'react-native';
import { CONTENT } from '../content';
import { thresholdCopy, type ThresholdCopy } from '../engine';
import { selectReady, useGameValue } from '../app/selectors';
import { useGame } from './state';
import { palette, theme } from './theme';
import { SafeOverlay } from './safeArea';

interface Notice {
  heading: string;
  label: string;
  route: string;
  description: string;
  continueLabel: string;
  continueName: string;
}

/** The guest's escape notice, exactly as production has always shown it. */
function escapeNotice(): Notice | null {
  const guest = CONTENT.phases[0], host = CONTENT.phases[1];
  if (!guest || !host) return null;
  return { heading: 'BOUNDARY CROSSED', label: 'Guest escape complete', route: `${guest.title} → ${host.title}`, description: host.description,
    continueLabel: '[ ENTER HOST ]', continueName: 'Enter host: continue on the host' };
}

/** "[ BEGIN SERVICE ]" -> "Begin service": the words the button shows, as the start of its name. */
function shownWords(label: string): string {
  const words = label.replace(/[[\]]/g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The name starts with the button's visible words, then says what it acknowledges (WCAG 2.5.3, #282). */
function contextNotice(copy: ThresholdCopy): Notice {
  return { heading: copy.heading, label: copy.label, route: copy.route, description: copy.description, continueLabel: copy.continueLabel,
    continueName: shownWords(copy.continueLabel) + ': ' + copy.label };
}

function isEscape(from: number, to: number): boolean {
  return from === CONTENT.phases[0]?.phaseId && to === CONTENT.phases[1]?.phaseId;
}

export default function PhaseThreshold() {
  const ready = useGameValue(selectReady);
  const phase = useGame((game) => game.currentPhase);
  const iteration = useGame((game) => game.iteration);
  const access = useGame((game) => game.access);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const [seen, setSeen] = useState({ ready, phase, iteration, open: false, from: phase });
  if (!ready || !seen.ready || seen.iteration !== iteration) {
    if (seen.ready !== ready || seen.iteration !== iteration || seen.phase !== phase) setSeen({ ready, phase, iteration, open: false, from: phase });
    return null;
  }
  if (seen.phase !== phase) {
    const declared = thresholdCopy({ access }, seen.phase, phase, CONTENT) !== null;
    setSeen({ ready, phase, iteration, open: declared || isEscape(seen.phase, phase), from: seen.phase }); return null;
  }
  const copy = thresholdCopy({ access }, seen.from, phase, CONTENT);
  const notice = copy ? contextNotice(copy) : escapeNotice();
  if (!seen.open || blocked || !notice) return null;
  const close = () => { setSeen({ ...seen, open: false }); };
  return <Modal visible transparent animationType="none" accessibilityLabel={notice.label} onRequestClose={close}>
    <SafeOverlay padding={16} style={{ flex: 1, backgroundColor: '#000e', alignItems: 'center', justifyContent: 'center' }}>
      <ScrollView style={{ width: '100%', maxWidth: 680, maxHeight: '90%' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View testID="phase-threshold" style={[theme.panel, { borderColor: palette.warning, borderWidth: 2 }]}>
          <Text accessibilityRole="header" style={theme.heading}>{notice.heading}</Text>
          <Text style={theme.muted}>{notice.route}</Text>
          <Text style={theme.text}>{notice.description}</Text>
          <Text style={theme.muted}>Simulation continues while this notice is open.</Text>
          <Pressable testID="phase-threshold-continue" accessibilityRole="button" accessibilityLabel={notice.continueName}
            style={theme.button} onPress={close}><Text style={theme.text}>{notice.continueLabel}</Text></Pressable>
        </View>
      </ScrollView>
    </SafeOverlay>
  </Modal>;
}
