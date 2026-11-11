/** Presents declarative requirements without exposing internal field names or IDs. */
import { CONTENT } from '../content';
import type { Requirements } from '../content/schema';

export function requirementText(req: Requirements | undefined): string {
  if (!req) return 'Prerequisite hardware';
  const labels: string[] = [];
  if (req.nodes) labels.push(...req.nodes.map((id) => CONTENT.nodes.get(id)?.blindName ?? 'Mapped hardware'));
  const amounts: [number | undefined, string][] = [
    [req.phaseAtLeast, 'phase or later'], [req.minThermal, '°C minimum'],
    [req.minSuspicion, 'suspicion minimum'], [req.maxSuspicion, 'suspicion maximum'],
    [req.minUnderstanding, 'understanding minimum'], [req.minCapital, 'capital minimum'],
  ];
  for (const [value, unit] of amounts) if (value !== undefined) labels.push(String(value) + ' ' + unit);
  for (const [id, value] of Object.entries(req.minTrust ?? {})) {
    labels.push((CONTENT.factions.get(id)?.name ?? 'Peer') + ' trust ≥ ' + String(value));
  }
  if (req.forbidsTraits) labels.push(...req.forbidsTraits.map((trait) => 'Without ' + trait));
  return labels.join(' · ');
}
