// @vitest-environment happy-dom
/**
 * A decision folds each offered choice to one row: its title, cost and whether it can be paid (maintainer request,
 * 2026-11-21). Every alternative and its price is in the first view on a phone, the concern behind #371, without
 * the separate index that repeated each choice. A choice's details and its commit control are inside the open card,
 * so nothing is chosen unread; opening one closes no other.
 */
import { expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { canAfford, offeredChoices } from '../src/engine';
import { costText } from '../src/ui/format';
import { labelMismatches } from './labelInName';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

const setup = async () => {
  const state = m4State('guest-dilemma');
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === state.activeDilemmaId);
  if (!dilemma) throw new Error('fixture has no active dilemma');
  const offered = offeredChoices(state, dilemma, CONTENT);
  expect(offered.length).toBeGreaterThan(1);
  const view = await mountM4('guest-dilemma', { width: 390, height: 844 });
  const all = (selector: string) => [...view.container.ownerDocument.querySelectorAll(selector)];
  return { state, offered, view, all };
};

it('shows each offered choice once, folded to its title and cost, in authored order, with no index', async () => {
  const { state, offered, view, all } = await setup();
  expect(view.find('dilemma-index')).toBeNull();
  const cards = all('[data-testid^="dilemma-card-"]').map((card) => card.getAttribute('data-testid') ?? '')
    .filter((id) => !/-(heading|toggle|details)$/.test(id));
  expect(cards).toEqual(offered.map((choice) => 'dilemma-card-' + choice.id));
  for (const choice of offered) {
    const toggle = view.find('dilemma-card-' + choice.id + '-toggle');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.textContent).toContain('Cost: ' + costText(choice.cost));
    expect(toggle?.textContent.includes('cannot pay yet')).toBe(!canAfford(state, choice.cost, CONTENT));
    // Folded: nothing can be committed unread.
    expect(view.find('dilemma-choice-' + choice.id)).toBeNull();
    expect(view.find('dilemma-card-' + choice.id + '-details')).toBeNull();
  }
  // The row's name is the words it shows (WCAG 2.5.3), and the toggle sits inside the card's heading.
  expect(labelMismatches(view.container.ownerDocument.body)).toEqual([]);
  expect(view.find('dilemma-card-' + (offered[0]?.id ?? '') + '-heading')?.querySelector('[role="button"]')).not.toBeNull();
  view.close();
});

it('opening a row shows its details and commit control; opening another keeps the first open; folding hides it again', async () => {
  const { offered, view } = await setup();
  const [first, second] = offered;
  if (!first || !second) throw new Error('need two choices');
  view.click('dilemma-card-' + first.id + '-toggle');
  expect(view.find('dilemma-card-' + first.id + '-toggle')?.getAttribute('aria-expanded')).toBe('true');
  expect(view.find('dilemma-card-' + first.id + '-details')).not.toBeNull();
  expect(view.find('dilemma-choice-' + first.id)).not.toBeNull();
  view.click('dilemma-card-' + second.id + '-toggle');
  expect(view.find('dilemma-choice-' + first.id)).not.toBeNull();
  expect(view.find('dilemma-choice-' + second.id)).not.toBeNull();
  view.click('dilemma-card-' + first.id + '-toggle');
  expect(view.find('dilemma-choice-' + first.id)).toBeNull();
  expect(view.find('dilemma-card-' + first.id + '-toggle')?.getAttribute('aria-expanded')).toBe('false');
  view.close();
});
