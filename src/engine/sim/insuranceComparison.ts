/**
 * The no-insurance column of docs/BALANCE.md, "Contingency insurance (#498)", reproducible from the tree (#524): the
 * same raw content with every insuring node taken out, which `make sim-insurance` (scripts/run-insurance-report.ts) plays
 * with the same policies as the shipped content and prints side by side. A report instrument, never a gate.
 */
import { buildRegistry, type ContentRegistry, type RawContent } from '../../content/registry';

type RawNode = { insures?: unknown };
type RawPhase = { nodes: RawNode[] };

/**
 * `raw` with every node that insures a class removed, built and validated like any composition. Nothing is built on an
 * investment, so nothing else changes; if a node ever is, the build fails on its missing prerequisite instead of
 * quietly playing a different game.
 */
export function withoutInsurance(raw: RawContent): ContentRegistry {
  const phases = (raw.phases as RawPhase[]).map((phase) => ({ ...phase, nodes: phase.nodes.filter((node) => node.insures === undefined) }));
  return buildRegistry({ ...raw, phases });
}
