// @vitest-environment happy-dom
/** IMPORT SAVE CODE checks the pasted code before it offers to replace the run (#245). */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT as PREVIEW } from '../src/content/preview';
import { createInitialState, exportSave, tick } from '../src/engine';
import { gameStore } from '../src/app/session';
import { host, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
type View = Awaited<ReturnType<typeof mountM4>>;

const INVALID = 'Save code is invalid or unsupported.';
const PREVIEW_REFUSAL = 'This save comes from a preview build and cannot be loaded here.';

function typeCode(view: View, code: string): void {
  const input = view.find('save-code');
  if (!(input instanceof host.HTMLTextAreaElement)) throw new Error('Missing save code input');
  act(() => {
    Object.getOwnPropertyDescriptor(host.HTMLTextAreaElement.prototype, 'value')?.set?.call(input, code);
    input.dispatchEvent(new host.Event('input', { bubbles: true }));
  });
}

function previewCode(): string {
  const preview = tick(createInitialState(PREVIEW), 1, PREVIEW);
  if (preview.contentChannel !== 'preview') throw new Error('Expected a preview-channel run');
  return exportSave(preview);
}

async function refused(code: string, reason: string): Promise<void> {
  const view = await mountM4('guest-skimmer');
  const before = gameStore.store.getState();
  view.click('menu-open'); view.click('save-open');
  typeCode(view, code); view.click('save-import');
  expect(view.find('save-import-dialog')).toBeNull();
  expect(view.find('save-import-confirm')).toBeNull();
  expect(view.find('save-transfer')).not.toBeNull();
  const status = view.find('save-transfer-status');
  expect(status?.textContent).toBe(reason);
  expect(status?.getAttribute('role')).toBe('alert');
  expect(status?.getAttribute('aria-live')).toBe('assertive');
  expect(view.find('menu-dialog')?.textContent).not.toMatch(/validated/i);
  expect(gameStore.store.getState().game).toBe(before.game);
  expect(gameStore.store.getState().restoreRevision).toBe(before.restoreRevision);
}

describe('import is checked before the replacement confirmation', () => {
  it.each([
    ['garbage text', 'not-a-save-code', INVALID],
    ['an empty field', '', INVALID],
  ])('refuses %s on the save page without the validated-save confirmation', async (_name, code, reason) => {
    await refused(code, reason);
  });

  it('refuses a preview-build code by name on the save page', async () => {
    await refused(previewCode(), PREVIEW_REFUSAL);
  });

  it('announces a repeated refusal again by remounting its alert', async () => {
    const view = await mountM4('guest-skimmer');
    view.click('menu-open'); view.click('save-open');
    typeCode(view, 'still not a save'); view.click('save-import');
    const first = view.find('save-transfer-status');
    view.click('save-import');
    const second = view.find('save-transfer-status');
    expect(second?.textContent).toBe(INVALID);
    expect(second).not.toBe(first);
  });

  it('offers the confirmation only for a valid code, clears the refusal and replaces on confirm', async () => {
    const view = await mountM4('guest-skimmer');
    const before = gameStore.store.getState();
    const target = m4State('phase-1-widgets');
    view.click('menu-open'); view.click('save-open');
    typeCode(view, 'garbage'); view.click('save-import');
    expect(view.find('save-transfer-status')?.textContent).toBe(INVALID);
    typeCode(view, exportSave(target)); view.click('save-import');
    expect(view.find('save-import-dialog')?.textContent).toContain('validated save');
    expect(gameStore.store.getState().game).toBe(before.game);
    view.click('save-import-cancel');
    expect(view.find('save-transfer-status')).toBeNull();
    view.click('save-import'); view.click('save-import-confirm');
    expect(view.find('menu-dialog')).toBeNull();
    expect(gameStore.store.getState().restoreRevision).toBe(before.restoreRevision + 1);
    expect(gameStore.store.getState().game.unlockedNodes).toEqual(target.unlockedNodes);
  });
});
