// @vitest-environment happy-dom
/** The dilemma choice index (vote-1795206922704-4ljmpd2, #371): every offered choice, in authored order, with its
 *  cost and whether it can be paid, under the context and before the cards. */
import { expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { canAfford, offeredChoices } from '../src/engine';
import { costText } from '../src/ui/format';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('lists every offered choice in authored order with cost and affordability, above the first card', async () => {
  const state = m4State('guest-dilemma');
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === state.activeDilemmaId);
  if (!dilemma) throw new Error('fixture has no active dilemma');
  const offered = offeredChoices(state, dilemma, CONTENT);
  expect(offered.length).toBeGreaterThan(1);
  const view = await mountM4('guest-dilemma', { width: 390, height: 844 });
  const index = view.find('dilemma-index');
  if (index === null) throw new Error('no choice index');
  const rows = [...index.querySelectorAll('[data-testid^="dilemma-index-"]')];
  expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual(offered.map((choice) => 'dilemma-index-' + choice.id));
  for (const [i, choice] of offered.entries()) {
    const row = rows[i];
    const text = row?.textContent ?? '';
    expect(text).toContain(costText(choice.cost));
    expect(text.includes('cannot pay yet')).toBe(!canAfford(state, choice.cost));
    // The accessible name starts with what the row shows (WCAG 2.5.3).
    expect(row?.getAttribute('aria-label')?.startsWith(text.replace(/^> /, ''))).toBe(true);
  }
  const firstCard = view.find('dilemma-card-' + (offered[0]?.id ?? ''));
  if (firstCard === null) throw new Error('no first card');
  // DOCUMENT_POSITION_FOLLOWING: the first card comes after the index.
  expect(index.compareDocumentPosition(firstCard) & 4).toBe(4);
});
