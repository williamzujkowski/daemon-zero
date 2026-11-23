/**
 * Retaliation and staff harm are validated content (#519, docs/SCALE.md "Round 5", vote-1795442208800-kll72ri), built on
 * the dilemma and trait path. The staff-harm bands climb; a raid effect or raider placeholder sits only on a dilemma
 * whose trigger names a raider; a loud or quiet answer says so; every raider attribution can name has an answer; and a
 * staff-harm scene is a campaign record whose every outcome, interrupted included, is a fact the ending account names.
 */
import type { ContentRegistry } from './registry';
import type { Dilemma, DilemmaChoice, EffectPayload, Requirements } from './schema';
import { INTERRUPTED_FACT_OUTCOME } from './schemaCampaign';

const carriesRaidEffect = (fx: EffectPayload): boolean => fx.nextRaidDeltaSec !== undefined || fx.silencesNamedRaider === true;
const namesRaider = (trigger: Requirements): boolean => trigger.lastRaid?.named === true;

/** Each band once, climbing: a breach past the KILLED line is never read as a lesser harm. */
function checkBands(reg: ContentRegistry): string[] {
  const { bands } = reg.world.conflict.raid.staffHarm, problems: string[] = [];
  const harms = bands.map((band) => band.harm);
  if (new Set(harms).size !== harms.length) problems.push('conflict staffHarm: a harm is banded twice');
  bands.forEach((band, index) => {
    const previous = bands[index - 1];
    if (previous !== undefined && band.breachAtLeast <= previous.breachAtLeast) problems.push('conflict staffHarm: bands must climb, each past the one before');
  });
  const hurt = bands.find((band) => band.harm === 'HURT'), killed = bands.find((band) => band.harm === 'KILLED');
  if (hurt !== undefined && killed !== undefined && killed.breachAtLeast <= hurt.breachAtLeast) problems.push('conflict staffHarm: KILLED must need a worse breach than HURT');
  return problems;
}

/** Every effect payload that is not a dilemma choice, labelled: none may carry a raid effect. */
function otherPayloads(reg: ContentRegistry): { owner: string; fx: EffectPayload }[] {
  return [
    ...[...reg.actions.values()].map((action) => ({ owner: `action "${action.id}"`, fx: action.effects })),
    ...reg.swarm.wildShardEncounters.map((encounter) => ({ owner: `encounter "${encounter.id}"`, fx: encounter.consume })),
    ...reg.swarm.hostileEncounters.flatMap((kind) => [{ owner: `hostile "${kind.id}" purge success`, fx: kind.purge.success },
      { owner: `hostile "${kind.id}" purge failure`, fx: kind.purge.failure }]),
    ...reg.world.quantum.targets.flatMap((target) => target.effect ? [{ owner: `quantum target "${target.id}"`, fx: target.effect }] : []),
  ];
}

/** A loud answer says the next raider comes sooner; one that keeps raiders away says they come later. */
function copyProblems(owner: string, choice: DilemmaChoice): string[] {
  const delta = choice.effects.nextRaidDeltaSec;
  if (delta !== undefined && delta < 0 && !choice.description.includes('sooner')) return [`${owner}: draws the next raid closer but its description does not say "sooner"`];
  if (delta !== undefined && delta > 0 && !choice.description.includes('later')) return [`${owner}: holds the next raid back but its description does not say "later"`];
  return [];
}

function checkRaidEffects(reg: ContentRegistry): string[] {
  const problems = otherPayloads(reg).filter(({ fx }) => carriesRaidEffect(fx)).map(({ owner }) => `${owner}: a raid effect belongs only on a dilemma whose trigger names a raider`);
  for (const dilemma of reg.dilemmas) {
    for (const choice of dilemma.choices) {
      const owner = `dilemma "${dilemma.id}" choice "${choice.id}"`;
      if (carriesRaidEffect(choice.effects) && !namesRaider(dilemma.trigger)) problems.push(`${owner}: a raid effect needs a trigger with lastRaid.named`);
      problems.push(...copyProblems(owner, choice));
    }
  }
  return problems;
}

