/** Optional native tactile feedback; web and reduced-motion preferences are silent.
 * Missing hardware/module support never turns an accepted action into an error.
 */
import { Platform } from 'react-native';

export async function feedback(kind: 'purchase' | 'interrupt', reduced: boolean): Promise<void> {
  if (Platform.OS === 'web' || reduced) return;
  try {
    const haptics = await import('expo-haptics');
    if (kind === 'purchase') await haptics.selectionAsync();
    else await haptics.notificationAsync(haptics.NotificationFeedbackType.Warning);
  } catch { /* Tactile feedback is optional on hardware without a vibrator. */ }
}
