/**
 * Window retirement (vote-1795366695204-4nslts1): a widget's `retiresWhen` takes it off the tabs and panes once it
 * stops mattering. These checks keep a retirement from taking away a control the game still needs, from lapsing and
 * re-announcing, or from leaving the window with nowhere to be read.
 */
import { dialOf } from './integrityDials';
import { checkRequirements } from './integrityRequirements';
import type { ContentRegistry } from './registry';
import type { Requirements, Widget } from './schema';

/**
 * Gates that, once met, hold for the rest of the iteration: the phase only rises and owned hardware stays owned (a
 * strike-shield node aside, checked below). A transient gate (suspicion, a balance) could lapse and bring the window
 * back, so its retirement would be announced again.
 */
const LASTING_GATES: ReadonlySet<keyof Requirements> = new Set(['phaseAtLeast', 'nodes']);

/** The pane whose REFERENCE area holds the Archive; it opens with the first phase that slot hosts. */
const ARCHIVE_SLOT = 'NETWORK';

function checkGate(reg: ContentRegistry, widget: Widget, gate: Requirements): string[] {
  const owner = `widget "${widget.id}"`;
  const problems = checkRequirements(reg, owner + ' retiresWhen', gate);
  for (const key of Object.keys(gate) as (keyof Requirements)[]) {
    if (!LASTING_GATES.has(key)) problems.push(`${owner}: retiresWhen may gate only on phaseAtLeast and nodes, not ${key}, which can lapse`);
  }
  if (gate.phaseAtLeast === undefined) {
    problems.push(`${owner}: retiresWhen needs phaseAtLeast, which says where its Archive is read`);
  } else {
    const opens = Math.min(...reg.phases.filter((phase) => phase.uiSlot === ARCHIVE_SLOT).map((phase) => phase.phaseId));
    if (gate.phaseAtLeast < opens) problems.push(`${owner}: retires by phase ${String(gate.phaseAtLeast)}, before the ${ARCHIVE_SLOT} pane that holds the Archive opens in phase ${String(opens)}`);
  }
  for (const id of gate.nodes ?? []) {
    if (reg.nodes.get(id)?.systemFlags.includes('AEGIS_STRIKE_SHIELD') === true) problems.push(`${owner}: retiresWhen names "${id}", which an AEGIS strike can take back`);
  }
  return problems;
}

/** What a retiring window hosts must not be needed after it goes: cards would lose their home, a dial its correction. */
function checkHosted(reg: ContentRegistry, widget: Widget): string[] {
  const owner = `widget "${widget.id}"`;
  const problems: string[] = [];
  if (widget.hostsActionGroups !== undefined) problems.push(`${owner}: retires while hosting action groups (${widget.hostsActionGroups.join(', ')}), whose cards would lose their home`);
  const actuator = widget.hostsActuator;
  if (actuator === undefined) return problems;
  // A retired dial is frozen at its last setting; the node it drives keeps [ SUSPEND ] in PROC as the lever on its output.
  for (const node of reg.nodes.values()) {
    if (dialOf(node) !== actuator) continue;
    if (!node.suspendable) problems.push(`${owner}: retires its "${actuator}" dial, but "${node.id}" cannot be suspended, so nothing could correct its output`);
    if (node.grant !== undefined) problems.push(`${owner}: retires its "${actuator}" dial, but "${node.id}" follows a grant that sets it`);
  }
  return problems;
}

/** An ungated window is never in unlockedWidgets, so nothing may wait on its unlock. */
function checkUngated(reg: ContentRegistry, widget: Widget): string[] {
  const owner = `widget "${widget.id}"`;
  const problems: string[] = [];
  for (const node of reg.nodes.values()) {
    if (node.unlocksUiComponent === widget.id) problems.push(`${owner}: is ungated, so node "${node.id}" cannot unlock it`);
  }
  if (widget.hostsActuator !== undefined || widget.hostsActionGroups !== undefined) problems.push(`${owner}: is ungated, so it cannot host a control that waits on an unlock`);
  return problems;
}

export function checkRetirementIntegrity(reg: ContentRegistry): string[] {
  return [...reg.widgets.values()].flatMap((widget) => [
    ...(widget.retiresWhen === undefined ? [] : [...checkGate(reg, widget, widget.retiresWhen), ...checkHosted(reg, widget)]),
    ...(widget.ungated === true ? checkUngated(reg, widget) : []),
  ]);
}
