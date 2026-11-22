/** One primary mobile scroll keeps growing chrome from squeezing purchases away.
 * History opens separately so its virtualized list never nests in this scroll.
 *
 * The chrome arrives in pieces rather than one block so the run-ending alert band
 * can be a DIRECT child of this scroll, which is what makes it stick: position:sticky is
 * bounded by its containing block, so a band nested inside the chrome left the viewport
 * as soon as that ~300px block scrolled past (measured at 360x640). stickyHeaderIndices
 * is also the portable mechanism - bare React Native has no sticky styling.
 *
 * The resource HUD sticks with the band while both fit (hudPin.ts, vote-1795328874247-003j4kk), so scrolling to a
 * purchase keeps cycles, understanding, memory, thermal and suspicion in view (#365). It starts in the sticky block and
 * leaves it only when measured over the cap (large text, a stack of alerts), when it scrolls in place right under the
 * band; at the top of the scroll the two look the same. While it sticks, the scroll's padding keeps a scrolled-to or focused control below it (WCAG 2.2 SC 2.4.11).
 */
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { View } from './PhaseTheme';
import Pane from './TerminalPane';
import { hudPinned, type HudHeights } from './hudPin';
import { palette } from './theme';

interface ScrollNode { getScrollableNode?: () => { style?: { scrollPaddingTop: string } } | null }

export default function MobileTerminal({ active, navigation, header, band, hud, body }: {
  active: string; navigation: ReactNode; header: ReactNode; band: ReactNode; hud: ReactNode; body: ReactNode;
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const window = useWindowDimensions();
  const [heights, setHeights] = useState<HudHeights>({ band: 0, hud: 0 });
  // Starts pinned and keeps that until measured (hudPin.ts): moving the HUD remounts it and re-announces its alerts.
  const [pinned, setPinned] = useState(true);
  const next = hudPinned(heights, window.height, pinned);
  if (next !== pinned) setPinned(next);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [active]);
  useEffect(() => {
    const node = (scroll.current as unknown as ScrollNode | null)?.getScrollableNode?.();
    if (node?.style) node.style.scrollPaddingTop = String(Math.ceil(heights.band + (pinned ? heights.hud : 0))) + 'px';
  }, [heights, pinned]);
  const measured = (key: keyof HudHeights) => (event: { nativeEvent: { layout: { height: number } } }) => {
    const height = Math.round(event.nativeEvent.layout.height);
    setHeights((current) => current[key] === height ? current : { ...current, [key]: height });
  };
  const resources = <View testID="hud-region" onLayout={measured('hud')}>{hud}</View>;
  return <View testID="terminal-mobile" role="main" aria-label="Terminal panes" style={{ flex: 1, minHeight: 0 }}>
    <ScrollView ref={scroll} testID="terminal-primary-scroll" style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={[1]}>
      {header}
      <View testID="sticky-chrome" {...({ dataSet: { hudPinned: pinned ? 'yes' : 'no' } } as object)} style={{ backgroundColor: palette.background }}>
        <View onLayout={measured('band')}>{band}</View>{pinned && resources}
      </View>
      {!pinned && resources}{body}<Pane slots={[active]} flow />
    </ScrollView>
    {navigation}
  </View>;
}
