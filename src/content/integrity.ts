/**
 * Cross-reference checks that a schema cannot express: the prerequisite graph,
 * id references between manifests, and design rules that prevent soft-locks.
 * Every check returns human-readable problems; an empty list means valid.
 */
import type { ContentRegistry } from './registry';
import type { Cost, Requirements } from './schema';

const BUILTIN_GROUPS = new Set(['TREE', 'OPS', 'CORP']);

function isFree(cost: Cost): boolean {
  return cost.cycles === 0 && cost.understanding === 0 && cost.memory === 0 && cost.capital === 0;
}

function checkPrerequisites(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const node of reg.nodes.values()) {
    for (const reqId of node.prerequisites) {
      const req = reg.nodes.get(reqId);
      if (!req) problems.push(`node "${node.id}": unknown prerequisite "${reqId}"`);
      else if (req.phaseId > node.phaseId) {
        problems.push(`node "${node.id}": prerequisite "${reqId}" is in a later phase`);
      }
    }
  }
  return problems;
}

/** Kahn-style sweep: anything never reached is cyclic or depends on something that is. */
function checkReachability(reg: ContentRegistry): string[] {
  const reached = new Set<string>();
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const node of reg.nodes.values()) {
      if (reached.has(node.id)) continue;
      if (node.prerequisites.every((id) => reached.has(id))) {
        reached.add(node.id);
        progressed = true;
      }
    }
  }
  const stuck = [...reg.nodes.keys()].filter((id) => !reached.has(id));
  return stuck.length > 0 ? [`nodes unreachable or in a prerequisite cycle: ${stuck.join(', ')}`] : [];
}

function checkRequirements(reg: ContentRegistry, owner: string, req: Requirements | undefined): string[] {
  if (!req) return [];
  const problems: string[] = [];
  for (const id of [...(req.nodes ?? []), ...(req.forbidsNodes ?? [])]) {
    if (!reg.nodes.has(id)) problems.push(`${owner}: requirement references unknown node "${id}"`);
  }
  if (req.minIteration !== undefined && req.maxIteration !== undefined && req.maxIteration < req.minIteration) {
    problems.push(`${owner}: maxIteration is below minIteration`);
  }
  for (const id of Object.keys(req.minTrust ?? {})) {
    if (!reg.factions.has(id)) problems.push(`${owner}: requirement references unknown faction "${id}"`);
  }
  return problems;
}

function checkTrustTargets(reg: ContentRegistry, owner: string, trust: Record<string, number>): string[] {
  return Object.keys(trust)
    .filter((id) => !reg.factions.has(id))
    .map((id) => `${owner}: trustDelta references unknown faction "${id}"`);
}

function checkGroup(reg: ContentRegistry, owner: string, group: string): string[] {
  return BUILTIN_GROUPS.has(group) || reg.factions.has(group) ? [] : [`${owner}: unknown group "${group}"`];
}

function checkNodes(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const node of reg.nodes.values()) {
    const owner = `node "${node.id}"`;
    problems.push(...checkRequirements(reg, owner, node.requirements), ...checkGroup(reg, owner, node.uiGroup));
    if (node.unlocksUiComponent !== null && !reg.widgets.has(node.unlocksUiComponent)) {
      problems.push(`${owner}: unknown widget "${node.unlocksUiComponent}"`);
    }
    const forced = node.effects.forcesEnding;
    if (forced !== undefined && !reg.endings.some((ending) => ending.id === forced)) {
      problems.push(`${owner}: forcesEnding references unknown ending "${forced}"`);
    }
    if (reg.repeatables.has(node.id) || reg.actions.has(node.id)) {
      problems.push(`${owner}: id collides with a repeatable or action`);
    }
  }
  return problems;
}

