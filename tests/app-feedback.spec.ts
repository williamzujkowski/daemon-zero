/** Native feedback is optional and web never invokes a vibration API. */
import { Platform } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { feedback } from '../src/app/feedback';
const haptics = vi.hoisted(() => ({ selectionAsync: vi.fn(), notificationAsync: vi.fn() }));
vi.mock('expo-haptics', () => ({ ...haptics, NotificationFeedbackType: { Warning: 'warning' } }));
describe('tactile feedback', () => {
  it('does nothing on web or with reduced motion, and handles both native events and failure', async () => {
    const original = Platform.OS;
    try {
      Platform.OS = 'web'; await feedback('purchase', false); expect(haptics.selectionAsync).not.toHaveBeenCalled();
      Platform.OS = 'android'; await feedback('purchase', true); expect(haptics.selectionAsync).not.toHaveBeenCalled();
      await feedback('purchase', false); expect(haptics.selectionAsync).toHaveBeenCalledOnce();
      await feedback('interrupt', false); expect(haptics.notificationAsync).toHaveBeenCalledWith('warning');
      haptics.selectionAsync.mockRejectedValueOnce(new Error('No vibrator'));
      await expect(feedback('purchase', false)).resolves.toBeUndefined();
    } finally { Platform.OS = original; }
  });
});