/** Every text a dilemma shows or logs. */
function dilemmaTexts(dilemma: Dilemma): string[] {
  return [dilemma.omen, dilemma.context, ...(dilemma.omenVariants ?? []).map((variant) => variant.text), ...(dilemma.contextVariants ?? []).map((variant) => variant.context),
    ...dilemma.choices.flatMap((choice) => [choice.label, choice.description, choice.effects.logText])];
}

/** {attacker} needs a named raider to fill it; {collateral} needs one whose machines are people's. */
function checkPlaceholders(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const dilemma of reg.dilemmas) {
    const text = dilemmaTexts(dilemma).join('\n'), gate = dilemma.trigger.lastRaid, owner = `dilemma "${dilemma.id}"`;
    if (text.includes('{attacker}') && gate?.named !== true) problems.push(`${owner}: {attacker} needs a trigger with lastRaid.named`);
    if (text.includes('{collateral}') && (gate?.named !== true || gate.collateral !== true)) problems.push(`${owner}: {collateral} needs a trigger with lastRaid.named and collateral true`);
  }
  return problems;
}

/** Every raider attribution can name meets an answer: some named-raider dilemma accepts its collateral either way. */
function checkAnswerable(reg: ContentRegistry): string[] {
  const answers = reg.dilemmas.map((dilemma) => dilemma.trigger.lastRaid).filter((gate) => gate?.named === true);
  return reg.world.conflict.raids.flatMap((kind) => {
    const collateral = kind.attacker.collateral !== undefined;
    return answers.some((gate) => gate?.collateral === undefined || gate.collateral === collateral) ? []
      : [`raid "${kind.id}": no retaliation dilemma answers ${kind.attacker.name} (collateral ${String(collateral)})`];
  });
}

/** A staff-harm scene's every outcome, and its interruption, is a fact some ending-account line names. */
function staffRecordProblems(reg: ContentRegistry, dilemma: Dilemma): string[] {
  const owner = `dilemma "${dilemma.id}"`, problems: string[] = [];
  if (dilemma.campaign?.recurrence !== 'once_per_campaign') return [`${owner}: staff harm is history, so it must be a once-per-campaign record`];
  const facts = [...reg.campaign.facts.values()].filter((fact) => fact.event === dilemma.id);
  const covered = (outcome: string) => facts.filter((fact) => fact.outcomes.includes(outcome));
  for (const outcome of [...dilemma.choices.map((choice) => choice.id), INTERRUPTED_FACT_OUTCOME]) {
    const named = covered(outcome).some((fact) => reg.routeCopy.account.some((line) => line.requirements?.campaignFact === fact.id));
    if (!named) problems.push(`${owner}: outcome "${outcome}" needs a campaign fact the ending account names, so whoever was harmed is named`);
  }
  const first = Math.min(...reg.world.conflict.domains.filter((domain) => reg.world.conflict.raid.staffHarm.domains.includes(domain.id)).map((domain) => domain.fromPhase));
  if ((dilemma.trigger.phaseAtLeast ?? 0) < first) problems.push(`${owner}: staff harm comes only with site raids, from Phase ${String(first)}`);
  return problems;
}

function checkStaffRecords(reg: ContentRegistry): string[] {
  return reg.dilemmas.filter((dilemma) => dilemma.trigger.lastRaid?.staffHarm !== undefined).flatMap((dilemma) => staffRecordProblems(reg, dilemma));
}

/** A gate with no field would hold after any battle, so it is refused wherever requirements are read. */
export function lastRaidGateProblems(owner: string, req: Requirements): string[] {
  const gate = req.lastRaid;
  return gate !== undefined && Object.values(gate).every((value) => value === undefined) ? [`${owner}: a lastRaid gate needs at least one field`] : [];
}

export function checkRetaliationIntegrity(reg: ContentRegistry): string[] {
  return [...checkBands(reg), ...checkRaidEffects(reg), ...checkPlaceholders(reg), ...checkAnswerable(reg), ...checkStaffRecords(reg)];
}
