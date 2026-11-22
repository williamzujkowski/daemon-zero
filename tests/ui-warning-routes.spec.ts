// @vitest-environment happy-dom
/**
 * Routes from a warning to its control (#369): the area words a remedy names (PAYROLL, FINANCE, PROC) are inline links
 * that open that control, select its tab and focus it, on the phone (switching the bottom tab) and on the desktop (the
 * side column), without adding a line to the warning.
 */
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { ROUTE_WORDS } from '../src/ui/routeRequest';
import { WORDS } from '../src/ui/RoutedText';
import { host, knowing, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

const PHONE = { width: 390, height: 844 }, DESKTOP = { width: 1440, height: 900 };
const focused = (): string | null => host.document.activeElement.getAttribute('data-testid');
/** An insolvent company with operatives hired and the revenue dial below its top: both levers act. */
const insolvent = () => {
  const s = m4State('corporate-insolvent');
  return { ...s, actuators: { ...s.actuators, computeProfitAllocationRatio: 0 } };
};

it('answers to exactly the words it routes', () => {
  expect(WORDS.source).toBe('\\b(' + Object.keys(ROUTE_WORDS).join('|') + ')\\b');
});

describe.each([['phone', PHONE], ['desktop', DESKTOP]] as const)('on the %s', (_name, viewport) => {
  it.each([['payroll'], ['finance']] as const)('the insolvency band\'s %s link opens that area, selected and focused', async (area) => {
    const view = await mountM4('corporate-insolvent', viewport);
    act(() => { gameStore.initialize(insolvent(), 0, null); });
    if (viewport === PHONE && view.find('tab-CORE')) view.click('tab-CORE');
    const link = view.find('route-' + area);
    expect(link?.getAttribute('role')).toBe('link');
    expect(view.find('insolvency-warning')?.textContent).toContain(area.toUpperCase());
    view.click('route-' + area);
    const tab = view.find('workspace-CORP-' + area);
    expect(tab?.getAttribute('aria-selected')).toBe('true');
    expect(focused()).toBe('workspace-CORP-' + area);
    if (viewport === PHONE) expect(view.find('tab-CORP')?.getAttribute('aria-selected')).toBe('true');
    view.close();
  });
});

it('a focused route link is taken with Enter, as a native link is (#435 panel)', async () => {
  const view = await mountM4('thermal-unlocked', DESKTOP);
  act(() => { gameStore.initialize({ ...knowing(m4State('thermal-unlocked')), thermal: CONTENT.balance.thermalThresholdForSuspicion + 15 }, 0, null); });
  const link = view.find('route-proc');
  if (!link) throw new Error('Missing the PROC route');
  expect(link.getAttribute('tabindex')).toBe('0');
  act(() => { link.focus(); });
  act(() => { link.dispatchEvent(new host.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  expect(view.find('processes-dialog')).not.toBeNull();
  view.close();
});

it('the overheat remedy\'s PROC link opens the process dialog', async () => {
  const view = await mountM4('thermal-unlocked', DESKTOP);
  act(() => { gameStore.initialize({ ...knowing(m4State('thermal-unlocked')), thermal: CONTENT.balance.thermalThresholdForSuspicion + 15 }, 0, null); });
  expect(view.find('overheat-remedy')?.textContent).toContain('PROC');
  expect(view.find('processes-dialog')).toBeNull();
  view.click('route-proc');
  expect(view.find('processes-dialog')).not.toBeNull();
  view.close();
});

it('on Android and iOS keeps the plain remedy words: nested native text ignores the padding a 44 px target needs (#435 panel)', async () => {
  vi.resetModules();
  vi.doMock('react-native', async (original) => ({ ...await original<object>(), Platform: { OS: 'android', select: (choices: Record<string, unknown>) => choices.android ?? choices.default } }));
  const { default: NativeRoutedText } = await import('../src/ui/RoutedText');
  const element = NativeRoutedText({ text: 'Suspend heat-producing processes in PROC.' });
  expect((element.props as { children: unknown }).children).toBe('Suspend heat-producing processes in PROC.');
  vi.doUnmock('react-native');
  vi.resetModules();
});
