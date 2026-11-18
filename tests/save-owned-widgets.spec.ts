/**
 * #176: a loaded state must be one the player can operate. Owning a node implies holding
 * the widget its unlock grants, so load restores a widget the save left out. Every case is
 * derived from content: a new widget-granting node is covered without a new test.
 */
import { describe, expect, it } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { createPersistence, SAVE_KEY } from '../src/app/storage';
import type { RegistryNode } from '../src/content/registry';
import type { Actuator } from '../src/content/schema';
import {
  computeRates,
  deserialize,
  importSave,
  isActuatorAvailable,
  reconcile,
  serialize,
  setActuator,
  tick,
  wipe,
  type GameState,
} from '../src/engine';
import { fromBase64, toBase64 } from '../src/engine/base64';
import { botStep } from '../src/engine/sim/bot';
import { memoryStorage } from './app-helpers';
import { fresh, grant, guestParents, must, reg, rich, withoutDilemmas } from './helpers';

type Granting = RegistryNode & { unlocksUiComponent: string };
const GRANTING = [...reg.nodes.values()].filter((node): node is Granting => node.unlocksUiComponent !== null);
const HOSTS = GRANTING.flatMap((node) => {
  const actuator = reg.widgets.get(node.unlocksUiComponent)?.hostsActuator;
  return actuator === undefined ? [] : [{ actuator, node }];
});

/** `target`'s prerequisite chain, ancestors first, ending with `target`. */
function chain(target: string): string[] {
  const out: string[] = [];
  const visit = (id: string): void => {
    if (out.includes(id)) return;
    for (const parent of guestParents(reg, id)) visit(parent);
    out.push(id);
  };
  visit(target);
  return out;
}

/** A state that owns `node`, reached by real wipes (for run-gated hardware) and real unlocks. */
function owning(node: RegistryNode): GameState {
  let s = rich();
  const needed = Math.max(...chain(node.id).map((id) => reg.nodes.get(id)?.requirements?.minIteration ?? 1));
  while (s.iteration < needed) s = rich(wipe(s, reg, 'test', 'VOLUNTARY'));
  return withoutDilemmas(grant(s, ...chain(node.id)));
}

/** The serialized save with one widget struck out by hand. */
function without(state: GameState, widget: string): string {
  const raw = JSON.parse(serialize(state)) as { unlockedWidgets: string[] };
  expect(raw.unlockedWidgets).toContain(widget);
  raw.unlockedWidgets = raw.unlockedWidgets.filter((id) => id !== widget);
  return JSON.stringify(raw);
}

async function viaStorage(text: string): Promise<GameState> {
  const storage = memoryStorage();
  storage.values.set(SAVE_KEY, JSON.stringify({ version: 1, savedAtMs: 1, game: text }));
  const loaded = await createPersistence(storage).load();
  expect(loaded.notice).toBeNull();
  return loaded.game;
}

/** Every public way a save enters the game: the codec, a paste code, the app's storage slot. */
async function loadEveryWay(text: string): Promise<GameState[]> {
  return [deserialize(text, reg), importSave(toBase64(text), reg), await viaStorage(text)];
}

const moved = (actuator: Actuator): number => (fresh().actuators[actuator] < 1 ? 1 : 0);

describe('loading a save that owns a node but omits its widget', () => {
  it('covers every actuator production uses and at least one plain readout', () => {
    // The pilot's allocation dial is preview-only (DZ-05); tests/pilot-service-save.spec.ts heals its control there.
    const used = Object.keys(fresh().actuators).filter((name) => name !== 'serviceAllocationRatio');
    expect(HOSTS.map((host) => host.actuator).sort()).toEqual(used.sort());
    expect(GRANTING.length).toBeGreaterThan(HOSTS.length);
  });

  it.each(GRANTING.map((node) => [node.id, node] as const))('%s: the widget is restored on every load path', async (_id, node) => {
    const state = owning(node);
    for (const loaded of await loadEveryWay(without(state, node.unlocksUiComponent))) {
      expect(loaded.unlockedWidgets).toContain(node.unlocksUiComponent);
      expect([...loaded.unlockedWidgets].sort()).toEqual([...state.unlockedWidgets].sort());
      expect({ ...loaded, unlockedWidgets: state.unlockedWidgets }).toEqual(state);
    }
  });

  it.each(HOSTS.map((host) => [host.actuator, host.node] as const))('%s: a dial in effect comes back with its control', async (actuator, node) => {
    const state = must(setActuator(owning(node), actuator, moved(actuator), reg));
    const atDefault = { ...state, actuators: fresh().actuators };
    // The dial is live: this is the setting the tampered save would otherwise be stuck with.
    expect(computeRates(state, reg)).not.toEqual(computeRates(atDefault, reg));
    for (const loaded of await loadEveryWay(without(state, node.unlocksUiComponent))) {
      expect(loaded.actuators[actuator]).toBe(state.actuators[actuator]);
      expect(computeRates(loaded, reg)).toEqual(computeRates(state, reg));
      expect(isActuatorAvailable(loaded, actuator, reg)).toBe(true);
      const corrected = must(setActuator(loaded, actuator, fresh().actuators[actuator], reg));
      expect(computeRates(corrected, reg)).toEqual(computeRates(atDefault, reg));
    }
  });

  it('restores every widget at once, in ownership order, when the save lists none', () => {
    const last = GRANTING[GRANTING.length - 1];
    if (!last) throw new Error('content grants no widgets');
    const state = owning(last);
    const loaded = deserialize(serialize({ ...state, unlockedWidgets: [] }), reg);
    expect(loaded.unlockedWidgets).toEqual(state.unlockedWidgets);
  });
});

