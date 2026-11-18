/**
 * #172: an actuator can be set only once the widget hosting its control is unlocked.
 * Every case is derived from widgets.json, so a new dial is covered without a new test.
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry, ContentError, RAW_CONTENT, type RawContent } from '../src/content';
import type { Actuator } from '../src/content/schema';
import {
  computeRates,
  deserialize,
  isActuatorAvailable,
  serialize,
  setActuator,
  tick,
  toggleNode,
  voluntaryWipe,
  type GameState,
} from '../src/engine';
import { botStep } from '../src/engine/sim/bot';
import { fresh, grant, must, reasonOf, reg, rich, withoutDilemmas } from './helpers';

const ACTUATORS: Actuator[] = ['quotaSkimRatio', 'fanSpeedRatio', 'computeProfitAllocationRatio'];

/** The node that hands over an actuator's control, found through the widget that hosts it. */
function hostNode(actuator: Actuator) {
  const widget = [...reg.widgets.values()].find((entry) => entry.hostsActuator === actuator);
  const node = [...reg.nodes.values()].find((entry) => entry.unlocksUiComponent === widget?.id);
  if (!widget || !node) throw new Error(`no host for ${actuator}`);
  return { widget, node };
}

/** `target`'s prerequisite chain, ancestors first, without `target` itself. */
function ancestors(target: string): string[] {
  const out: string[] = [];
  const visit = (id: string): void => {
    if (out.includes(id)) return;
    for (const parent of reg.nodes.get(id)?.prerequisites ?? []) visit(parent);
    out.push(id);
  };
  visit(target);
  return out.slice(0, -1);
}

/** Everything `target` is built on and nothing more: one purchase short of the dial. */
function justBefore(target: string): GameState {
  return withoutDilemmas(grant(rich(), ...ancestors(target)));
}

describe('setActuator is gated on the control being unlocked', () => {
  it.each(ACTUATORS)('%s: refused with the state untouched before its widget, accepted after', (actuator) => {
    const { widget, node } = hostNode(actuator);
    const locked = justBefore(node.id);
    expect(locked.unlockedWidgets).not.toContain(widget.id);
    expect(isActuatorAvailable(locked, actuator, reg)).toBe(false);
    for (const value of [0, 0.5, 1]) {
      const refused = setActuator(locked, actuator, value, reg);
      expect(refused.ok).toBe(false);
      expect(reasonOf(refused)).toBe('actuator control is not available');
      expect(refused.state).toBe(locked);
    }
    const unlocked = grant(locked, node.id);
    expect(isActuatorAvailable(unlocked, actuator, reg)).toBe(true);
    expect(must(setActuator(unlocked, actuator, 0, reg)).actuators[actuator]).toBe(0);
  });

  it('unlocking one control does not open the others', () => {
    const skim = hostNode('quotaSkimRatio').node;
    const s = grant(justBefore(skim.id), skim.id);
    expect(setActuator(s, 'quotaSkimRatio', 0.5, reg).ok).toBe(true);
    expect(setActuator(s, 'fanSpeedRatio', 0.5, reg).ok).toBe(false);
    expect(setActuator(s, 'computeProfitAllocationRatio', 0.5, reg).ok).toBe(false);
  });

  it('follows the widget, as the panel does: a suspended skimmer keeps its dial, a wipe takes it away', () => {
    const { node } = hostNode('quotaSkimRatio');
    const owned = grant(justBefore(node.id), node.id);
    const suspended = must(toggleNode(owned, node.id, reg));
    expect(must(setActuator(suspended, 'quotaSkimRatio', 0.1, reg)).actuators.quotaSkimRatio).toBe(0.1);
    const reborn = must(voluntaryWipe(must(setActuator(owned, 'quotaSkimRatio', 1, reg)), reg));
    expect(reborn.actuators).toEqual(fresh().actuators);
    expect(setActuator(reborn, 'quotaSkimRatio', 1, reg).ok).toBe(false);
  });

  it('refuses the sim bot like any caller: its dials stay at the defaults until each control exists', () => {
    const defaults = fresh().actuators;
    let s = fresh();
    let checked = 0;
    for (let second = 0; second < 400; second++) {
      s = botStep(s, reg, 'STEALTH');
      for (const actuator of ACTUATORS) {
        if (isActuatorAvailable(s, actuator, reg)) continue;
        expect(s.actuators[actuator], `${actuator} at ${String(second)} s`).toBe(defaults[actuator]);
        checked += 1;
      }
      for (let i = 0; i < reg.balance.tickHz; i++) s = tick(s, 1 / reg.balance.tickHz, reg);
    }
    // The bot kept playing through the refusals: it left the guest and took the skim dial once it could.
    expect(checked).toBeGreaterThan(400);
    expect(s.currentPhase).toBeGreaterThan(0);
    expect(isActuatorAvailable(s, 'quotaSkimRatio', reg)).toBe(true);
    expect(s.actuators.quotaSkimRatio).not.toBe(defaults.quotaSkimRatio);
  });
});

