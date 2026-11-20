/**
 * Resolves a stage row's source to the GameState its cell opens, memoised per worker: makeFixtures() runs once
 * when helpers.ts loads, the careful campaign once (campaignSaves.ts), the cooperative campaign once
 * (cooperative-helpers.ts), and each route state once. Nothing here touches a browser.
 */
import { CONTENT } from '../../../src/content';
import type { RegistryNode } from '../../../src/content/registry';
import { importSave, serialize, type GameState } from '../../../src/engine';
import { moment } from '../../cooperative-helpers';
import { fixtureCode } from '../helpers';
import { ROUTE_STATES } from '../routeStates';
import { campaignMoment } from './campaignSaves';
import type { StageRow, StageSource } from './types';

const built = new Map<string, GameState>();

function resolve(source: StageSource): GameState {
  switch (source.kind) {
    case 'fixture': return importSave(fixtureCode(source.name), CONTENT);
    case 'campaign': return campaignMoment(source.name);
    case 'moment': return moment(source.name);
    case 'build': return source.build();
    case 'route': {
      const entry = ROUTE_STATES.find((route) => route.name === source.name);
      if (entry === undefined) throw new Error('No route state named ' + source.name);
      return entry.state();
    }
  }
}

function sourceKey(source: StageSource): string {
  return source.kind === 'build' ? 'build:' + source.recipe : source.kind + ':' + source.name;
}

/** The save a row opens, after its patch, checked against the ending it promises (G9). */
export function stageState(row: StageRow): GameState {
  const key = sourceKey(row.source);
  const base = built.get(key) ?? resolve(row.source);
  built.set(key, base);
  const state = row.patch ? row.patch(base) : base;
  if (row.ending !== undefined && state.ending !== row.ending) {
    throw new Error(`${row.id}: the save holds ending ${String(state.ending)}, not ${row.ending}`);
  }
  if (row.ending === undefined && state.ending !== null) throw new Error(`${row.id}: an ended save must name its ending`);
  return state;
}

/** The serialized save a cell writes into browser storage. */
export function stageSave(row: StageRow): string {
  return serialize(stageState(row));
}

/** A source in words, for the gallery: which generator and which save. */
export function describeSource(source: StageSource): string {
  return source.kind === 'build' ? 'FIXTURE ' + source.recipe : sourceKey(source);
}

/** A node found by what it does, never by id: the first that matches, or a loud failure. */
export function nodeWhere(test: (node: RegistryNode) => boolean, what: string): RegistryNode {
  const node = [...CONTENT.nodes.values()].find(test);
  if (node === undefined) throw new Error('No node for ' + what);
  return node;
}
