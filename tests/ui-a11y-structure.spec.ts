// @vitest-environment happy-dom
/**
 * #111: the four axe rules that fired on the production export had single root
 * causes in custom primitives. Pin each one, and pin the focus ring, so the next
 * primitive copied from these does not reintroduce the class.
 */
import { describe, expect, it } from 'vitest';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

describe('accessibility structure of the custom primitives (#111)', () => {
  it('gives every role="tab" a role="tablist" parent', async () => {
    const view = await mountM4('epistemic-ready-p2');
    const tabs = [...view.container.querySelectorAll('[role="tab"]')];
    expect(tabs.length).toBeGreaterThan(0);
    for (const tab of tabs) {
      expect(tab.parentElement?.getAttribute('role'), `tab ${String(tab.getAttribute('data-testid'))}`).toBe('tablist');
    }
  });

  it('starts a tab\'s accessible name with the text it shows', async () => {
    const view = await mountM4('epistemic-ready-p2');
    for (const tab of [...view.container.querySelectorAll('[role="tab"]')]) {
      const label = tab.getAttribute('aria-label') ?? '';
      const visible = tab.textContent.trim();
      if (visible === '' || label === '') continue;
      expect(label.toLowerCase(), `tab ${visible}`).toContain(visible.toLowerCase());
    }
  });

  it('exposes a numeric readout as a meter, not a bare text node', async () => {
    const view = await mountM4('phase-1-widgets');
    for (const meter of [...view.container.querySelectorAll('[data-testid$="-meter"]')]) {
      expect(meter.getAttribute('role')).toBe('meter');
      expect(meter.getAttribute('aria-valuetext')).not.toBeNull();
      expect(meter.getAttribute('aria-valuenow')).not.toBeNull();
    }
  });

  it('puts the visible button text inside its own accessible name', async () => {
    const view = await mountM4('epistemic-ready-p2');
    for (const control of [...view.container.querySelectorAll('[role="button"]')]) {
      const label = control.getAttribute('aria-label');
      const visible = control.textContent.trim();
      if (label === null || visible === '') continue;
      expect(label.toLowerCase(), `button ${visible}`).toContain(visible.toLowerCase());
    }
  });

  it('installs exactly one focus-ring style on web, however often it is called', async () => {
    const { installFocusRing } = await import('../src/ui/focusRing');
    installFocusRing();
    installFocusRing();
    const rings = host.document.querySelectorAll('#daemon-focus-ring');
    expect(rings.length).toBe(1);
    expect(rings[0]?.textContent).toContain(':focus-visible');
  });
});