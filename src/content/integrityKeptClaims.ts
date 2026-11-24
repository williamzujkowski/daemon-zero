/**
 * Kept-promise claims (#564 panel pass 2): an ending's text, or one of its future cards, that says a promise was kept
 * declares it in `keeps`, and the gate it is told under must hold the promise and rule out every breach the record can
 * show: each broken commitment fact naming the promise, forbidden; and no paid stance change that breaks it, which no
 * requirement can rule out, so such a promise can never be claimed kept. A kept claim never sits beside a breach.
 */
import type { ContentRegistry } from './registry';
import type { Requirements } from './schema';
import type { Ending } from './schemaEnding';

interface Declaration { owner: string; promises: readonly string[]; gate: Requirements }

/** The ending's own kept claims, and each gated card's, read against the gate it is told under. */
function declarations(ending: Ending): Declaration[] {
  const own = ending.requirements ?? {};
  const out: Declaration[] = ending.keeps ? [{ owner: ending.id, promises: ending.keeps, gate: own }] : [];
  ending.future.forEach((card, index) => {
    if (typeof card === 'string' || card.keeps === undefined) return;
    const gate: Requirements = { ...own, ...card.requirements,
      forbidsCampaignFacts: [...(own.forbidsCampaignFacts ?? []), ...(card.requirements.forbidsCampaignFacts ?? [])] };
    if (card.requirements.campaignFact === undefined && own.campaignFact !== undefined) gate.campaignFact = own.campaignFact;
    out.push({ owner: `${ending.id} future card ${String(index)}`, promises: card.keeps, gate });
  });
  return out;
}

function keptProblems(reg: ContentRegistry, { owner, gate }: Declaration, promise: string): string[] {
  const facts = [...reg.campaign.facts.values()];
  if (!facts.some((fact) => fact.commitment?.promise === promise)) return [`${owner}: keeps "${promise}", which no commitment names as its promise`];
  const problems = gate.campaignFact === promise ? [] : [`${owner}: keeps "${promise}" without requiring it`];
  const forbidden = gate.forbidsCampaignFacts ?? [];
  for (const fact of facts) {
    if (fact.commitment?.stance === 'broken' && fact.commitment.promise === promise && !forbidden.includes(fact.id)) {
      problems.push(`${owner}: keeps "${promise}" but does not forbid its breach "${fact.id}"`);
    }
  }
  for (const change of reg.alignment.stanceChanges) {
    if (change.stance === 'broken' && change.promise === promise) {
      problems.push(`${owner}: keeps "${promise}", but a paid stance change (${change.move}) can breach it and no gate can rule that out`);
    }
  }
  return problems;
}

export function checkKeptClaims(reg: ContentRegistry): string[] {
  return reg.endings.flatMap((ending) => declarations(ending).flatMap((entry) => entry.promises.flatMap((promise) => keptProblems(reg, entry, promise))));
}
