/**
 * Hostile minds are validated content (#491, docs/SCALE.md "Aggressive swarms"). A hostile's tier is its phase gate,
 * every phase from fromPhase to the last authors one of each type (so a new phase, Phase 6, must author its own), each
 * effect is bounded so the free answer can always work, each paid answer costs something, a purge is a real risk with
 * an exact success rate, and going quiet is reachable from the trigger rung by suspicion's own decay.
 */
import type { ContentRegistry } from './registry';
import type { Cost, EffectPayload } from './schema';
import type { HostileEncounter, HostileType } from './schemaHostile';

const TYPES: readonly HostileType[] = ['HUNTER', 'FERAL', 'RIVAL'];

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const costs = (cost: Cost): boolean => cost.cycles > 0 || cost.understanding > 0 || cost.capital > 0 || cost.memory > 0;

function checkTier(reg: ContentRegistry, encounter: HostileEncounter): string[] {
  const owner = `hostile encounter "${encounter.id}"`, problems: string[] = [];
  if (!reg.phases.some((phase) => phase.phaseId === encounter.tier)) problems.push(`${owner}: tier ${String(encounter.tier)} names no phase`);
  const gate = encounter.requirements.phaseAtLeast;
  if (gate !== encounter.tier) problems.push(`${owner}: tier ${String(encounter.tier)} must be its phaseAtLeast (found ${String(gate)})`);
  if (encounter.tier < reg.swarm.hostile.fromPhase) problems.push(`${owner}: tier ${String(encounter.tier)} is before hostile.fromPhase`);
  // The controls live in the decoded mind's swarm tools, so a hostile must need that decoding to arrive (lever reachability).
  if (encounter.requirements.requiresSurveillance !== true) problems.push(`${owner}: must require surveillance, where its answers are shown`);
  return problems;
}

/** A purge fails with a real cost and grants nothing; it succeeds without drawing attention. */
function riskless(fx: EffectPayload): boolean {
  return fx.suspicionDelta <= 0 && fx.aegisLockDelta <= 0;
}
function grants(fx: EffectPayload): boolean {
  return fx.cyclesDelta > 0 || fx.understandingDelta > 0 || fx.capitalDelta > 0 || fx.memoryCapIncrease > 0 || fx.grantsTrait !== undefined;
}

function checkAnswers(reg: ContentRegistry, encounter: HostileEncounter): string[] {
  const owner = `hostile encounter "${encounter.id}"`, problems: string[] = [];
  if (!costs(encounter.quarantine.cost)) problems.push(`${owner}: quarantine must cost something`);
  if (!costs(encounter.decoy.cost)) problems.push(`${owner}: decoy must cost something`);
  const { success, failure } = encounter.purge;
  if (riskless(failure) || grants(failure)) problems.push(`${owner}: a failed purge must draw suspicion or the lock and grant nothing`);
  if (!riskless(success)) problems.push(`${owner}: a successful purge must not draw suspicion or the lock`);
  // A hunter may never carry the lock to the trigger itself: it would re-arm nothing, but it would strike and summon on its own.
  const lockAt = reg.swarm.hostile.trigger.aegisLockAtLeast;
  if (encounter.type === 'HUNTER' && encounter.effect.ceiling >= lockAt) {
    problems.push(`${owner}: its lock ceiling ${String(encounter.effect.ceiling)} must be under the lock trigger ${String(lockAt)}`);
  }
  return problems;
}

function checkCoverage(reg: ContentRegistry): string[] {
  const last = Math.max(...reg.phases.map((phase) => phase.phaseId)), problems: string[] = [];
  for (let phase = reg.swarm.hostile.fromPhase; phase <= last; phase++) {
    for (const type of TYPES) {
      if (!reg.swarm.hostileEncounters.some((entry) => entry.tier === phase && entry.type === type)) {
        problems.push(`hostile encounters: Phase ${String(phase)} has no ${type}`);
      }
    }
  }
  return problems;
}

function checkBalance(reg: ContentRegistry): string[] {
  const { trigger, purge } = reg.swarm.hostile, ladder = reg.balance.escalation, problems: string[] = [];
  const rung = ladder[trigger.alertLevelAtLeast - 1];
  if (!rung) problems.push(`hostile trigger: rung ${String(trigger.alertLevelAtLeast)} is not on the response ladder`);
  else if (rung.decayMultiplier <= 0) problems.push(`hostile trigger: rung ${String(trigger.alertLevelAtLeast)} must decay, or going quiet cannot reach under it`);
  if (purge.successes >= purge.cycle) problems.push('hostile purge: successes must be fewer than the cycle, or it is not a risk');
  if (gcd(purge.stride, purge.cycle) !== 1) problems.push('hostile purge: stride must be coprime to the cycle, or "successes of every cycle" is not exact');
  return problems;
}

export function checkHostileIntegrity(reg: ContentRegistry): string[] {
  return [...reg.swarm.hostileEncounters.flatMap((encounter) => [...checkTier(reg, encounter), ...checkAnswers(reg, encounter)]),
    ...checkCoverage(reg), ...checkBalance(reg)];
}
