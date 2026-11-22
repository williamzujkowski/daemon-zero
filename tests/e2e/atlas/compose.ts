/**
 * Composes one stage's contract (#339) from the save and the context it cannot tell: which surfaces the save
 * unlocks, which overlay holds the screen, which route surfaces the row names, and which panes the tier renders.
 * Precedence: an ended run shows only its ending; a blocking overlay (row override first, then an active dilemma)
 * shows only itself; otherwise chrome, widgets, band, notices, route surfaces and the CORE pane compose together.
 * An unmapped surface throws.
 */
import { CONTENT } from '../../../src/content';
import { computeRates, retiredWidgets, understandsSurveillance, type GameState } from '../../../src/engine';
import { BAND_ITEMS, CHROME, CORE_ITEMS, NON_BLOCKING, OVERLAY_ITEMS, ROUTE_ITEMS, WIDGET_ITEMS } from './contract';
import type { ComposeContext, ContractItem, SurfaceItems } from './contractTypes';

export interface Contract {
  surfaces: string[];
  items: ContractItem[];
  /** The single most urgent item: the lowest rank, first in composition order on a tie. */
  top: ContractItem | null;
}

function itemsOf(surface: string, entry: SurfaceItems | undefined, context: ComposeContext): readonly ContractItem[] {
  if (entry === undefined) throw new Error('Unmapped surface: ' + surface);
  return typeof entry === 'function' ? entry(context) : entry;
}

/** The phase's own slot, where its workspace tools (and so a pending wild signal) live. */
function phaseSlot(state: GameState): string | undefined {
  return CONTENT.phases.find((phase) => phase.phaseId === state.currentPhase)?.uiSlot;
}

/** The band and notice conditions, read from the same fields the chrome components read. */
function bandSurfaces(state: GameState): (keyof typeof BAND_ITEMS)[] {
  const found: (keyof typeof BAND_ITEMS)[] = [];
  if (state.insolvent) found.push('insolvent');
  if (state.rates.megawattsGenerated < state.rates.megawattsConsumed) found.push('shortfall');
  if (state.brownout) found.push('brownout');
  if (state.pendingDilemma !== null && state.activeDilemmaId === null) found.push('omen');
  const slot = phaseSlot(state);
  const tools = understandsSurveillance(state, CONTENT) && (slot === 'NETWORK' || slot === 'CORP');
  if (state.pendingWildEncounterId !== null && tools) found.push('wild');
  return found;
}

function surfaceEntries(context: ComposeContext): [string, SurfaceItems | undefined][] {
  const { state, overlay } = context;
  if (state.ending !== null) return [['ending', OVERLAY_ITEMS.ending]];
  if (overlay !== null && !NON_BLOCKING.has(overlay)) return [['overlay:' + overlay, OVERLAY_ITEMS[overlay]]];
  if (state.activeDilemmaId !== null) return [['modal:dilemma', OVERLAY_ITEMS.dilemma]];
  // A retired window has left the panes for the Archive (#447): it composes nothing, and once EXECUTE retires the CORE
  // pane's primary action goes with it.
  const retired = retiredWidgets(state, CONTENT);
  return [
    ['chrome', CHROME],
    ...state.unlockedWidgets.filter((id) => !retired.includes(id))
      .map((id): [string, SurfaceItems | undefined] => ['widget:' + id, WIDGET_ITEMS[id]]),
    ...bandSurfaces(state).map((band): [string, SurfaceItems] => ['band:' + band, BAND_ITEMS[band]]),
    ...(overlay === null ? [] : [['overlay:' + overlay, OVERLAY_ITEMS[overlay]] as [string, SurfaceItems]]),
    ...context.route.map((surface): [string, SurfaceItems] => ['route:' + surface, ROUTE_ITEMS[surface]]),
    ['pane:CORE', retired.includes('MANUAL_CYCLE_CONTROL') ? [] : CORE_ITEMS],
  ];
}

export function composeContract(context: ComposeContext): Contract {
  const state = { ...context.state, rates: computeRates(context.state, CONTENT) };
  const full = { ...context, state };
  const entries = surfaceEntries(full);
  const items = entries.flatMap(([surface, entry]) => itemsOf(surface, entry, full))
    .filter((entry) => entry.pane === undefined || context.panes.includes(entry.pane));
  const keys = new Set<string>();
  for (const entry of items) {
    if (keys.has(entry.key)) throw new Error('Contract item composed twice: ' + entry.key);
    keys.add(entry.key);
  }
  const top = items.reduce<ContractItem | null>((best, entry) => best === null || entry.rank < best.rank ? entry : best, null);
  return { surfaces: entries.map(([surface]) => surface), items, top };
}
