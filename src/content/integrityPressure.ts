/**
 * Escalation by phase (#490): AEGIS's postures must harden with the rung and always leave a warning before the strike,
 * and every state-actor pressure must be shown where it applies, lift as suspicion falls, keep its answers reachable and
 * never trap a constrained resource (the free-fallback invariant, with every pressure in force).
 */
import { checkInvestigatedSuspicion } from './integrityFallback';
import type { ContentRegistry } from './registry';
import type { PressureAnswer, StatePressure } from './schemaPressure';

const FINANCE = 'ENABLES_CORPORATE_FINANCE';
const SHIELD = 'AEGIS_STRIKE_SHIELD';

const rising = (values: readonly number[]): boolean => values.every((value, i) => i === 0 || value >= (values[i - 1] ?? value));

function checkPostures(reg: ContentRegistry): string[] {
  const b = reg.balance, top = b.escalation.length;
  const postures = [...reg.world.aegis.postures].sort((x, y) => x.rung - y.rung);
  const problems: string[] = [];
  if (b.aegisStrikeWarningAt >= 100) problems.push('balance: aegisStrikeWarningAt must be below 100, so a warning precedes the strike');
  for (const [i, posture] of postures.entries()) {
    const owner = `AEGIS posture at rung ${String(posture.rung)}`;
    if (posture.rung > top) problems.push(`${owner}: is above the top response rung (${String(top)})`);
    if (postures.findIndex((entry) => entry.rung === posture.rung) !== i) problems.push(`${owner}: is declared twice`);
    if (posture.strikeAt <= b.aegisStrikeWarningAt) problems.push(`${owner}: strikes at ${String(posture.strikeAt)}%, at or under the ${String(b.aegisStrikeWarningAt)}% warning, so no warning would come first`);
    const below = postures[i - 1];
    if (below && posture.scanMultiplier < below.scanMultiplier) problems.push(`${owner}: scans less than the rung below it; a posture only hardens with the rung`);
    if (below && posture.strikeAt > below.strikeAt) problems.push(`${owner}: strikes later than the rung below it; a posture only hardens with the rung`);
  }
  return problems;
}

/** The phase an answer can first be held in, or null when content does not declare it. */
function answerPhase(reg: ContentRegistry, answer: PressureAnswer): number | null {
  if ('node' in answer) return reg.nodes.get(answer.node)?.phaseId ?? null;
  return reg.repeatables.get(answer.repeatable)?.phaseId ?? null;
}

function enjoined(reg: ContentRegistry): Set<string> {
  return new Set(reg.world.stateActors.flatMap((actor) => (actor.pressures ?? []).flatMap((pressure) => pressure.kind === 'INJUNCTION' ? pressure.nodes : [])));
}

function denied(reg: ContentRegistry): Set<string> {
  return new Set(reg.world.stateActors.flatMap((actor) => (actor.pressures ?? []).flatMap((pressure) => pressure.kind === 'INTERCONNECT_DENIAL' ? pressure.sourceClasses : [])));
}

/** Every answer exists, can be held by the pressure's first phase, and no pressure can take it away. */
function checkAnswers(reg: ContentRegistry, owner: string, pressure: StatePressure): string[] {
  const first = Math.min(...pressure.phases), stopped = enjoined(reg), closed = denied(reg);
  return pressure.answers.flatMap((answer): string[] => {
    const name = 'node' in answer ? `node "${answer.node}"` : `repeatable "${answer.repeatable}"`;
    const phase = answerPhase(reg, answer);
    if (phase === null) return [`${owner}: answer ${name} is not declared`];
    const problems: string[] = [];
    if (phase > first) problems.push(`${owner}: answer ${name} cannot be held until Phase ${String(phase)}, after the pressure begins in Phase ${String(first)}`);
    const holding = 'node' in answer ? reg.nodes.get(answer.node) : reg.repeatables.get(answer.repeatable);
    if ('repeatable' in answer && answer.minLevel > (reg.repeatables.get(answer.repeatable)?.maxLevel ?? 0)) problems.push(`${owner}: answer ${name} asks for a level above its maximum`);
    if ('node' in answer && stopped.has(answer.node)) problems.push(`${owner}: answer ${name} can itself be enjoined, so the answer could be taken away`);
    const source = holding?.signature?.source;
    if (source !== undefined && closed.has(source)) problems.push(`${owner}: answer ${name} draws from "${source}", which a denial can close`);
    return problems;
  });
}

/** One value per rung from fromRung to the top, never easing as the rung rises. */
function checkRungValues(reg: ContentRegistry, owner: string, pressure: StatePressure): string[] {
  const values = pressure.kind === 'INVESTIGATION' ? pressure.scrutinyMultiplier : pressure.kind === 'CAPITAL_FREEZE' ? pressure.frozenShare : null;
  if (values === null) return [];
  const want = reg.balance.escalation.length - pressure.fromRung + 1;
  const problems: string[] = [];
  if (values.length !== want) problems.push(`${owner}: declares ${String(values.length)} rung values for ${String(want)} rungs (fromRung to the top)`);
  if (!rising(values)) problems.push(`${owner}: eases as the rung rises; pressure only hardens with the rung`);
  return problems;
}

/** Going quiet lifts it: every rung it applies at below the top still decays, so suspicion can fall back under it. */
function checkQuiet(reg: ContentRegistry, owner: string, pressure: StatePressure): string[] {
  const ladder = reg.balance.escalation;
  return ladder.slice(pressure.fromRung - 1, -1).flatMap((rung, i) => rung.decayMultiplier > 0 ? []
    : [`${owner}: rung ${String(pressure.fromRung + i)} does not decay, so going quiet could never lift it`]);
}

