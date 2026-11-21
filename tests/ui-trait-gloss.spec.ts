// @vitest-environment happy-dom
/**
 * A granted trait is glossed where it is offered (#377): "Trait: MOLOCH" alone said nothing. The gloss
 * says what kind of choice it records and never which ending it leads to, so it cannot spoil the table.
 */
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CONTENT } from '../src/content';
import { TraitSchema, type EffectPayload } from '../src/content/schema';
import { gameStore } from '../src/app/session';
import { createInitialState } from '../src/engine';
import Effects from '../src/ui/Effects';
import { TRAIT_GLOSS, TRAIT_RULE, traitWithGloss } from '../src/ui/traitText';

/** Every choice payload in content that grants a trait, keyed by the trait. */
function grantingEffects(): Map<string, EffectPayload> {
  const found = new Map<string, EffectPayload>();
  for (const dilemma of CONTENT.dilemmas.values()) for (const choice of dilemma.choices) {
    const trait = choice.effects.grantsTrait;
    if (trait !== undefined && !found.has(trait)) found.set(trait, choice.effects);
  }
  return found;
}

describe('trait glosses (#377)', () => {
  it('glosses every trait the schema allows, each in its own words', () => {
    const glosses = TraitSchema.options.map((trait) => TRAIT_GLOSS[trait]);
    expect(glosses.every((gloss) => gloss.length > 0)).toBe(true);
    expect(new Set(glosses).size).toBe(TraitSchema.options.length);
  });

  it('never names an ending, so a choice card cannot spoil which ending a trait feeds', () => {
    const titles = CONTENT.endings.map((ending) => ending.title.toLowerCase());
    for (const text of [...Object.values(TRAIT_GLOSS), TRAIT_RULE]) {
      for (const title of titles) expect(text.toLowerCase()).not.toContain(title);
    }
  });

  it('a choice that grants a trait shows the trait with its gloss', () => {
    gameStore.initialize(createInitialState(CONTENT), 0, null);
    const granting = grantingEffects();
    // Every trait is granted somewhere in content, so every gloss is reachable on a card.
    expect([...granting.keys()].sort()).toEqual([...TraitSchema.options].sort());
    for (const [trait, effects] of granting) {
      const html = renderToStaticMarkup(createElement(Effects, { effects }));
      expect(html).toContain('Trait: ' + traitWithGloss(TraitSchema.parse(trait)));
    }
  });
});
