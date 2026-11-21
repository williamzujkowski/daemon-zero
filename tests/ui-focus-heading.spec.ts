/** focusHeading moves the screen reader off the web too (#396 panel): a View's focus() does nothing there. */
import { describe, expect, it, vi } from 'vitest';

describe('focusHeading', () => {
  it('sends the accessibility focus event off the web and calls focus() on the web', async () => {
    vi.resetModules();
    const sendAccessibilityEvent = vi.fn();
    vi.doMock('react-native', () => ({ Platform: { OS: 'android' }, AccessibilityInfo: { sendAccessibilityEvent } }));
    const native = await import('../src/ui/focusHeading');
    const node = { focus: vi.fn() };
    native.focusHeading(node as never);
    expect(sendAccessibilityEvent).toHaveBeenCalledWith(node, 'focus');
    expect(node.focus).not.toHaveBeenCalled();
    vi.resetModules();
    vi.doMock('react-native', () => ({ Platform: { OS: 'web' }, AccessibilityInfo: { sendAccessibilityEvent } }));
    const web = await import('../src/ui/focusHeading');
    web.focusHeading(node as never);
    expect(node.focus).toHaveBeenCalledOnce();
    web.focusHeading(null);
    vi.doUnmock('react-native');
  });
});