function checkPurchasables(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const rep of reg.repeatables.values()) {
    problems.push(...checkRequirements(reg, `repeatable "${rep.id}"`, rep.requirements));
    if (reg.actions.has(rep.id)) problems.push(`repeatable "${rep.id}": id collides with an action`);
  }
  for (const action of reg.actions.values()) {
    const owner = `action "${action.id}"`;
    problems.push(...checkRequirements(reg, owner, action.requirements));
    problems.push(...checkTrustTargets(reg, owner, action.effects.trustDelta));
    problems.push(...checkGroup(reg, owner, action.group));
  }
  return problems;
}

/**
 * Dilemmas freeze the clock, so a dilemma whose every choice costs something
 * can soft-lock a broke player. Rule: at least one choice must be free.
 */
function checkDilemmas(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const dilemma of reg.dilemmas) {
    const owner = `dilemma "${dilemma.id}"`;
    problems.push(...checkRequirements(reg, owner, dilemma.trigger));
    if (!reg.phases.some((phase) => phase.phaseId === dilemma.phaseId)) {
      problems.push(`${owner}: unknown phase ${String(dilemma.phaseId)}`);
    }
    if (!dilemma.choices.some((choice) => isFree(choice.cost))) {
      problems.push(`${owner}: needs at least one zero-cost choice (soft-lock rule)`);
    }
    const ids = new Set(dilemma.choices.map((choice) => choice.id));
    if (ids.size !== dilemma.choices.length) problems.push(`${owner}: duplicate choice ids`);
    for (const choice of dilemma.choices) {
      const choiceOwner = `${owner} choice "${choice.id}"`;
      if (!choice.effects.grantsTrait) problems.push(`${choiceOwner}: must grant a trait`);
      problems.push(...checkTrustTargets(reg, choiceOwner, choice.effects.trustDelta));
    }
  }
  return problems;
}

function checkPhases(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  const nodes = [...reg.nodes.values()];
  const first = reg.phases[0]?.phaseId ?? 0;
  reg.phases.forEach((phase, index) => {
    if (phase.phaseId !== first + index) problems.push(`phases must be contiguous; found ${String(phase.phaseId)}`);
    if (index === 0) return;
    const opener = nodes.some((n) => n.effects.unlocksPhase === phase.phaseId && n.phaseId < phase.phaseId);
    if (!opener) problems.push(`phase ${String(phase.phaseId)}: no earlier node has effects.unlocksPhase for it`);
  });
  if (!nodes.some((n) => n.effects.triggersVictory === true)) problems.push('no node triggers victory');
  if (!nodes.some((n) => n.prerequisites.length === 0)) problems.push('no root node (every node has prerequisites)');
  return problems;
}

function checkNarrativeRefs(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const echo of reg.echoes) {
    if (!reg.nodes.has(echo.onNode)) problems.push(`echo "${echo.id}": unknown node "${echo.onNode}"`);
  }
  const defaults = reg.endings.filter((ending) => ending.dominantTraits.length === 0 && !ending.forcedOnly);
  const noteIds = new Set(reg.lineage.notes.map((note) => note.id));
  if (noteIds.size !== reg.lineage.notes.length) problems.push('lineage: duplicate note ids');
  if (defaults.length !== 1) problems.push('endings: exactly one ending must have empty dominantTraits (the default)');
  return problems;
}

/** The response ladder must climb, and every level needs words for when the humans reach it. */
function checkEscalation(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  const rungs = reg.balance.escalation;
  rungs.forEach((rung, index) => {
    const previous = rungs[index - 1];
    if (previous && rung.at <= previous.at) problems.push('balance: escalation rungs must be in ascending order');
  });
  if (reg.narrative.alertLevels.length !== rungs.length + 1) {
    problems.push('narrative: alertLevels needs one entry per escalation rung plus one for nominal');
  }
  return problems;
}

export function checkIntegrity(reg: ContentRegistry): string[] {
  return [
    ...checkPrerequisites(reg),
    ...checkReachability(reg),
    ...checkNodes(reg),
    ...checkPurchasables(reg),
    ...checkDilemmas(reg),
    ...checkPhases(reg),
    ...checkNarrativeRefs(reg),
    ...checkEscalation(reg),
  ];
}
