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
 * band; at the top of the scroll the two look the same. The interrupt forecast joins the pinned block only while the band,
 * the HUD and the forecast all fit the same cap (vote-1795335412078-ubcj3e7), else it scrolls in place under the HUD. While it sticks, the scroll's padding keeps a scrolled-to or focused control below it (WCAG 2.2 SC 2.4.11).
 */
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { View } from './PhaseTheme';
import Pane from './TerminalPane';
import { forecastPinned as forecastJoins, hudPinned, type HudHeights } from './hudPin';
import { palette } from './theme';

interface ScrollNode { getScrollableNode?: () => { style?: { scrollPaddingTop: string } } | null }

export default function MobileTerminal({ active, navigation, header, band, hud, forecast, body }: {
  active: string; navigation: ReactNode; header: ReactNode; band: ReactNode; hud: ReactNode; forecast: ReactNode; body: ReactNode;
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const window = useWindowDimensions();
  const [heights, setHeights] = useState<HudHeights & { forecast: number }>({ band: 0, hud: 0, forecast: 0 });
  // Starts pinned and keeps that until measured (hudPin.ts): moving the HUD remounts it and re-announces its alerts.
  const [pinned, setPinned] = useState(true);
  const next = hudPinned(heights, window.height, pinned);
  if (next !== pinned) setPinned(next);
  // The forecast joins the pinned HUD only while all three still fit the same cap (hudPin.ts), so it never costs the HUD its pin.
  const [forecastPinned, setForecastPinned] = useState(false);
  const nextForecast = forecastJoins(heights, heights.forecast, window.height, next, forecastPinned);
  if (nextForecast !== forecastPinned) setForecastPinned(nextForecast);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [active]);
  useEffect(() => {
    const node = (scroll.current as unknown as ScrollNode | null)?.getScrollableNode?.();
    if (node?.style) node.style.scrollPaddingTop = String(Math.ceil(heights.band + (pinned ? heights.hud : 0) + (forecastPinned ? heights.forecast : 0))) + 'px';
  }, [heights, pinned, forecastPinned]);
  const measured = (key: 'band' | 'hud' | 'forecast') => (event: { nativeEvent: { layout: { height: number } } }) => {
    const height = Math.round(event.nativeEvent.layout.height);
    setHeights((current) => current[key] === height ? current : { ...current, [key]: height });
  };
  const resources = <View testID="hud-region" onLayout={measured('hud')}>{hud}</View>;
  const outlook = <View testID="forecast-region" onLayout={measured('forecast')}>{forecast}</View>;
  return <View testID="terminal-mobile" role="main" aria-label="Terminal panes" style={{ flex: 1, minHeight: 0 }}>
    <ScrollView ref={scroll} testID="terminal-primary-scroll" style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={[1]}>
      {header}
      <View testID="sticky-chrome" {...({ dataSet: { hudPinned: pinned ? 'yes' : 'no', forecastPinned: forecastPinned ? 'yes' : 'no' } } as object)} style={{ backgroundColor: palette.background }}>
        <View onLayout={measured('band')}>{band}</View>{pinned && resources}{forecastPinned && outlook}
      </View>
      {!pinned && resources}{!forecastPinned && outlook}{body}<Pane slots={[active]} flow />
    </ScrollView>
    {navigation}
  </View>;
}
