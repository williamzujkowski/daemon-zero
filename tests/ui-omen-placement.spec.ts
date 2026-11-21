// @vitest-environment happy-dom
/** Where the omen sits by tier (#362): under EXECUTE in CORE on the phone (vote-1795217200867-j2buva4), in the fixed
 *  chrome's reserved slot on column tiers (vote-1795219347137-c21nx42), never above the primary action in one flow. */
import { expect, it } from 'vitest';
import { mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('puts the omen after EXECUTE in CORE on the phone, and nowhere in the chrome', async () => {
  const view = await mountM4('guest-omen', { width: 390, height: 844 });
  const omen = view.find('omen-notice');
  const execute = view.find('manual-cycle');
  if (omen === null || execute === null) throw new Error('omen or EXECUTE not rendered');
  // DOCUMENT_POSITION_FOLLOWING: the omen comes after the primary action.
  expect(execute.compareDocumentPosition(omen) & 4).toBe(4);
  expect(view.find('omen-slot')).toBeNull();
});

it('keeps the omen in the reserved chrome slot on desktop, before the columns, with its label inline', async () => {
  const view = await mountM4('guest-omen', { width: 1440, height: 900 });
  const slot = view.find('omen-slot');
  expect(slot?.querySelector('[data-testid="omen-notice"]')).not.toBeNull();
  expect(slot?.textContent.startsWith('OMEN // ')).toBe(true);
  // Its reserved height comes from a stylesheet class; the atlas measures that EXECUTE does not move (t-omen-*).
});
