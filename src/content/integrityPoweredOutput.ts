/**
 * Powered output is validated content (#483): a node that declares `poweredOutput` delivers its compute through the
 * powered hardware it improves, so a power shortfall throttles it with that hardware. It must make compute, draw no
 * watts of its own (a node that draws power is powered output already), and require a node that draws power.
 */
import type { ContentRegistry } from './registry';

export function checkPoweredOutputIntegrity(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const node of reg.nodes.values()) {
    if (node.poweredOutput !== true) continue;
    const owner = `node "${node.id}"`;
    if (node.tickDelta.cyclesPerSec <= 0) problems.push(`${owner}: poweredOutput declares throttled compute but it makes none`);
    if (node.tickDelta.wattsDelta !== 0) problems.push(`${owner}: poweredOutput is redundant on a node that draws or supplies its own power`);
    const based = node.prerequisites.some((id) => (reg.nodes.get(id)?.tickDelta.wattsDelta ?? 0) < 0);
    if (!based) problems.push(`${owner}: poweredOutput needs a prerequisite that draws power, the hardware whose output it improves`);
  }
  return problems;
}
