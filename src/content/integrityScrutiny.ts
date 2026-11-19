/**
 * Scale scrutiny is validated content (#210). A phase may declare it only where it can matter and where the
 * player can answer it: some capital source exists by that phase (the draw reads net income), and some action
 * or hire that lowers suspicion can be had by then, so the pressure is never one the player has no tool for.
 */
import type { ContentRegistry } from './registry';
import type { Action } from './schema';

/** A node, repeatable or finance flag at or before `phase` that can put capital on the books. */
function capitalBy(reg: ContentRegistry, phase: number): boolean {
  const nodes = [...reg.nodes.values()].filter((node) => node.phaseId <= phase);
  return nodes.some((node) => node.tickDelta.capitalPerSec > 0 || node.systemFlags.includes('ENABLES_CORPORATE_FINANCE'))
    || [...reg.repeatables.values()].some((rep) => rep.phaseId <= phase && rep.perLevel.capitalPerSec > 0);
}

/** Whether an action's own gates can all be met by `phase`: its phase floor and the phases of the nodes it needs. */
function actionBy(reg: ContentRegistry, action: Action, phase: number): boolean {
  const req = action.requirements;
  if (req.phaseAtLeast !== undefined && req.phaseAtLeast > phase) return false;
  return (req.nodes ?? []).every((id) => (reg.nodes.get(id)?.phaseId ?? Infinity) <= phase);
}

/** An action or a hire that lowers suspicion, available by `phase`. */
function answerBy(reg: ContentRegistry, phase: number): boolean {
  return [...reg.actions.values()].some((action) => action.effects.suspicionDelta < 0 && actionBy(reg, action, phase))
    || [...reg.repeatables.values()].some((rep) => rep.phaseId <= phase && rep.perLevel.suspicionPerSec < 0);
}

export function checkScrutinyIntegrity(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const phase of reg.phases) {
    if (phase.scaleScrutiny === undefined) continue;
    const owner = `phase ${String(phase.phaseId)}: scaleScrutiny`;
    if (!capitalBy(reg, phase.phaseId)) problems.push(`${owner} reads net income, but nothing at or before this phase produces capital`);
    if (!answerBy(reg, phase.phaseId)) problems.push(`${owner} has no answer: no action or repeatable that lowers suspicion is available by this phase`);
  }
  return problems;
}
