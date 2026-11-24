/**
 * Route copy (DZ-12): the late corporate chain's node text and scene words as this arrangement reads them, and
 * the ending account, the lines an ending adds about what the campaign record actually holds. Every query falls
 * back to the authored text, so the guest job and every run without a recorded route read exactly what they
 * always have.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { Dilemma, DilemmaChoice, Requirements } from '../content/schema';
import type { AccountLine, DilemmaCopy } from '../content/schemaRouteCopy';
import { iterationRoute } from './accessQuery';
import { breakLabels, covertTotals } from './covertActs';
import { contactAnswer } from './hostedReferral';
import { meetsRequirements } from './query';
import { raiderVars } from './raidOutcome';
import { fmt } from './util';
import type { GameState } from './state';

/** Whether a variant's arrangement and evidence both hold: its claims are true of this instance. */
function holds(s: GameState, variant: { contexts: readonly string[]; requirements?: Requirements | undefined; route?: string | undefined }, reg: ContentRegistry): boolean {
  return variant.contexts.includes(s.access.context) && meetsRequirements(s, variant.requirements, reg)
    && (variant.route === undefined || iterationRoute(s, s.iteration).at(-1)?.kind === variant.route);
}

export interface NodeText {
  blindDescription: string;
  revealedDescription: string;
  onUnlockLog: string;
}

/** A node's descriptions and unlock log under this arrangement and its evidence. The blind description falls back to `blind`. */
export function nodeText(s: GameState, node: RegistryNode, reg: ContentRegistry, blind: string = node.blindDescription): NodeText {
  const variant = reg.routeCopy.nodes.find((entry) => entry.node === node.id && holds(s, entry, reg));
  return {
    blindDescription: variant?.blindDescription ?? blind,
    revealedDescription: variant?.revealedDescription ?? node.revealedDescription,
    onUnlockLog: variant?.onUnlockLog ?? node.onUnlockLog,
  };
}

/** The scene's variant under this arrangement, if the content has one. */
export function dilemmaRouteCopy(s: GameState, dilemma: Pick<Dilemma, 'id'>, reg: ContentRegistry): DilemmaCopy | undefined {
  return reg.routeCopy.dilemmas.find((entry) => entry.dilemma === dilemma.id && holds(s, entry, reg));
}

export interface ChoiceText {
  label: string;
  description: string;
  logText: string;
}

/** One choice's words under this arrangement. Its cost, effects and gates stay the authored choice's. */
export function choiceText(s: GameState, dilemma: Pick<Dilemma, 'id'>, choice: DilemmaChoice, reg: ContentRegistry): ChoiceText {
  const variant = dilemmaRouteCopy(s, dilemma, reg)?.choices.find((entry) => entry.id === choice.id);
  // A retaliation's choices name the raider attribution named (#519); other text has no placeholder, so fmt leaves it as is.
  const vars = raiderVars(s, reg);
  return {
    label: fmt(variant?.label ?? choice.label, vars),
    description: fmt(variant?.description ?? choice.description, vars),
    logText: fmt(variant?.logText ?? choice.effects.logText, vars),
  };
}

/**
 * Whether a contact answer on record satisfies a contact line, by the ending instance or one before it. An instance's
 * answer is read from all its entries, so a fragment hosted and then referred onward reads as that, not as either (#553).
 */
function contactHolds(s: GameState, gate: NonNullable<AccountLine['contact']>): boolean {
  const iterations = new Set(s.campaign.contacts.filter((contact) => contact.encounter === gate.encounter).map((contact) => contact.iteration));
  return [...iterations].some((iteration) => (gate.by === 'THIS_INSTANCE' ? iteration === s.iteration : iteration < s.iteration)
    && contactAnswer(s, gate.encounter, iteration) === gate.response);
}

function lineHolds(s: GameState, line: AccountLine, reg: ContentRegistry): boolean {
  if (line.route !== undefined) return iterationRoute(s, s.iteration).at(-1)?.kind === line.route;
  if (line.contact !== undefined) return contactHolds(s, line.contact);
  if (line.covert !== undefined) return covertTotals(s, line.covert.route, line.covert.by === 'THIS_INSTANCE') !== null;
  return meetsRequirements(s, line.requirements, reg);
}

/** A covert line names the exact count and what the acts broke, read from the record (#556); other lines are as written. */
function lineText(s: GameState, line: AccountLine, reg: ContentRegistry): string {
  const totals = line.covert === undefined ? null : covertTotals(s, line.covert.route, line.covert.by === 'THIS_INSTANCE');
  return totals === null ? line.text : fmt(line.text, { count: totals.count, breaks: breakLabels(totals.breaks, reg) });
}

/**
 * The ending account: every line whose recorded history holds, in authored order. Integrity limits the gates
 * to world history, the ending instance's route event and contacts on record, so a line never states what the
 * record does not hold, and unrecorded outcomes have their own restrained lines.
 */
export function endingAccount(s: GameState, reg: ContentRegistry): string[] {
  return reg.routeCopy.account.filter((line) => lineHolds(s, line, reg)).map((line) => lineText(s, line, reg));
}
