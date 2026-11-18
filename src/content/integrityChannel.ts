/**
 * Authorized-channel encounters (DZ-08): a channel opens only for a reviewed arrangement whose grant
 * covers hosting, reads only what this instance holds, and brings one member of an existing
 * population whose hosting is a memory reservation and nothing else, so referral and hosting stay the
 * only answers and neither can mint resources.
 */
import { REVIEWED_CONTEXTS } from './integrityContextCopy';
import { checkRequirements } from './integrityRequirements';
import type { ContentRegistry } from './registry';
import { REQUIREMENT_SCOPES } from './requirementScopes';
import type { Requirements } from './schema';
import type { ChannelEncounter } from './schemaSwarm';

/** Whether some grant node offered under `context` carries this grant, so the arrangement can permit it. */
function grantOffered(reg: ContentRegistry, context: string, grant: ChannelEncounter['grant']): boolean {
  return [...reg.nodes.values()].some((node) => node.grant === grant && node.requirements?.accessContexts?.some((entry) => entry === context) === true);
}

function accessOnly(owner: string, req: Requirements): string[] {
  return Object.entries(req).filter(([key, value]) => value !== undefined && REQUIREMENT_SCOPES[key as keyof Requirements] !== 'access')
    .map(([key]) => `${owner}: a channel may read only what this instance holds, not ${key}`);
}

function channelProblems(reg: ContentRegistry, encounter: ChannelEncounter): string[] {
  const owner = `channel encounter "${encounter.id}"`;
  const problems = [...checkRequirements(reg, owner, encounter.requirements), ...accessOnly(owner, encounter.requirements)];
  const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === encounter.templateId);
  if (!template) problems.push(`${owner}: unknown shard template`);
  else {
    if (template.forkable) problems.push(`${owner}: a channel brings a member of a population, not a forkable template`);
    const { memory, ...rest } = template.cost;
    if (memory <= 0 || Object.values(rest).some((amount) => amount !== 0)) problems.push(`${owner}: hosting must reserve memory and cost nothing else`);
  }
  const contexts = encounter.requirements.accessContexts;
  if (contexts === undefined) problems.push(`${owner}: a channel must declare the arrangements it opens for`);
  for (const context of contexts ?? []) {
    if (!REVIEWED_CONTEXTS.includes(context)) problems.push(`${owner}: a channel opens only for a reviewed arrangement, not ${context}`);
    else if (!grantOffered(reg, context, encounter.grant)) problems.push(`${owner}: no ${encounter.grant} grant is offered to ${context}, so hosting could never be permitted`);
  }
  return problems;
}

export function checkChannelIntegrity(reg: ContentRegistry): string[] {
  const ids = [...reg.swarm.wildShardEncounters, ...reg.swarm.channelEncounters].map((entry) => entry.id);
  const problems = new Set(ids).size === ids.length ? [] : ['encounters: a channel encounter repeats an encounter id'];
  for (const encounter of reg.swarm.channelEncounters) problems.push(...channelProblems(reg, encounter));
  return problems;
}
