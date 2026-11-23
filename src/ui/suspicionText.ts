/**
 * Words for the suspicion outlook (#403, #368): what raises suspicion most, where the response stands down, and the
 * one lever the engine confirms lowers the applied rate now. Nothing here decides whether a lever acts; the engine
 * query does, so the copy can only name a lever that works.
 */
import { CONTENT } from '../content';
import type { Actuator } from '../content/schema';
import type { GameState, SuspicionLever, SuspicionOutlook, SuspicionSource, SuspicionSourceKind } from '../engine';

const FIXED_SOURCES: Record<'RESPONSE' | 'OVERHEAT' | 'SCRUTINY' | 'INSOLVENCY', string> = {
  RESPONSE: 'the human response', OVERHEAT: 'overheat', SCRUTINY: 'scale scrutiny', INSOLVENCY: 'insolvency',
};

/** Dials whose control is better known by its place than by its widget title. */
const DIAL_NAMES: Partial<Record<Actuator, string>> = { computeProfitAllocationRatio: 'revenue diversion in FINANCE' };

function entityName(kind: 'NODE' | 'REPEATABLE' | 'SHARD' | 'ACTION', id: string, game: GameState): string {
  if (kind === 'NODE') return CONTENT.nodes.get(id)?.revealedName ?? id;
  if (kind === 'REPEATABLE') return CONTENT.repeatables.get(id)?.name ?? id;
  if (kind === 'ACTION') return CONTENT.actions.get(id)?.label ?? id;
  const template = game.activeShards[id]?.templateId;
  return CONTENT.swarm.playerSwarmTemplates.find((entry) => entry.id === template)?.name ?? id;
}

const isFixed = (kind: SuspicionSourceKind): kind is keyof typeof FIXED_SOURCES => kind in FIXED_SOURCES;
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** A power source or heat sink in a sentence (#482): what the watts are and how they leave. */
function signatureName(id: string): string {
  const { sources, sinks } = CONTENT.world.signature;
  const source = sources.find((cls) => cls.id === id);
  if (source) return 'power drawn from ' + lowerFirst(source.name);
  const sink = sinks.find((cls) => cls.id === id);
  return sink ? 'heat rejected through ' + lowerFirst(sink.name) : id;
}

/** What a source is called in a sentence. */
export function sourceName(source: SuspicionSource, game: GameState): string {
  if (isFixed(source.kind)) return FIXED_SOURCES[source.kind];
  if (source.kind === 'SIGNATURE') return signatureName(source.id ?? '');
  return entityName(source.kind, source.id ?? '', game);
}

/** The largest source pushing suspicion up, or null when nothing does. */
export function topDriver(outlook: Pick<SuspicionOutlook, 'sources'>): SuspicionSource | null {
  const head = outlook.sources[0];
  return head !== undefined && head.perSec > 0 ? head : null;
}

function dialName(id: Actuator): string {
  return DIAL_NAMES[id] ?? [...CONTENT.widgets.values()].find((widget) => widget.hostsActuator === id)?.title ?? id;
}

/** The lever as an instruction: what to do and where. */
export function leverText(lever: SuspicionLever, game: GameState): string {
  if (lever.kind === 'DIAL') return 'turn ' + dialName(lever.id) + (lever.to < game.actuators[lever.id] ? ' down' : ' up');
  if (lever.kind === 'SUSPEND') return 'suspend ' + entityName('NODE', lever.id, game) + ' in PROC';
  // A hire is let go in PAYROLL; any other track releases a level on its own upgrade card (#488).
  if (lever.kind === 'DISMISS') return CONTENT.repeatables.get(lever.id)?.kind === 'OPERATIVE'
    ? 'release one ' + entityName('REPEATABLE', lever.id, game) + ' in PAYROLL'
    : 'release one level of ' + entityName('REPEATABLE', lever.id, game) + ' on its upgrade card';
  if (lever.kind === 'RELEASE') return 'release one member of ' + entityName('SHARD', lever.id, game) + ' in SWARM';
  return 'CLAMP ' + entityName('SHARD', lever.id, game) + ' in SWARM';
}

/**
 * The response notice's guidance: where the rung stands down, then whether suspicion is falling and, if not, the
 * lever that lowers it most (and whether that alone makes it fall). Null at the bottom rung.
 */
export function standDownText(outlook: SuspicionOutlook, game: GameState): string | null {
  if (outlook.standDownBelow === null) return null;
  const threshold = 'Stands down below ' + String(outlook.standDownBelow) + '% suspicion.';
  if (outlook.falling) return threshold + ' Suspicion is falling.';
  const lever = outlook.levers[0];
  if (lever === undefined) return threshold + ' Suspicion is not falling, and no action lowers it this moment.';
  const effect = lever.perSecAfter < 0 ? 'makes it fall' : 'slows its rise';
  const instruction = leverText(lever, game);
  return threshold + ' Suspicion is not falling: ' + instruction.charAt(0).toUpperCase() + instruction.slice(1) + ' ' + effect + '.';
}
