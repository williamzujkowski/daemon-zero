// @vitest-environment happy-dom
/**
 * The card's price and its shortfall must not read as two prices. Measured while playing
 * the built export: "Cost: 40 cycles" beside "Need: 34 cycles" invited a second read,
 * because the second number is what you still lack (costShortfall, quantized with ceil so
 * it does not tick per frame). The visible copy says "short by"; the accessible name
 * carries the whole sentence.
 */
import { expect, it } from 'vitest';
import { mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

it('labels the shortfall as a shortfall, never as a second cost', async () => {
  const view = await mountM4('thermal-unlocked');
  const text = view.container.textContent;
  expect(text, 'the card still states its price').toContain('Cost:');
  expect(text, 'the shortfall says what it is').toContain('Short by');
  expect(text, 'no bare Need: that could read as a price').not.toContain('Need:');
  view.close();
});
