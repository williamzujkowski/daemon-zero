/** One primary mobile scroll keeps growing chrome from squeezing purchases away.
 * History opens separately so its virtualized list never nests in this scroll.
 */
import { useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { View } from './PhaseTheme';
import Pane from './TerminalPane';

export default function MobileTerminal({ active, navigation, children }: {
  active: string; navigation: ReactNode; children: ReactNode;
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [active]);
  return <View testID="terminal-mobile" style={{ flex: 1, minHeight: 0 }}>
    <ScrollView ref={scroll} testID="terminal-primary-scroll" style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      {children}<Pane slots={[active]} flow />
    </ScrollView>
    {navigation}
  </View>;
}
