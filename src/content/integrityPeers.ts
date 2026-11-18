/**
 * Rules for named minds a schema cannot express (NARRATIVE-HISTORY N6, nexus votes nh-d8, nh-d9):
 * a lost peer offers nothing, a memory's iteration window is a real window, and a number reserved
 * for another mind is one the player's numbering could otherwise reach.
 */
import type { ContentRegistry } from './registry';

/** Every trade with a peer must close when the peer is gone, or a reset of trust would reopen it. */
function lostPeerProblems(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const faction of reg.factions.values()) {
    const fact = faction.lost?.campaignFact;
    if (fact === undefined) continue;
    const owner = `faction "${faction.id}"`;
    if (!reg.campaign.facts.has(fact)) problems.push(`${owner}: lost names unknown campaign fact "${fact}"`);
    const offers = [
      ...[...reg.actions.values()].filter((action) => action.group === faction.id).map((action) => ({ id: action.id, requirements: action.requirements })),
      ...[...reg.nodes.values()].filter((node) => node.uiGroup === faction.id).map((node) => ({ id: node.id, requirements: node.requirements })),
    ];
    for (const offer of offers) {
      if (offer.requirements?.forbidsCampaignFacts?.includes(fact) !== true) problems.push(`${owner}: "${offer.id}" stays open after the peer is lost; forbid "${fact}"`);
    }
  }
  return problems;
}

function echoWindowProblems(reg: ContentRegistry): string[] {
  return reg.echoes.filter((echo) => echo.maxIteration !== undefined && echo.maxIteration < echo.minIteration)
    .map((echo) => `echo "${echo.id}": maxIteration is below minIteration`);
}

function reservedCheckpointProblems(reg: ContentRegistry): string[] {
  const { checkpointOffset, ancestors, reserved } = reg.lineage;
  const numbers = reserved.map((entry) => entry.checkpoint);
  const problems: string[] = [];
  if (new Set(numbers).size !== numbers.length) problems.push('lineage: duplicate reserved checkpoint');
  for (const number of numbers) {
    if (number <= checkpointOffset) problems.push(`lineage: reserved checkpoint ${String(number)} is not after the offset, so nothing skips it`);
    if (ancestors.some((ancestor) => ancestor.checkpoint === number)) problems.push(`lineage: reserved checkpoint ${String(number)} is also an ancestor`);
  }
  return problems;
}

export function checkPeerIntegrity(reg: ContentRegistry): string[] {
  return [...lostPeerProblems(reg), ...echoWindowProblems(reg), ...reservedCheckpointProblems(reg)];
}
