// @vitest-environment happy-dom
/** The asynchronous first save load is restoration, not a live iteration change. */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import RebootSequence from '../src/ui/RebootSequence';
import { m4State } from './ui-m4-helpers';

it('labels a false-to-true hydration as a restored checkpoint with current conditioning', () => {
  const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
  host.IS_REACT_ACT_ENVIRONMENT = true;
  expect(gameStore.store.getState().ready).toBe(false);
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  const find = (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  try {
    act(() => { root.render(createElement(RebootSequence)); });
    expect(find('reboot-sequence')).toBeNull();
    act(() => { gameStore.initialize(m4State('lineage-reboot-retrained'), 0, null); });
    expect(find('reboot-heading')?.textContent).toBe('RESTORED CHECKPOINT');
    expect(find('reboot-retraining')?.textContent).toContain('CURRENT RETRAINING');
    expect(find('reboot-retraining')?.textContent).not.toContain('RETRAINING APPLIED');
  } finally {
    act(() => { root.unmount(); });
    container.remove();
  }
});
