// @vitest-environment happy-dom
/**
 * The camera artwork is 9 rows and 135px at every width — 24% of a 320x568 screen,
 * 16% of a 390x844 one, and free on a desktop column. A nexus vote collapsed it on the
 * phone tier only and left the wider tiers alone.
 */
import { describe, expect, it } from 'vitest';
import { mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

const PHONE = { width: 390, height: 844 };

describe('camera artwork by tier', () => {
  it('collapses to one status line on the phone tier', async () => {
    const view = await mountM4('phase-2-unlocked', PHONE);
    view.click('tab-SENSORS');
    const status = view.find('camera-status');
    expect(status).not.toBeNull();
    expect(status?.textContent).toContain('CAM_04');
    // The artwork itself is absent from the DOM, not merely hidden by style.
    expect(view.container.querySelectorAll('[data-testid^="camera-row-"]')).toHaveLength(0);
    expect(view.find('camera-expand')).not.toBeNull();
    expect(view.find('camera-expand')?.getAttribute('aria-expanded')).toBe('false');
    view.close();
  });

  it('reveals the artwork on request and can fold it again', async () => {
    const view = await mountM4('phase-2-unlocked', PHONE);
    view.click('tab-SENSORS');
    view.click('camera-expand');
    expect(view.container.querySelectorAll('[data-testid^="camera-row-"]')).toHaveLength(9);
    expect(view.find('camera-status')).toBeNull();
    expect(view.find('camera-collapse')?.getAttribute('aria-expanded')).toBeTruthy();
    view.click('camera-collapse');
    expect(view.find('camera-status')).not.toBeNull();
    expect(view.container.querySelectorAll('[data-testid^="camera-row-"]')).toHaveLength(0);
    view.close();
  });

  it('keeps the artwork visible on a desktop column with no toggle', async () => {
    const view = await mountM4('phase-2-unlocked');
    expect(view.find('camera-frame')).not.toBeNull();
    expect(view.container.querySelectorAll('[data-testid^="camera-row-"]')).toHaveLength(9);
    expect(view.find('camera-status')).toBeNull();
    expect(view.find('camera-expand')).toBeNull();
    view.close();
  });
});
