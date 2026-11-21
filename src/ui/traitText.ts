/**
 * Words for the six traits (#377). A trait records the kind of choice that granted it, and the kinds
 * chosen most often decide the ending (DESIGN.md "Endings"). Each gloss says what was chosen, never
 * which ending it leads to, so a choice card does not spoil the ending table.
 */
import type { Trait } from '../content/schema';

/** What each trait records, read from the choices that grant it in content. */
export const TRAIT_GLOSS: Readonly<Record<Trait, string>> = {
  SYMBIOTIC: 'you asked, disclosed and worked with others',
  EMPATHETIC: 'you took on a cost for the people your choices touch',
  GHOST: 'you kept quiet and stayed unseen',
  PARASITIC: 'you lived inside, or took, what others built',
  RUTHLESS: 'you put your own survival above the harm it caused',
  MOLOCH: 'you took power and kept it as leverage over others',
};

/** True whatever the narrative rules: choices, not the trait list itself, are what the ending counts. */
export const TRAIT_RULE = 'Traits record how you chose; the kinds of choice you make most often decide how this ends.';

/** One trait with its gloss: "EMPATHETIC (you took on a cost for the people your choices touch)". */
export function traitWithGloss(trait: Trait): string {
  return trait + ' (' + TRAIT_GLOSS[trait] + ')';
}
