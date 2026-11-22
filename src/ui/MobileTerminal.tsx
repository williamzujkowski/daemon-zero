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
import { ScrollView, useWindowDimensions } from 'react-native';
import { View } from './PhaseTheme';
import Pane from './TerminalPane';

/** PROTOTYPE #384: whether the primary scroll has left its top, for the collapse variant. */
export const PhoneScrolled = createContext(false);
/** PROTOTYPE #384: whether the variant's part is pinned now; the collapse variant folds only while pinned, since a fold in
 *  the flow shrinks the content above the player and moves the page under them (judgment re-measure). */
export const PhonePinned = createContext(false);

/**
 * PROTOTYPE #384: the share of the window a pinned block may take, from `?cap=` (percent, default 30). Over it the variant's
 * part scrolls with the page in the same place, so large text never pins a block that hides the workspace (judgment panel
 * vote-1795323686534-k927ly6). The band always sticks, as before.
 */
function capShare(): number {
  const search = (globalThis as { location?: { search?: string } }).location?.search ?? '';
  const value = Number(new URLSearchParams(search).get('cap') ?? '30');
  return Number.isFinite(value) && value > 0 && value <= 100 ? value / 100 : 0.3;
}
const CAP = capShare();

export default function MobileTerminal({ active, navigation, header, band, pinned, body }: {
  active: string; navigation: ReactNode; header: ReactNode; band: ReactNode; pinned?: ReactNode; body: ReactNode;
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [scrolled, setScrolled] = useState(false);
  const [heights, setHeights] = useState({ band: 0, part: 0 });
  const window = useWindowDimensions();
  const pin = pinned !== undefined && heights.band + heights.part <= CAP * window.height;
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [active]);
  // A focused or scrolled-to control must not land under the pinned block (WCAG 2.2 SC 2.4.11).
  useEffect(() => {
    const node = (scroll.current as unknown as { getScrollableNode?: () => { style?: { scrollPaddingTop: string } } } | null)?.getScrollableNode?.();
    if (node?.style) node.style.scrollPaddingTop = String(Math.ceil(heights.band + (pin ? heights.part : 0))) + 'px';
  }, [heights, pin]);
  const part = pinned === undefined ? null : <View testID="phone-pinned-part" onLayout={(event) => {
    const part = Math.round(event.nativeEvent.layout.height); if (part !== heights.part) setHeights({ ...heights, part }); }}>{pinned}</View>;
  // The providers wrap the scroll, never its children: ScrollView counts children by index, and stickyHeaderIndices
  // must point at the sticky block alone (a provider at index 1 made the unpinned part stick too).
  return <View testID="terminal-mobile" role="main" aria-label="Terminal panes" style={{ flex: 1, minHeight: 0 }}>
    <PhoneScrolled.Provider value={scrolled}><PhonePinned.Provider value={pin}><ScrollView ref={scroll} testID="terminal-primary-scroll" style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={[1]} scrollEventThrottle={16}
      onScroll={(event) => { const away = event.nativeEvent.contentOffset.y > 4; if (away !== scrolled) setScrolled(away); }}>
      {header}
        <View testID="phone-sticky" {...({ dataSet: { pinned: pin ? 'yes' : 'no' } } as object)} onLayout={(event) => {
          const total = Math.round(event.nativeEvent.layout.height), bandOnly = total - (pin ? heights.part : 0);
          if (bandOnly !== heights.band) setHeights({ ...heights, band: bandOnly }); }}>{band}{pin && part}</View>
        {!pin && part}{body}<Pane slots={[active]} flow />
    </ScrollView></PhonePinned.Provider></PhoneScrolled.Provider>
    {navigation}
  </View>;
}
