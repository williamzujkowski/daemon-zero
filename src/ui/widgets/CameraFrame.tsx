import { Text, View } from '../PhaseTheme';
/**
 * Fixed columns keep Unicode border fallback from changing the camera's geometry.
 * Artwork fits the available width; its semantic label supplies an accessible view.
 */
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { mono, palette } from '../theme';

export default function CameraFrame({ frame, label }: { frame: string[]; label: string }) {
  const [width, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
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
  </View>;
}
