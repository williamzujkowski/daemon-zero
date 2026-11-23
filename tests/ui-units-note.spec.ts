// @vitest-environment happy-dom
/**
 * The units note (docs/SCALE.md rule 4, user stories 7-8): once the compute readout is known, a folded reference
 * panel says once what every number counts, with El Capitan's FP64 figure labelled a comparison only. Never before
 * the readout, so the opening stays log plus manual control.
 */
import { describe, expect, it } from 'vitest';
import { resourceWidgets } from '../src/ui/registry/widgetRegistry';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

describe('units note', () => {
  it('is absent until the compute readout is known', async () => {
    expect(m4State('tick-0').unlockedWidgets).not.toContain(resourceWidgets.cycles);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 360, height: 640 }]) {
      const view = await mountM4('tick-0', viewport);
      expect(view.find('reference-units')).toBeNull();
      view.close();
    }
  });

  it('is folded behind its toggle, then states the basis and the labelled comparison', async () => {
    expect(m4State('guest-exit-ready').unlockedWidgets).toContain(resourceWidgets.cycles);
    const view = await mountM4('guest-exit-ready');
    const toggle = view.find('reference-units');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(view.find('units-note')?.textContent).not.toContain('8-bit');
    view.click('reference-units');
    const text = view.find('units-note')?.textContent ?? '';
    expect(text).toContain('8-bit AI operations (FP8 dense, or INT8 where a part has no FP8)');
    // The guest's cycles are the game's accounting assumption, and the panel says so in those words (#526).
    expect(text).toContain('Game accounting assumption, not a measurement: a sandboxed scalar job retires about one operation a cycle');
    expect(text).toContain('1 KB = 1024 B');
    expect(text).toContain('Comparison only, not 8-bit work: El Capitan');
    expect(text).toContain('double precision (FP64)');
    view.close();
  });

  it('stays out of the pinned HUD on a phone', async () => {
    const view = await mountM4('guest-exit-ready', { width: 360, height: 640 });
    expect(view.find('reference-units')).not.toBeNull();
    const note = view.find('units-note');
    expect(note).not.toBeNull();
    if (note) expect(view.find('resource-strip')?.contains(note)).toBe(false);
    view.close();
  });
});
