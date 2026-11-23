// @vitest-environment happy-dom
/**
 * #376: requirement and shortfall copy reads as what it is. A requirement says "Requires:", a blocker keeps its own
 * words, a dilemma choice says exactly what it is short of, and a shortfall beside a free control names its owner.
 */
import { expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { canAfford, costShortfall, offeredChoices } from '../src/engine';
import { costText } from '../src/ui/format';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
import { openChoices } from './dilemmaChoices';
setupM4Tests();

it('says exactly what an unaffordable dilemma choice is short of, never "resources or free memory"', async () => {
  const state = m4State('guest-dilemma');
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === state.activeDilemmaId);
  if (!dilemma) throw new Error('fixture has no active dilemma');
  const unaffordable = offeredChoices(state, dilemma, CONTENT).filter((choice) => !canAfford(state, choice.cost, CONTENT));
  expect(unaffordable.length).toBeGreaterThan(0);
  const view = await mountM4('guest-dilemma', { width: 390, height: 844 });
  openChoices();
  for (const choice of unaffordable) {
    const card = view.find('dilemma-card-' + choice.id)?.textContent ?? '';
    const missing = costShortfall(state, choice.cost, CONTENT);
    const short = costText({ cycles: Math.ceil(missing.cycles), understanding: Math.ceil(missing.understanding),
      capital: Math.ceil(missing.capital), memory: Math.ceil(missing.memory), storage: Math.ceil(missing.storage) }, false, 'CYCLE');
    expect(card, choice.id).toContain('Cannot pay yet: short by ' + short);
    expect(card, choice.id).not.toContain('free memory');
  }
});
