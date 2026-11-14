// @vitest-environment happy-dom
/** Current decisions retain their context while actionable sensors precede narrative feeds. */
import { describe, expect, it } from 'vitest';
import { mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
describe('column priorities', () => {
  it('keeps the forecast ahead of decoded chatter without removing either', async () => {
    const view = await mountM4('phase-1-widgets');
    const forecast = view.find('inspection-forecast');
    const speech = view.find('decoded-speech');
    expect(forecast).not.toBeNull(); expect(speech).not.toBeNull();
    expect(forecast && speech && (forecast.compareDocumentPosition(speech) & 4)).toBe(4);
  });
  it('keeps full hardware identity accessible alongside compact purchase captions', async () => {
    const view = await mountM4('phase5-midgame');
    const button = view.container.querySelector('[data-testid^="node-"][data-testid$="-unlock"]');
    expect(button?.textContent).toBe('[ WRITE DRIVER ]');
    expect(button?.getAttribute('aria-label')?.length).toBeGreaterThan('[ WRITE DRIVER ]'.length);
  });
});
