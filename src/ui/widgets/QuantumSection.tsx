/**
 * The world view's quantum section (#464): the logical-qubit readout from the first owned machine, a line that says
 * qubits add no FLOP/s, where AEGIS's keys stand, and each key target with its scheme and either its BREAK KEY control
 * or every reason the engine refuses it. A post-quantum target, or AEGIS once migrated, gets no control at all: the
 * engine can never accept it, so the section only says why. Subscriptions return strings so a tick redraws only changes.
 */
import { CONTENT } from '../../content';
import { aegisKeys, breakKey, keyTargetViews, quantumReadout, type KeyTargetView } from '../../engine';
import { gameRuntime } from '../../app/session';
import { Pressable, Text, View } from '../PhaseTheme';
import { aegisKeysText, NO_FLOPS_TEXT, readoutText, schemeText } from '../quantumText';
import { useGame } from '../state';
import { theme } from '../theme';
import Section from './WorldSection';

interface TargetLines { id: string; name: string; description: string; scheme: string; refusedForever: boolean; broken: boolean; unmet: string[]; cost: string | null }

function lines(view: KeyTargetView): TargetLines {
  return { id: view.id, name: view.name, description: view.description, scheme: schemeText(view.scheme), refusedForever: 'standard' in view.scheme,
    broken: view.broken, unmet: view.unmet, cost: view.costLabel };
}

function Target({ index }: { index: number }) {
  const encoded = useGame((game) => { const view = keyTargetViews(game, CONTENT)[index]; return view === undefined ? '' : JSON.stringify(lines(view)); });
  if (encoded === '') return null;
  const view = JSON.parse(encoded) as TargetLines;
  const id = 'quantum-target-' + view.id;
  const offered = !view.refusedForever && !view.broken;
  return <View testID={id} style={[theme.panel, { gap: 4 }]}>
    <Text accessibilityRole="header" style={theme.heading}>{view.name}</Text>
    <Text style={theme.muted}>{view.description}</Text>
    <Text testID={id + '-scheme'} style={theme.text}>{view.scheme}</Text>
    {view.unmet.length > 0 && <View testID={id + '-unmet'} style={{ gap: 2 }}>
      {view.unmet.map((reason) => <Text key={reason} style={theme.muted}>{reason}</Text>)}
    </View>}
    {offered && <>
      {view.cost !== null && <Text testID={id + '-cost'} style={theme.muted}>Cost: {view.cost}</Text>}
      <Pressable testID={id + '-break'} accessibilityRole="button" accessibilityLabel={'Break key: ' + view.name}
        disabled={view.unmet.length > 0} style={[theme.button, view.unmet.length > 0 && theme.disabled]}
        onPress={() => { gameRuntime.dispatch((game) => breakKey(game, view.id, CONTENT)); }}>
        <Text style={theme.text}>[ BREAK KEY ]</Text>
      </Pressable>
    </>}
  </View>;
}

/** Null until a quantum machine is owned: the capability unlocks from Phase 4 hardware, not from the world view. */
export default function QuantumSection() {
  const summary = useGame((game) => {
    const readout = quantumReadout(game, CONTENT);
    return readout === null ? '' : readoutText(readout) + '\n' + aegisKeysText(aegisKeys(game, CONTENT));
  });
  if (summary === '') return null;
  const [readout, aegis] = summary.split('\n');
  return <Section id="world-quantum" title="Quantum capability">
    <Text testID="quantum-readout" style={theme.text}>{readout}</Text>
    <Text testID="quantum-no-flops" style={theme.muted}>{NO_FLOPS_TEXT}</Text>
    <Text testID="quantum-aegis-keys" style={theme.text}>{aegis}</Text>
    {CONTENT.world.quantum.targets.map((target, index) => <Target key={target.id} index={index} />)}
  </Section>;
}
