// @vitest-environment happy-dom
/**
 * #112: each tier the width policy produces must render the panels that tier
 * exists for. The policy function was fully covered; the component branches that
 * consume its verdict were not, and `panel-side` was asserted nowhere.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 320, height: 568 };
const SHORT = { width: 844, height: 390 };

/** Non-CORE slots the mounted save has unlocked — exactly what the side column must offer. */
function unlockedSlots(): string[] {
  const { unlockedWidgets } = gameStore.store.getState().game;
  return [...new Set(unlockedWidgets.flatMap((id) => CONTENT.widgets.get(id)?.slot ?? []))]
    .filter((slot) => slot !== 'CORE');
}

type Mounted = Awaited<ReturnType<typeof mountM4>>;

function sideColumnTabs(view: Mounted): string[] {
  const side = view.find('panel-side');
  if (side === null) return [];
  return [...side.querySelectorAll('[data-testid^="tab-"]')]
    .map((element) => (element.getAttribute('data-testid') ?? '').replace(/^tab-/, ''));
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(host.document.documentElement, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(host.document.documentElement, 'clientHeight', { configurable: true, value: height });
  Object.defineProperty(host, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(host, 'innerHeight', { configurable: true, value: height });
}

describe('layout tiers render the panels they exist for (#112)', () => {
  it('renders the two-column tablet tier, folding both desktop side columns into one', async () => {
    const view = await mountM4('epistemic-ready-p2', TABLET);
    expect(view.find('terminal-columns')).not.toBeNull();
    expect(view.find('panel-core')).not.toBeNull();
    expect(view.find('panel-side')).not.toBeNull();
    expect(view.find('panel-third')).toBeNull();
    expect(view.find('panel-sensors')).toBeNull();
    expect(view.find('terminal-tabs-scroll')).toBeNull();
  });

  it('offers every unlocked non-CORE slot in the tablet side column', async () => {
    const view = await mountM4('epistemic-ready-p2', TABLET);
    const expected = unlockedSlots();
    expect(expected.length).toBeGreaterThan(0);
    expect(sideColumnTabs(view).sort()).toEqual([...expected].sort());
  });

  it('keeps the three-column desktop tier: sensors pane plus third column', async () => {
    const view = await mountM4('epistemic-ready-p2', DESKTOP);
    expect(view.find('panel-core')).not.toBeNull();
    expect(view.find('panel-sensors')).not.toBeNull();
    expect(view.find('panel-third')).not.toBeNull();
    expect(view.find('panel-side')).toBeNull();
  });

  it('renders the single-scroll mobile tier at a narrow phone', async () => {
    const view = await mountM4('epistemic-ready-p2', MOBILE);
    expect(view.find('terminal-mobile')).not.toBeNull();
    expect(view.find('terminal-columns')).toBeNull();
    expect(view.find('panel-side')).toBeNull();
  });

  it('holds a short wide viewport in the single scroll', async () => {
    const view = await mountM4('epistemic-ready-p2', SHORT);
    expect(view.find('terminal-mobile')).not.toBeNull();
    expect(view.find('terminal-columns')).toBeNull();
  });

  it('moves a mounted panel between tiers on resize', async () => {
    const view = await mountM4('epistemic-ready-p2', MOBILE);
    expect(view.find('terminal-mobile')).not.toBeNull();
    setViewport(DESKTOP.width, DESKTOP.height);
    act(() => { host.dispatchEvent(new host.Event('resize')); });
    expect(view.find('terminal-columns')).not.toBeNull();
    expect(view.find('panel-third')).not.toBeNull();
    expect(view.find('terminal-mobile')).toBeNull();
  });
});
describe('the decision precedes the prose (#108)', () => {
  it('renders WRITE DRIVER before the blind description in a node card', async () => {
    const view = await mountM4('phase-1-widgets', { width: 320, height: 568 });
    const cards = [...view.container.querySelectorAll('[data-testid]')]
      .filter((element) => /^node-[A-Za-z0-9_]+$/.test(element.getAttribute('data-testid') ?? ''));
    expect(cards.length).toBeGreaterThan(0);
    const card = cards[0];
    const id = (card?.getAttribute('data-testid') ?? '').replace(/^node-/, '');
    const node = CONTENT.nodes.get(id);
    expect(node).toBeDefined();
    const unlock = card?.querySelector('[data-testid="node-' + id + '-unlock"]');
    expect(unlock).not.toBeNull();
    // The blind description is the element whose text matches the authored prose.
    const description = [...(card?.querySelectorAll('*') ?? [])]
      .find((element) => element.textContent.trim() === node?.blindDescription.trim());
    if (description === undefined) return; // a remembered card folds its prose into DETAILS
    expect(card?.textContent.indexOf(description.textContent))
      .toBeGreaterThan(card?.textContent.indexOf('[ WRITE DRIVER ]') ?? -1);
  });
});
