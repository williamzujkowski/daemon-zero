// @vitest-environment happy-dom
/** UI fix batch F4a (docs/UI-REVIEW.md): the reboot dialog's only action stays at its foot, and closing it returns
 *  focus to the first action instead of the page body (#371, #364). */
import { expect, it } from 'vitest';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('keeps Continue boot outside the scrolling body, which takes focus itself (#371)', async () => {
  const view = await mountM4('iteration-2-breadcrumb', { width: 390, height: 844 });
  const body = view.find('reboot-body');
  const continueBoot = view.find('reboot-continue');
  if (body === null || continueBoot === null) throw new Error('reboot dialog not rendered');
  expect(body.contains(continueBoot)).toBe(false);
  expect(view.find('reboot-sequence')?.contains(continueBoot)).toBe(true);
  expect(body.getAttribute('tabindex')).toBe('0');
});

it('returns focus to EXECUTE_CLOCK_CYCLE when Continue boot closes the dialog (#364)', async () => {
  const view = await mountM4('iteration-2-breadcrumb', { width: 390, height: 844 });
  view.click('reboot-continue');
  expect(view.find('reboot-sequence')).toBeNull();
  expect(host.document.activeElement).toBe(view.find('manual-cycle'));
});
