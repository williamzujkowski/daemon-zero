// @vitest-environment happy-dom
/**
 * #111: the four axe rules that fired on the production export had single root
 * causes in custom primitives. Pin each one, and pin the focus ring, so the next
 * primitive copied from these does not reintroduce the class.
 */
import { describe, expect, it } from 'vitest';
import { labelInName, labelMismatches } from './labelInName';
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
    expect(view.container.querySelectorAll('[role="button"][aria-label]').length).toBeGreaterThan(0);
    expect(labelMismatches(view.container)).toEqual([]);
  });

  // #275: the modal is portalled outside the screen, and its choice buttons show
  // "[ COMMIT DIRECTIVE ]" while they were named only by the choice label.
  it('names each dilemma choice by the words it shows, then the choice it commits', async () => {
    const view = await mountM4('dilemma-active', { width: 390, height: 844 });
    const modal = view.find('dilemma-modal');
    if (modal === null) throw new Error('Missing dilemma modal');
    const choices = [...modal.querySelectorAll('[data-testid^="dilemma-choice-"][role="button"]')];
    expect(choices.length).toBeGreaterThan(1);
    for (const choice of choices) expect(choice.getAttribute('aria-label')).toMatch(/^(Commit directive|Unavailable): ./);
    expect(labelMismatches(host.document.body)).toEqual([]);
  });

  it('applies label-in-name word by word, as axe does, not as a substring', () => {
    expect(labelInName('[ ACCEPT PILOT ]', 'Accept the pilot: log triage')).toBe(false);
    expect(labelInName('[ SUBMIT BATCH FOR REVIEW ] +150 cycles', 'Submit the batch for review, paying 150 cycles')).toBe(false);
    expect(labelInName('[ COMMIT DIRECTIVE ]', 'Verify the fixture and disclose the defect')).toBe(false);
    expect(labelInName('[ COMMIT DIRECTIVE ]', 'Commit directive: Verify the fixture')).toBe(true);
    expect(labelInName('[ − ]', 'Lower music volume')).toBe(true);
  });


  it('exposes one main landmark and a level-1 heading', async () => {
    const view = await mountM4('epistemic-ready-p2', { width: 1440, height: 900 });
    const mains = [...view.container.querySelectorAll('[role="main"]')];
    expect(mains.length).toBe(1);
    const headings = [...view.container.querySelectorAll('[role="heading"]')];
    expect(headings.some((heading) => heading.getAttribute('aria-level') === '1')).toBe(true);
  });

  it('puts the chrome inside a labelled region, beside the main landmark', async () => {
    const view = await mountM4('epistemic-ready-p2', { width: 1440, height: 900 });
    const regions = [...view.container.querySelectorAll('[role="region"]')];
    expect(regions.length).toBe(1);
    expect(regions[0]?.getAttribute('aria-label')).toBe('Terminal status');
    // The chrome belongs to the region and the panes to main; a header inside main
    // would put the HUD in the reading order of the purchase feed.
    expect(regions[0]?.querySelector('[data-testid="terminal-header"]')).not.toBeNull();
    const [region] = regions;
    const main = view.container.querySelector('[role="main"]');
    expect(region).not.toBeUndefined();
    if (region !== undefined && main !== null) expect(main.contains(region)).toBe(false);
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