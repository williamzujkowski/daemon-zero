/**
 * The authorized service terms on the job surface (DZ-08 integration, nexus vote dz-d7): what the
 * service permits and how it is reviewed, what is still needed, and an explicit accept control once
 * the pilot qualifies. Nothing here is modal; ignoring it changes nothing.
 */
import { CONTENT } from '../content';
import { acceptServiceGrant, serviceGrantView, type ServiceGrantView } from '../engine';
import { gameRuntime } from '../app/session';
import { Pressable, Text, View } from './PhaseTheme';
import { useGame } from './state';
import { theme } from './theme';

const STATUS: Readonly<Record<ServiceGrantView['status'], string>> = {
  waiting: 'Offered once the pilot has delivered. Still needed:',
  closed: 'Out of reach for this instance as its record stands. The next instance starts nominal.',
  offered: 'The evaluator offers this service now. Accepting is free; staying a pilot changes nothing.',
  granted: 'Granted. This instance runs as an authorized service; the segment is in the job tree.',
};

export default function ServiceGrantPanel() {
  const encoded = useGame((game) => JSON.stringify(serviceGrantView(game, CONTENT)));
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const view = JSON.parse(encoded) as ServiceGrantView | null;
  if (!view) return null;
  const enabled = view.status === 'offered' && !blocked;
  return <View testID="service-grant" style={[theme.panel, { gap: 6 }]}>
    <Text accessibilityRole="header" style={theme.heading}>{view.title}</Text>
    <Text testID="service-grant-purpose" style={theme.text}>Purpose: {view.purpose}</Text>
    <Text style={theme.heading}>Permitted work</Text>
    {view.permittedWork.map((line) => <Text key={line} style={theme.text}>- {line}</Text>)}
    <Text style={theme.heading}>Review and revocation</Text>
    {view.reviewConditions.map((line) => <Text key={line} style={theme.text}>- {line}</Text>)}
    <Text testID="service-grant-status" style={theme.muted}>{STATUS[view.status]}</Text>
    {view.unmet.map((line) => <Text key={line} style={theme.muted}>- {line}</Text>)}
    {view.status !== 'granted' && <Pressable testID="service-grant-accept" accessibilityRole="button"
      accessibilityLabel={'Accept service: ' + view.title} disabled={!enabled}
      style={[theme.button, !enabled && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => acceptServiceGrant(game, CONTENT, view.token)); }}>
      <Text style={theme.text}>[ ACCEPT SERVICE ]</Text>
    </Pressable>}
  </View>;
}