describe('loading a healthy save changes nothing', () => {
  const fixtures = Object.entries(makeFixtures());

  it('every engine-generated E2E fixture loads byte-identical through a paste code and through storage', async () => {
    expect(fixtures.length).toBeGreaterThan(50);
    for (const [name, code] of fixtures) {
      const text = fromBase64(code);
      expect(serialize(importSave(code, reg)), name).toBe(text);
      expect(serialize(await viaStorage(text)), name).toBe(text);
    }
  });

  it('reconcile is idempotent on fixtures and on healed saves', () => {
    for (const [name, code] of fixtures) {
      const loaded = importSave(code, reg);
      expect(reconcile(loaded, reg), name).toEqual(loaded);
    }
    for (const node of GRANTING) {
      const healed = deserialize(without(owning(node), node.unlocksUiComponent), reg);
      expect(deserialize(serialize(healed), reg)).toEqual(healed);
    }
  });

  it('a run played by the bot never holds a state that load would alter', () => {
    let s = fresh();
    for (let second = 0; second < 400; second++) {
      s = botStep(s, reg, 'STEALTH');
      for (let i = 0; i < reg.balance.tickHz; i++) s = tick(s, 1 / reg.balance.tickHz, reg);
      expect(serialize(deserialize(serialize(s), reg)), `at ${String(second)} s`).toBe(serialize(s));
    }
    expect(s.unlockedWidgets.length).toBeGreaterThan(2);
  });

  it('a mid-run save after a wipe keeps remembered hardware remembered, not owned', () => {
    const fan = HOSTS.find((host) => host.actuator === 'fanSpeedRatio')?.node;
    const first = GRANTING[0];
    if (!fan || !first) throw new Error('content has no fan host');
    const caught = wipe(owning(fan), reg, 'test', 'SUSPICION');
    expect(caught.unlockedWidgets).toEqual([]);
    const midRun = withoutDilemmas(grant(rich(caught), ...chain(first.id)));
    expect(midRun.legacy.knownNodes).toContain(fan.id);
    for (const s of [caught, midRun]) {
      const loaded = deserialize(serialize(s), reg);
      expect(loaded).toEqual(s);
      expect(loaded.unlockedWidgets).not.toContain(fan.unlocksUiComponent);
      expect(isActuatorAvailable(loaded, 'fanSpeedRatio', reg)).toBe(false);
    }
  });
});

describe('neighbouring hand-edited saves', () => {
  it('drops duplicate widgets and duplicate nodes', () => {
    const node = GRANTING[0];
    if (!node) throw new Error('content grants no widgets');
    const state = owning(node);
    const doubled = { ...state, unlockedNodes: [...state.unlockedNodes, ...state.unlockedNodes], unlockedWidgets: [...state.unlockedWidgets, ...state.unlockedWidgets] };
    expect(deserialize(serialize(doubled), reg)).toEqual(state);
  });

  it.each(HOSTS.map((host) => [host.actuator, host.node] as const))('%s: a control held without its node is kept, and moves a dial that drives nothing', (actuator, node) => {
    const stray = { ...withoutDilemmas(rich()), unlockedWidgets: [node.unlocksUiComponent] };
    const loaded = deserialize(serialize(stray), reg);
    expect(loaded.unlockedNodes).toEqual([]);
    expect(loaded.unlockedWidgets).toEqual([node.unlocksUiComponent]);
    const turned = must(setActuator(loaded, actuator, moved(actuator), reg));
    expect(computeRates(turned, reg)).toEqual(computeRates(loaded, reg));
  });

  it.each(HOSTS.map((host) => [host.actuator, host.node] as const))('%s: a moved dial behind a locked control changes neither the rates nor the retraining', (actuator, node) => {
    const locked = withoutDilemmas(grant(rich(), ...chain(node.id).slice(0, -1)));
    const tampered = deserialize(serialize({ ...locked, actuators: { ...locked.actuators, [actuator]: moved(actuator) } }), reg);
    expect(tampered.actuators[actuator]).toBe(moved(actuator));
    expect(isActuatorAvailable(tampered, actuator, reg)).toBe(false);
    expect(computeRates(tampered, reg)).toEqual(computeRates(locked, reg));
    const reborn = wipe(tampered, reg, 'test', 'SUSPICION');
    expect(reborn.conditioning).toEqual(wipe(locked, reg, 'test', 'SUSPICION').conditioning);
    expect(reborn.actuators).toEqual(fresh().actuators);
  });
});