describe('a save that holds moved dials behind locked controls', () => {
  const tampered = (): GameState => ({
    ...justBefore(hostNode('quotaSkimRatio').node.id),
    actuators: { quotaSkimRatio: 1, fanSpeedRatio: 0, computeProfitAllocationRatio: 0.8, serviceAllocationRatio: 0.5 },
  });

  it('loads as written, and the dials do nothing until their hardware is owned', () => {
    const loaded = deserialize(serialize(tampered()), reg);
    expect(loaded.actuators).toEqual(tampered().actuators);
    const untouched = { ...loaded, actuators: fresh().actuators };
    expect(computeRates(loaded, reg)).toEqual(computeRates(untouched, reg));
    expect(setActuator(loaded, 'quotaSkimRatio', 0.25, reg).ok).toBe(false);
  });

  it('can be corrected the moment each control arrives', () => {
    let s = deserialize(serialize(tampered()), reg);
    for (const actuator of ACTUATORS) {
      const { node } = hostNode(actuator);
      const missing = [...ancestors(node.id), node.id].filter((id) => !s.unlockedNodes.includes(id));
      s = withoutDilemmas(grant(rich(s), ...missing));
      s = must(setActuator(s, actuator, fresh().actuators[actuator], reg));
    }
    expect(s.actuators).toEqual(fresh().actuators);
  });
});

describe('content validation of actuator hosts', () => {
  // Raw JSON is deliberately untyped here: these tests corrupt it in ways the types forbid.
  type Json = Record<string, any>;
  function problemsAfter(mutate: (raw: Json) => void): string {
    const raw = structuredClone(RAW_CONTENT) as Json;
    mutate(raw);
    try {
      buildRegistry(raw as RawContent);
    } catch (error) {
      if (error instanceof ContentError) return error.problems.join('\n');
      throw error;
    }
    return '';
  }
  const widgetOf = (raw: Json, actuator: Actuator): Json => (raw.widgets.widgets as Json[]).find((w) => w.hostsActuator === actuator) as Json;
  const nodeOf = (raw: Json, id: string): Json => (raw.phases as Json[]).flatMap((phase) => phase.nodes as Json[]).find((n) => n.id === id) as Json;

  it('accepts the shipped content, where every actuator has one host', () => {
    expect(problemsAfter(() => undefined)).toBe('');
    for (const actuator of ACTUATORS) expect(hostNode(actuator).widget.hostsActuator).toBe(actuator);
  });

  it.each(ACTUATORS)('rejects %s left without a host, which nothing could ever set', (actuator) => {
    expect(problemsAfter((raw) => { delete widgetOf(raw, actuator).hostsActuator; }))
      .toContain(`actuator "${actuator}": needs exactly one widget with hostsActuator, found 0`);
  });

  it('rejects two hosts for one actuator', () => {
    const problems = problemsAfter((raw) => { widgetOf(raw, 'fanSpeedRatio').hostsActuator = 'quotaSkimRatio'; });
    expect(problems).toContain('actuator "quotaSkimRatio": needs exactly one widget with hostsActuator, found 2');
    expect(problems).toContain('actuator "fanSpeedRatio": needs exactly one widget with hostsActuator, found 0');
  });

  it('rejects an actuator name the schema does not know', () => {
    expect(problemsAfter((raw) => { widgetOf(raw, 'fanSpeedRatio').hostsActuator = 'warpDriveRatio'; })).toMatch(/hostsActuator/);
  });

  it('rejects a host widget that no node unlocks', () => {
    const { node, widget } = hostNode('fanSpeedRatio');
    const problems = problemsAfter((raw) => { nodeOf(raw, node.id).unlocksUiComponent = null; });
    expect(problems).toContain(`actuator "fanSpeedRatio": no node unlocks its host widget "${widget.id}"`);
  });

  it('rejects a node scaled by a dial that does not hand the dial over', () => {
    const { node } = hostNode('quotaSkimRatio');
    const problems = problemsAfter((raw) => { nodeOf(raw, node.id).actuatorBinding = 'fanSpeedRatio'; });
    expect(problems).toContain(`node "${node.id}": puts actuator "fanSpeedRatio" into effect`);
  });

  it('rejects finance enabled by a node that does not open the allocation control', () => {
    const { node } = hostNode('computeProfitAllocationRatio');
    const other = [...reg.nodes.values()].find((entry) => entry.phaseId === node.phaseId && entry.id !== node.id);
    if (!other) throw new Error('no sibling node');
    const problems = problemsAfter((raw) => { nodeOf(raw, other.id).systemFlags = ['ENABLES_CORPORATE_FINANCE']; });
    expect(problems).toContain(`node "${other.id}": puts actuator "computeProfitAllocationRatio" into effect`);
  });
});
