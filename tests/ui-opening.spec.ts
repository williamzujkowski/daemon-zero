// @vitest-environment happy-dom
/**
 * The opening screen is "log plus manual control" (docs/UI-SPEC.md). It shipped as
 * one truncated sentence of chrome above a button, on an otherwise blank phone.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { BOOT_LOG_ENTRIES, selectBootLogText, selectLatestLog } from '../src/app/selectors';
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

  it('splits the log with the chrome instead of slicing in the view', async () => {
    const view = await mountM4('tick-0');
    const state = gameStore.store.getState();
    const preview = view.find('kernel-preview')?.textContent ?? '';
    // The chrome preview owns the newest entry, and the opening block starts after it.
    expect(preview).toBe(selectLatestLog(state));
    const block = view.find('boot-log')?.textContent ?? '';
    for (const entry of state.game.logs.slice(1, 1 + BOOT_LOG_ENTRIES)) {
      expect(block).toContain(entry.text);
    }
    expect(block).not.toContain(selectLatestLog(state));
    view.close();
  });

  it('caps the opening block at BOOT_LOG_ENTRIES older entries', async () => {
    const view = await mountM4('deaddrop-breadcrumb');
    const state = gameStore.store.getState();
    expect(state.game.logs.length).toBeGreaterThan(BOOT_LOG_ENTRIES + 1);
    const older = state.game.logs.slice(1, 1 + BOOT_LOG_ENTRIES).map((entry) => entry.text);
    // Compared as text, not line count: an entry may itself wrap.
    expect(selectBootLogText(state)).toBe(older.join('\n'));
    expect(selectBootLogText(state)).not.toContain(selectLatestLog(state));
    // A later state has nothing to map on the opening screen, so the block is gone.
    expect(view.find('boot-log')).toBeNull();
    view.close();
  });
});
