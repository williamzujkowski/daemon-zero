import { Text, View } from '../PhaseTheme';
/** One titled section of the world view (#463): its heading nests under the console's title, and its children under it. */
import type { ReactNode } from 'react';
import { HeadingLevel, SECTION_LEVEL, useHeadingLevel } from '../headingLevel';
import { theme } from '../theme';

export default function WorldSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const level = useHeadingLevel() ?? SECTION_LEVEL + 1;
  return <View testID={id} style={{ gap: 8 }}>
    <Text accessibilityRole="header" aria-level={level} style={theme.heading}>{title}</Text>
    <HeadingLevel level={level + 1}>{children}</HeadingLevel>
  </View>;
}
