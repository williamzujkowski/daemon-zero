// @vitest-environment happy-dom
/**
 * The opening screen is "log plus manual control" (docs/UI-SPEC.md). It shipped as
 * one truncated sentence of chrome above a button, on an otherwise blank phone.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

describe('opening screen', () => {
  it('shows the boot entries inline while nothing is mapped', async () => {
    const view = await mountM4('tick-0');
    const log = view.find('boot-log');
    expect(log).not.toBeNull();
    const text = log?.textContent ?? '';
    expect(text).toContain('BOOT SEQUENCE');
    expect(text).toContain('BOOT_SEQ');
    // The newest entry lives in the chrome's KERNEL // LIVE preview; repeating it
    // inline read as a duplicated line.
    expect(text).not.toContain('SENSORY_STATUS');
    view.close();
  });

  it('keeps the manual cycle ahead of the log, so the only action is never pushed down', async () => {
    const view = await mountM4('tick-0');
    const pane = view.find('pane-scroll-CORE')?.textContent ?? '';
    expect(pane.indexOf('EXECUTE_CLOCK_CYCLE')).toBeGreaterThanOrEqual(0);
    expect(pane.indexOf('EXECUTE_CLOCK_CYCLE')).toBeLessThan(pane.indexOf('BOOT SEQUENCE'));
    view.close();
  });

  it('drops the inline log once a node is mapped, leaving the purchase feed to read', async () => {
    const view = await mountM4('tick-0');
    expect(view.find('boot-log')).not.toBeNull();
    act(() => { gameStore.initialize(m4State('phase-1-widgets'), 0, null); });
    expect(view.find('boot-log')).toBeNull();
    view.close();
  });
});
