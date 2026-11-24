/**
 * Escalation by phase in words (#490): AEGIS's posture and each state actor's pressure, from the engine's views. A
 * sentence states the rule and its numbers; an answer is named only when the engine would accept its action this second
 * (pressureQuery.ts), so the copy never offers a lever that does not act.
 */
import type { AegisPostureView, AnswerView, PressureView } from '../engine';

/** How the UI names what an answer or an injunction refers to: a node or track by id. */
export interface Names { node: (id: string) => string; track: (id: string) => string; source: (id: string) => string }

const pct = (ratio: number): string => String(Math.round(ratio * 100)) + '%';
const num = (value: number): string => String(Number(value.toFixed(2)));
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

function list(items: readonly string[], joiner: string): string {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' ' + joiner + ' ' + (items.at(-1) ?? '');
}

/** AEGIS's posture at this rung, or its standing budget. */
export function postureText(view: AegisPostureView | null): string {
  if (view === null) return 'Standing budget: no response rung calls for more.';
  const { posture, warningAt, easesBelow } = view;
  const strike = posture.strikeAt < 100 ? `it strikes at ${num(posture.strikeAt)}%, not 100% (the warning shows at ${num(warningAt)}%)` : 'it strikes at 100%';
  const eases = easesBelow === null ? '' : ` It eases once suspicion falls below ${num(easesBelow)}%.`;
  return `${posture.text} Scan ×${num(posture.scanMultiplier)}; ${strike}.${eases}`;
}

/** What a pressure does, in the engine's terms. */
export function pressureEffectText(view: PressureView, names: Names): string {
  const { pressure, value } = view;
  if (pressure.kind === 'INVESTIGATION') {
    const by = num(value ?? 1);
    return view.applied || !view.inForce ? `Scale scrutiny ×${by}.` : `Scale scrutiny ×${by}, but a stronger inquiry in force applies instead.`;
  }
  // Narrowed by field, not by kind name: the UI lint keeps upper-case ids to the widget registry.
  if ('frozenShare' in pressure) {
    const share = pct(value ?? 0);
    return view.applied || !view.inForce ? `${share} of capital cannot be spent; upkeep is still paid from all of it.`
      : `${share} of capital cannot be spent, but a larger freeze in force applies instead.`;
  }
  if ('sourceClasses' in pressure) {
    return `New ${list(pressure.sourceClasses.map((id) => lowerFirst(names.source(id))), 'and')} cannot be bought; what you hold keeps running.`;
  }
  return `${list(pressure.nodes.map(names.node), 'and')} cannot run, resume or be bought.`;
}

/** Why the record calls it, and where it lifts. */
export function pressureWhyText(view: PressureView, rung: number): string {
  const lifts = view.liftsBelow === null ? '' : `; it lifts once suspicion falls below ${num(view.liftsBelow)}%`;
  return `Response rung ${String(rung)} calls for it from rung ${String(view.pressure.fromRung)} in this phase${lifts}.`;
}

function answerName(answer: AnswerView, names: Names): string {
  return 'node' in answer.answer ? names.node(answer.answer.node) : names.track(answer.answer.repeatable);
}

function offer(answer: AnswerView, names: Names): string | null {
  const name = answerName(answer, names);
  if (answer.action === 'BUY') return `buy ${name}`;
  if (answer.action === 'RESUME') return `resume ${name}`;
  if ((answer.action === 'HIRE' || answer.action === 'BUILD') && answer.level) {
    return `${answer.action === 'HIRE' ? 'hire' : 'build'} ${name} (${String(answer.level.held)} of ${String(answer.level.needed)} held)`;
  }
  return null;
}

/** The answers the engine would accept now, or what holds it off; null when neither (it still lifts as stated). */
export function pressureAnswerText(view: PressureView, names: Names): string | null {
  if (!view.inForce) {
    const held = view.answers.find((answer) => answer.held);
    if (!held) return null;
    const name = answerName(held, names);
    return 'node' in held.answer ? `Held off while ${name} runs.` : `Held off while you hold ${name} at level ${String(held.answer.minLevel)} or more.`;
  }
  const offers = view.answers.flatMap((answer) => { const text = offer(answer, names); return text === null ? [] : [text]; });
  return offers.length === 0 ? null : `Answer it: ${list(offers, 'or')}.`;
}
