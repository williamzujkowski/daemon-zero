/**
 * Moves focus to a heading node: on the web `focus()` also scrolls it into view; off the web a View's focus() does
 * not move the screen reader, so the accessibility event does (#284, #396 panel).
 */
import { AccessibilityInfo, Platform, type View } from 'react-native';
import type { ComponentRef } from 'react';

export function focusHeading(node: ComponentRef<typeof View> | null): void {
  if (node === null) return;
  if (Platform.OS === 'web') (node as unknown as { focus?: () => void }).focus?.();
  else AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
}
