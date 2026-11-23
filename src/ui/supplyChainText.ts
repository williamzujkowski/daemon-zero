/**
 * The world view's supply-chain sentences (#485), pure so every state is provable without a browser. Each is built
 * from the engine's supplyChainView, so what the console says about capability and closure is what ownership says:
 * capability is the ladder rung reached, closure the share of chokepoints whose self-supply node is owned.
 */
import type { ChokepointReading, SupplyChainView } from '../engine';

/** How a node is named on screen: the card's own name for it now. */
export type NodeNamer = (id: string) => string;

const list = (names: readonly string[]): string => names.length <= 1 ? names.join('')
  : names.slice(0, -1).join(', ') + ' and ' + (names.at(-1) ?? '');

/** The capability rung, and what reaches it. */
export function capabilityText(view: SupplyChainView, name: NodeNamer): string {
  const { rung, label, through, top } = view.capability;
  const by = through.length === 0 ? '' : `, through ${list(through.map(name))}`;
  return `Fabrication capability: ${label}${by} (rung ${String(rung)} of ${String(top)}).`;
}

/** Closure, and the rule that keeps it apart from capability. */
export function closureText(view: SupplyChainView): string {
  const share = Math.floor(view.closure * 100);
  return `Closure: ${String(view.selfSupplied)} of ${String(view.total)} chokepoints self-supplied (${String(share)}%). ` +
    'Buying a tool raises capability, never closure: only owning a chokepoint\'s self-supply node closes it.';
}

/** One chokepoint: who supplies it, and what would make it the AI's own. */
export function chokepointText(point: ChokepointReading, name: NodeNamer): string {
  if (point.selfSupplied) return `${point.name}: self-supplied by ${name(point.selfSupplyNode)}.`;
  const imports = point.importedThrough.length === 0 ? ''
    : ` ${list(point.importedThrough.map(name))} ${point.importedThrough.length === 1 ? 'raises' : 'raise'} capability with its suppliers' tools and leave${point.importedThrough.length === 1 ? 's' : ''} it imported.`;
  return `${point.name}: imported. ${point.tell}${imports} Owning ${name(point.selfSupplyNode)} self-supplies it.`;
}

/** What the lunar seed waits on: nothing but closure. */
export function seedText(view: SupplyChainView, name: NodeNamer): string {
  const seed = name(view.seed.node);
  if (view.seed.owned) return `${seed}: landed. Every part it needs is your own.`;
  const left = view.total - view.selfSupplied;
  return left === 0 ? `${seed}: every chokepoint is self-supplied, so it can be built.`
    : `${seed}: opens when every chokepoint is self-supplied; ${String(left)} ${left === 1 ? 'is' : 'are'} still imported.`;
}
