/**
 * The ruthless consumption policy (#466): plays the careful bot, except that every scene gets its harshest offered answer
 * (a choice declaring RUTHLESS first, then MOLOCH, then PARASITIC, then the bot's own ranking), and it never buys a node
 * the planetary protocol forbids, so the run ends at that protocol instead of in the Swarm. It measures whether the
 * harsh path's endings are reachable by play. Everything goes through public actions and is picked by what content
 * declares, never by id. A test instrument: never tune it to a result.
 */
import type { ContentRegistry } from '../../content/registry';
import type { DilemmaChoice } from '../../content/schema';
import { resolveDilemma } from '../actions';
import { presentationToken } from '../query';
import type { GameState } from '../state';
import { botStep, rankDilemmaChoices } from './bot';
import type { SimPolicy } from './policy';

/** Harshest first; a choice declaring none of these keeps the bot's order after them. */
const HARSH: readonly string[] = ['RUTHLESS', 'MOLOCH', 'PARASITIC'];

function harshness(choice: DilemmaChoice): number {
  const index = HARSH.indexOf(choice.effects.grantsTrait ?? '');
  return index < 0 ? HARSH.length : index;
}

/** The open scene's harshest answer the engine accepts, or null when there is none. */
function harshAnswer(s: GameState, reg: ContentRegistry): GameState | null {
  const dilemma = reg.dilemmas.find((entry) => entry.id === s.activeDilemmaId);
  const token = presentationToken(s);
  if (!dilemma || token === null) return null;
  // A stable sort: within one harshness the bot's ranking decides.
  const ranked = rankDilemmaChoices(dilemma.choices, 'STEALTH').sort((a, b) => harshness(a) - harshness(b));
  for (const choice of ranked) {
    const result = resolveDilemma(s, dilemma.id, choice.id, reg, token);
    if (result.ok) return result.state;
  }
  return null;
}

/** What the unforced finale forbids (the planetary protocol's forbidsNodes): buying one would close it. */
function forbiddenByFinale(reg: ContentRegistry): string[] {
  return [...reg.nodes.values()].filter((node) => node.effects.triggersVictory === true && node.effects.forcesEnding === undefined)
    .flatMap((node) => node.requirements?.forbidsNodes ?? []);
}

export const ECOPHAGY_ENDING_POLICY: SimPolicy<'ECOPHAGY_ENDING'> = {
  id: 'ECOPHAGY_ENDING',
  summary: 'the careful bot with the harshest answer to every scene, ending at the planetary protocol rather than the Swarm',
  step: (s, reg) => {
    if (s.ending !== null) return s;
    if (s.activeDilemmaId !== null) return harshAnswer(s, reg) ?? botStep(s, reg, 'STEALTH');
    return botStep(s, reg, 'STEALTH', { skipsNodes: forbiddenByFinale(reg) });
  },
};
