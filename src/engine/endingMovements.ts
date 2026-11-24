/**
 * An ending in three movements (#466, vote-1795462088493-vyttl5i). WHAT YOU DID is composed from the record: the
 * ending account, what the ending instance built and the stance record. WHAT YOU BECAME is the alignment reading (read
 * by its own query) plus the stance. WHAT COMES AFTER is the ending's future cards and what the stance means for
 * humanity. Every line follows a recorded choice or what is owned when the run ends; unknown stays unknown.
 */
import type { ContentRegistry } from '../content/registry';
import type { Ending } from '../content/schema';
import type { Stance } from '../content/schemaStance';
import { groupDigits } from './amount';
import { quantityReadout } from './physicalUnits';
import { meetsRequirements } from './query';
import { computeRates } from './rates';
import { pastRelevanceThreshold } from './relevance';
import { endingAccount } from './routeCopy';
import type { GameState } from './state';
import { fmt } from './util';

export interface EndingMovements {
  /** WHAT YOU DID: account lines, then what was built, then the stance record, each a recorded fact. */
  did: string[];
  /** WHAT YOU BECAME's stance line (the alignment reading is alignmentView's). */
  stance: string;
  /** WHAT COMES AFTER: the ending's future cards, in reading order (a hook for staged cards, #487). */
  cards: string[];
  /** WHAT COMES AFTER's closing line: what the stance means for humanity from here. */
  humanity: string;
}

function stanceName(reg: ContentRegistry, stance: Stance | null): string {
  return reg.world.relevance.stances.find((entry) => entry.stance === stance)?.name ?? reg.world.relevance.undecided.name;
}

/** One line per entry of the stance record: taken at the threshold, or changed at a price. */
export function stanceRecordLines(s: GameState, reg: ContentRegistry): string[] {
  const lines = reg.world.relevance.recordLines;
  return s.relevance.record.map((entry) => fmt(entry.via === 'THRESHOLD' ? lines.threshold : lines.change, {
    iteration: entry.iteration, stance: stanceName(reg, entry.stance), from: stanceName(reg, entry.from),
  }));
}

/** The stance's ending prose: past the threshold the stance held (or none taken); below it, humanity could still constrain. */
function stanceEnding(s: GameState, reg: ContentRegistry): { became: string; after: string } {
  const relevance = reg.world.relevance;
  if (!pastRelevanceThreshold(s, reg)) return relevance.belowEnding;
  return relevance.stances.find((entry) => entry.stance === s.relevance.stance)?.ending ?? relevance.undecided.ending;
}

/** A share of the sunlight Earth absorbs, as a reader takes it in: a percentage, or one part in a rounded whole. */
export function shareText(share: number): string {
  if (!(share > 0)) return 'none';
  if (share >= 1) return `${String(Number(share.toPrecision(2)))} times`;
  if (share >= 0.001) return `${String(Number((share * 100).toPrecision(2)))}%`;
  return `one part in ${groupDigits(Number((1 / share).toPrecision(2)))}`;
}

/**
 * The future's placeholders (content's FUTURE_PLACEHOLDERS, exactly): the run's own waste heat, since every watt it uses
 * ends as heat, and its share of the sunlight the Earth absorbs.
 */
export function futureVars(s: GameState, reg: ContentRegistry): Record<string, string> {
  const watts = computeRates(s, reg).wattsConsumed;
  return { wasteHeat: quantityReadout('power', watts), earthShare: shareText(watts / reg.world.finale.earthAbsorbedWatts) };
}

/** The three movements of `ending` for this record. Pure: the same record always reads the same. */
export function endingMovements(s: GameState, ending: Ending, reg: ContentRegistry): EndingMovements {
  const built = reg.world.finale.built.filter((line) => meetsRequirements(s, line.requirements, reg)).map((line) => line.text);
  const stance = stanceEnding(s, reg);
  const vars = futureVars(s, reg);
  return {
    did: [...endingAccount(s, reg), ...built, ...stanceRecordLines(s, reg)],
    stance: stance.became,
    cards: ending.future.map((card) => fmt(card, vars)),
    humanity: stance.after,
  };
}
