import { Pressable, Text, View } from '../PhaseTheme';
/**
 * Fixed columns keep Unicode border fallback from changing the camera's geometry.
 * Artwork fits the available width; its semantic label supplies an accessible view.
 *
 * On the phone tier the artwork is collapsed to one status line beside a 44px
 * toggle: measured at 9 rows it is 135px tall at every width, which is 24% of a
 * 320x568 screen and 16% of a 390x844 one while costing a wide screen nothing. A
 * nexus vote chose collapsing it there and leaving tablet and desktop alone (6 of 7
 * selecting seats, mobile-only-collapse-art-and-prose).
 */
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { mono, palette, theme } from '../theme';
import { layoutFor } from '../layout';

export default function CameraFrame({ frame, label, status }: { frame: string[]; label: string; status: string }) {
  const [width, setWidth] = useState(0);
  const { fontScale, width: viewport, height } = useWindowDimensions();
  // Undecided until the player touches a toggle, so a resize re-derives the default
  // instead of leaving a stale panel behind.
  const [requested, setRequested] = useState<boolean | null>(null);
  const phone = layoutFor(viewport, height).mode === 'mobile';
  const open = requested ?? !phone;
  if (!open) {
    return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <Text testID="camera-status" style={theme.muted} accessibilityLabel={label}>{status}</Text>
      <Pressable testID="camera-expand" accessibilityRole="button" accessibilityLabel={'[i] VIEW for ' + label}
        accessibilityState={{ expanded: false }} aria-expanded={false} style={[theme.button, { paddingHorizontal: 8 }]}
        onPress={() => { setRequested(true); }}>
        <Text style={theme.muted}>[i] VIEW</Text>
      </Pressable>
    </View>;
  }
  const columns = Math.max(1, ...frame.map((row) => Array.from(row).length));
  const cell = width > 0 ? Math.min(6 * fontScale, width / columns) : 6;
  return <View testID="camera-frame" accessibilityRole="image" accessibilityLabel={label}
    onLayout={(event) => { setWidth(event.nativeEvent.layout.width); }} style={{ width: '100%' }}>
    {frame.map((row, index) => <View key={index} testID={'camera-row-' + String(index)}
      accessible={false} style={{ flexDirection: 'row', height: cell * 2.5 }}>
      {Array.from(row).map((character, column) => <Text key={column} accessible={false} allowFontScaling={false}
        style={{ fontFamily: mono, fontSize: cell / 0.6, lineHeight: cell * 2.5, width: cell, textAlign: 'center', color: palette.text }}>
        {character}</Text>)}
    </View>)}
    {phone && <Pressable testID="camera-collapse" accessibilityRole="button" accessibilityLabel={'[−] HIDE for ' + label}
      accessibilityState={{ expanded: true }} aria-expanded={true} style={[theme.button, { alignSelf: 'flex-start', paddingHorizontal: 8 }]}
      onPress={() => { setRequested(false); }}>
      <Text style={theme.muted}>[−] HIDE</Text>
    </Pressable>}
  </View>;
}
