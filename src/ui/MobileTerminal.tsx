/** One primary mobile scroll keeps growing chrome from squeezing purchases away.
 * History opens separately so its virtualized list never nests in this scroll.
 *
 * The chrome arrives in three pieces rather than one block so the run-ending alert band
 * can be a DIRECT child of this scroll, which is what makes it stick: position:sticky is
 * bounded by its containing block, so a band nested inside the chrome left the viewport
 * as soon as that ~300px block scrolled past (measured at 360x640). stickyHeaderIndices
 * is also the portable mechanism - bare React Native has no sticky styling.
 */
import { createContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { View } from './PhaseTheme';
import Pane from './TerminalPane';

/** PROTOTYPE #384: whether the primary scroll has left its top, for the collapse variant. */
export const PhoneScrolled = createContext(false);

export default function MobileTerminal({ active, navigation, header, band, body }: {
  active: string; navigation: ReactNode; header: ReactNode; band: ReactNode; body: ReactNode;
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [active]);
  return <View testID="terminal-mobile" role="main" aria-label="Terminal panes" style={{ flex: 1, minHeight: 0 }}>
    <ScrollView ref={scroll} testID="terminal-primary-scroll" style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={[1]} scrollEventThrottle={16}
      onScroll={(event) => { const away = event.nativeEvent.contentOffset.y > 4; if (away !== scrolled) setScrolled(away); }}>
      {header}<PhoneScrolled.Provider value={scrolled}>{band}</PhoneScrolled.Provider>{body}<Pane slots={[active]} flow />
    </ScrollView>
    {navigation}
  </View>;
}
