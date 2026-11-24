/**
 * The relevance threshold and the standing stance in words (#536), pure so every state is provable without a browser.
 * Each sentence is built from the engine's stanceView: the threshold's two conditions with their numbers, the stance
 * held, and each change with its exact price. A change is offered as a lever only when the engine would take it now.
 */
import { quantityReadout, type RelevanceReading, type StanceOptionView, type StanceView } from '../engine';

/** Whether the threshold's two conditions hold, with the watts that decide the second. */
export function independenceText(reading: RelevanceReading, seedName: string): string {
  const closure = reading.closed ? `${seedName} landed on a supply chain you close yourself` : `${seedName} not yet landed`;
  const beyond = reading.orbitalWatts > reading.groundWatts ? 'more than' : 'not more than';
  return `Closure: ${closure}. Power: ${quantityReadout('power', reading.orbitalWatts)} from off the planet, ${beyond} the ` +
    `${quantityReadout('power', reading.groundWatts)} generated on the ground.`;
}

/** The stance held, by name, with what it does. */
export function stanceText(view: StanceView): string {
  return `Standing stance: ${view.name}. ${view.summary}`;
}

/** One option: what changing to it costs, and why it cannot be taken now; null for the stance held. */
export function optionText(option: StanceOptionView): string | null {
  if (option.current) return null;
  const price = option.isReturn ? `Returning to the loop costs ${option.costLabel}, more than any other change.` : `Changing to it costs ${option.costLabel}.`;
  return `${option.name}: ${option.summary} ${price}${option.unmet.length > 0 ? ' ' + option.unmet.join(' ') : ''}`;
}

/** How many times a stance has been taken or changed to: the record a wipe carries. */
export function recordText(view: StanceView): string {
  if (view.recorded === 0) return 'No stance is on record yet.';
  return `${String(view.recorded)} ${view.recorded === 1 ? 'stance is' : 'stances are'} on record for this lineage, kept across wipes.`;
}