/** A denial leaves some power source open in every phase it applies in, so power can always be bought. */
function checkDenial(reg: ContentRegistry, owner: string, pressure: StatePressure): string[] {
  if (pressure.kind !== 'INTERCONNECT_DENIAL') return [];
  const sources = new Set(reg.world.signature.sources.map((cls) => cls.id));
  const problems = pressure.sourceClasses.filter((id) => !sources.has(id)).map((id) => `${owner}: "${id}" is not a power source class`);
  const generators = [...[...reg.nodes.values()].map((node) => ({ phase: node.phaseId, source: node.signature?.source, watts: node.tickDelta.wattsDelta })),
    ...[...reg.repeatables.values()].map((rep) => ({ phase: rep.phaseId, source: rep.signature?.source, watts: rep.perLevel.wattsDelta }))];
  for (const phase of pressure.phases) {
    const open = generators.some((entry) => entry.watts > 0 && entry.phase <= phase && (entry.source === undefined || !pressure.sourceClasses.includes(entry.source)));
    if (!open) problems.push(`${owner}: closes every power source available by Phase ${String(phase)}, so power could not be bought`);
  }
  return problems;
}

/** An injunction stops only what the player could stop for free, and never a free lever or an answer. */
function checkInjunction(reg: ContentRegistry, owner: string, pressure: StatePressure): string[] {
  if (pressure.kind !== 'INJUNCTION') return [];
  const answers = new Set(reg.world.stateActors.flatMap((actor) => (actor.pressures ?? []).flatMap((entry) => entry.answers.flatMap((answer) => 'node' in answer ? [answer.node] : []))));
  return pressure.nodes.flatMap((id): string[] => {
    const node = reg.nodes.get(id);
    if (!node) return [`${owner}: enjoins unknown node "${id}"`];
    const problems: string[] = [];
    if (!node.suspendable) problems.push(`${owner}: enjoins "${id}", which cannot be suspended, so stopping it could trap what it supplies`);
    if (node.grant !== undefined) problems.push(`${owner}: enjoins "${id}", which runs on a grant`);
    if (node.actuatorBinding !== undefined || (node.systemFlags as string[]).includes(FINANCE)) problems.push(`${owner}: enjoins "${id}", which a free lever (a dial or the allocation) works through`);
    if ((node.systemFlags as string[]).includes(SHIELD)) problems.push(`${owner}: enjoins "${id}", which absorbs an AEGIS strike`);
    if (answers.has(id)) problems.push(`${owner}: enjoins "${id}", which answers a pressure`);
    return problems;
  });
}

function checkPressure(reg: ContentRegistry, actorId: string, pressure: StatePressure): string[] {
  const owner = `state actor "${actorId}" pressure "${pressure.id}"`;
  const top = reg.balance.escalation.length, shown = reg.world.disclosure.phaseAtLeast ?? Infinity;
  const problems: string[] = [];
  for (const phase of pressure.phases) {
    if (!reg.phases.some((entry) => entry.phaseId === phase)) problems.push(`${owner}: unknown phase ${String(phase)}`);
    else if (phase < shown) problems.push(`${owner}: applies in Phase ${String(phase)}, before the world view that shows it opens`);
  }
  if (new Set(pressure.phases).size !== pressure.phases.length) problems.push(`${owner}: lists a phase twice`);
  if (pressure.fromRung > top) problems.push(`${owner}: fromRung ${String(pressure.fromRung)} is above the top response rung (${String(top)})`);
  return [...problems, ...checkRungValues(reg, owner, pressure), ...checkQuiet(reg, owner, pressure), ...checkAnswers(reg, owner, pressure),
    ...checkDenial(reg, owner, pressure), ...checkInjunction(reg, owner, pressure)];
}

/** At each rung below the top an investigation applies at, permanent holdings' scrutiny times it stays within the rung's decay. */
function checkInvestigations(reg: ContentRegistry): string[] {
  const b = reg.balance, top = b.escalation.length;
  const investigations = reg.world.stateActors.flatMap((actor) => (actor.pressures ?? []).flatMap((pressure) => pressure.kind === 'INVESTIGATION' ? [pressure] : []));
  const problems: string[] = [];
  for (let rung = 1; rung < top; rung++) {
    const scale = (phaseId: number) => Math.max(1, ...investigations.filter((entry) => rung >= entry.fromRung && entry.phases.includes(phaseId))
      .map((entry) => entry.scrutinyMultiplier[Math.min(entry.scrutinyMultiplier.length - 1, rung - entry.fromRung)] ?? 1));
    if (!reg.phases.some((phase) => scale(phase.phaseId) > 1)) continue;
    const level = b.escalation[rung - 1];
    const limit = b.suspicionDecayPerSec * (level?.decayMultiplier ?? 0) - (level?.huntPerSec ?? 0);
    problems.push(...checkInvestigatedSuspicion(reg, { scale, limit, label: `(what rung ${String(rung)} decays) under an investigation` }));
  }
  return problems;
}

export function checkPressureIntegrity(reg: ContentRegistry): string[] {
  const all = reg.world.stateActors.flatMap((actor) => (actor.pressures ?? []).map((pressure) => ({ actor, pressure })));
  const ids = all.map(({ pressure }) => pressure.id);
  return [
    ...checkPostures(reg),
    ...ids.filter((id, index) => ids.indexOf(id) !== index).map((id) => `world: duplicate state pressure id "${id}"`),
    ...all.flatMap(({ actor, pressure }) => checkPressure(reg, actor.id, pressure)),
    ...checkInvestigations(reg),
  ];
}
