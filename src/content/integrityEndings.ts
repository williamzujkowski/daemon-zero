/** Variant endings refine a trait family without changing the family's dominance or tie-break. */
import type { ContentRegistry } from './registry';
export function checkEndingVariants(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const ending of reg.endings) {
    if (ending.variantOf === undefined) continue;
    const parent = reg.endings.find((entry) => entry.id === ending.variantOf);
    if (!parent || parent.forcedOnly || parent.variantOf !== undefined || ending.forcedOnly) problems.push(`${ending.id}: invalid ending variant parent`);
    if (!ending.requirements) problems.push(`${ending.id}: ending variant requires gates`);
    if (ending.requirements?.requiredNarrativeFlag && !reg.swarm.narrativeFlags.includes(ending.requirements.requiredNarrativeFlag)) problems.push(`${ending.id}: unknown narrative flag`);
    if (parent && ending.dominantTraits.join() !== parent.dominantTraits.join()) problems.push(`${ending.id}: variant must keep parent traits`);
    if (reg.endings.some((other) => other.id !== ending.id && other.variantOf === ending.variantOf && other.priority === ending.priority)) problems.push(`${ending.id}: variant priorities must be unique within a family`);
  }
  return problems;
}
