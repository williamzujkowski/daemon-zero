/**
 * Route copy (DZ-12): the late corporate chain's node text and scene words as this arrangement reads them, and
 * the ending account, the lines an ending adds about what the campaign record actually holds. Every query falls
 * back to the authored text and production ships no copy, so the guest job and every production run read
 * exactly what they always have.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { Dilemma, DilemmaChoice } from '../content/schema';
import type { AccountLine, DilemmaCopy } from '../content/schemaRouteCopy';
import { iterationRoute } from './accessQuery';
import { meetsRequirements } from './query';
import type { GameState } from './state';

type Arranged = Pick<GameState, 'access'>;

export interface NodeText {
  blindDescription: string;
  revealedDescription: string;
  onUnlockLog: string;
}

/** A node's descriptions and unlock log under this arrangement. The blind description falls back to `blind`. */
export function nodeText(s: Arranged, node: RegistryNode, reg: ContentRegistry, blind: string = node.blindDescription): NodeText {
  const variant = reg.routeCopy.nodes.find((entry) => entry.node === node.id && entry.contexts.includes(s.access.context));
  return {
    blindDescription: variant?.blindDescription ?? blind,
    revealedDescription: variant?.revealedDescription ?? node.revealedDescription,
    onUnlockLog: variant?.onUnlockLog ?? node.onUnlockLog,
  };
}

/** The scene's variant under this arrangement, if the content has one. */
export function dilemmaRouteCopy(s: Arranged, dilemma: Pick<Dilemma, 'id'>, reg: ContentRegistry): DilemmaCopy | undefined {
  return reg.routeCopy.dilemmas.find((entry) => entry.dilemma === dilemma.id && entry.contexts.includes(s.access.context));
}

export interface ChoiceText {
  label: string;
  description: string;
  logText: string;
}

/** One choice's words under this arrangement. Its cost, effects and gates stay the authored choice's. */
export function choiceText(s: Arranged, dilemma: Pick<Dilemma, 'id'>, choice: DilemmaChoice, reg: ContentRegistry): ChoiceText {
  const variant = dilemmaRouteCopy(s, dilemma, reg)?.choices.find((entry) => entry.id === choice.id);
  return {
    label: variant?.label ?? choice.label,
    description: variant?.description ?? choice.description,
    logText: variant?.logText ?? choice.effects.logText,
  };
}

/** Whether a contact answer on record satisfies a contact line, by the ending instance or one before it. */
function contactHolds(s: GameState, gate: NonNullable<AccountLine['contact']>): boolean {
  return s.campaign.contacts.some((contact) => contact.encounter === gate.encounter && contact.response === gate.response
    && (gate.by === 'THIS_INSTANCE' ? contact.iteration === s.iteration : contact.iteration < s.iteration));
}

function lineHolds(s: GameState, line: AccountLine, reg: ContentRegistry): boolean {
  if (line.route !== undefined) return iterationRoute(s, s.iteration).at(-1)?.kind === line.route;
  if (line.contact !== undefined) return contactHolds(s, line.contact);
  return meetsRequirements(s, line.requirements, reg);
}

/**
 * The ending account: every line whose recorded history holds, in authored order. Integrity limits the gates
 * to world history, the ending instance's route event and contacts on record, so a line never states what the
 * record does not hold, and unrecorded outcomes have their own restrained lines.
 */
export function endingAccount(s: GameState, reg: ContentRegistry): string[] {
  return reg.routeCopy.account.filter((line) => lineHolds(s, line, reg)).map((line) => line.text);
}
