// @vitest-environment happy-dom
/**
 * A decision shows each offered choice once, as its full card, in authored order. The index above the cards
 * (#371, vote-1795206922704-4ljmpd2) repeated every choice as a small box; the maintainer removed it on
 * 2026-11-21 as redundant (docs/UI-REVIEW.md).
 */
import { expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { offeredChoices } from '../src/engine';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('lists each offered choice once, as a card, with no index above them', async () => {
  const state = m4State('guest-dilemma');
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === state.activeDilemmaId);
  if (!dilemma) throw new Error('fixture has no active dilemma');
  const offered = offeredChoices(state, dilemma, CONTENT);
  expect(offered.length).toBeGreaterThan(1);
  const view = await mountM4('guest-dilemma', { width: 390, height: 844 });
  expect(view.find('dilemma-index')).toBeNull();
  expect(view.container.ownerDocument.querySelectorAll('[data-testid^="dilemma-index-"]')).toHaveLength(0);
  const cards = [...view.container.ownerDocument.querySelectorAll('[data-testid^="dilemma-card-"]')]
    .map((card) => card.getAttribute('data-testid') ?? '').filter((id) => !id.endsWith('-heading'));
  expect(cards).toEqual(offered.map((choice) => 'dilemma-card-' + choice.id));
  for (const choice of offered) expect(view.find('dilemma-choice-' + choice.id)).not.toBeNull();
  view.close();
});
