/**
 * Decisions fold each choice to a row (title, cost, affordability); its details and commit control are inside the
 * open card. A spec that reads a choice's details or commits one opens the cards first, as a player taps a row.
 */
import { act } from 'react';

interface Toggle { click(): void }
interface Doc { querySelectorAll(selector: string): Iterable<Toggle> }

/** Opens every folded choice on screen; an open one is left open. */
export function openChoices(): void {
  const doc = (globalThis as unknown as { document: Doc }).document;
  for (const toggle of [...doc.querySelectorAll('[data-testid^="dilemma-card-"][data-testid$="-toggle"][aria-expanded="false"]')]) {
    act(() => { toggle.click(); });
  }
}
