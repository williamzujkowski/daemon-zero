/** The event feed stays available; players trade log depth for workspace height. */
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import KernelLog from './KernelLog';
import { View } from './PhaseTheme';
import { useGame } from './state';

export default function LogDock({ mobile = false, fill = false }: { mobile?: boolean; fill?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { height: viewportHeight } = useWindowDimensions();
  const discovered = useGame((game) => game.unlockedNodes.length > 0);
  const desired = expanded ? mobile ? 280 : 400 : mobile ? 120 : 180;
  const height = mobile ? Math.min(desired, viewportHeight * (expanded ? 0.45 : 0.25)) : desired;
  return <View testID="kernel-dock" style={fill ? { flex: 1, minHeight: 0 } : { height }}>
    <KernelLog {...(discovered && !fill ? { expanded, toggle: () => { setExpanded(!expanded); } } : {})} />
  </View>;
}
