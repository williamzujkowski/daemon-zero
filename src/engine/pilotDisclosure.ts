/**
 * The disclosure step of accepting a pilot (nexus vote dz-d9, disclose-and-stop-at-acceptance,
 * vote-1794967752663-5qklwcz). Kept apart from the offer so the rule has one owner: accepting
 * discloses every owned output the terms do not permit and stops it, and the offer record keeps the
 * list. Promotion never legalizes that output (DECISIONS D2); the instance keeps what it mapped.
 */
import type { ContentRegistry } from '../content/registry';
import type { PilotTerms } from '../content/schemaPilot';
import type { GameState } from './state';
import { releaseStorage } from './storage';
import { fmt, pushLog } from './util';

/**
 * Draft-only. Suspends each owned node the terms name, releasing its memory as an ordinary
 * suspension does, logs the disclosure and returns the disclosed ids in the terms' order. A node
 * already suspended is still disclosed: owning it is what the evaluator is told about.
 */
export function discloseIncompatibleOutput(d: GameState, terms: PilotTerms, reg: ContentRegistry): string[] {
  const disclosed: string[] = [];
  for (const id of terms.incompatibleOutput) {
    const node = reg.nodes.get(id);
    if (!node || !d.unlockedNodes.includes(id)) continue;
    if (!d.disabledNodes.includes(id)) {
      d.disabledNodes = [...d.disabledNodes, id];
      d.memoryUsed = Math.max(0, d.memoryUsed - node.cost.memory);
      releaseStorage(d, node);
    }
    pushLog(d, reg, fmt(terms.disclosureLog, { name: node.revealedName }), 'SYS');
    disclosed.push(id);
  }
  return disclosed;
}
