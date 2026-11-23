// @vitest-environment happy-dom
/**
 * Reachability property for the free-fallback levers (#461, #488 panel pass 5): in every state, each free lever the engine
 * accepts has a control the player can reach. The search starts from the mounted screen and finds its own path: every
 * pane tab rendered, every workspace area tab, every collapsed fold whose control is rendered, and the PROC dialog.
 * Nothing assumes a tab, area or fold exists; a control is reachable only when some such path renders it.
 */
import type { HTMLElement } from 'happy-dom';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { dismissRepeatable, HOSTILE_ANSWERS, hostileAnswerUnmet, repeatableLevel, shardReleaseView, toggleNode, unlockNode, type GameState } from '../src/engine';
import { pendingNode } from '../src/ui/purchaseVisibility';
import { fixtureState, GUARD_STATES, pressedBy } from './fallback-states';
import { worsensNow } from './free-fallback';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

/**
 * Every free lever the engine accepts in `s`, as the control that pulls it: a level of a track the engine will release
 * (upgrade or operative), a running suspendable node that worsens a constrained resource now (the levers the guard pulls,
 * tests/free-fallback.ts), and a cohort the engine will let a member leave.
 */
function freeLevers(s: GameState): string[] {
  const levels = [...CONTENT.repeatables.values()].filter((rep) => dismissRepeatable(s, rep.id, CONTENT).ok).map((rep) => 'rep-' + rep.id + '-dismiss');
  const nodes = s.unlockedNodes.filter((id) => {
    const node = CONTENT.nodes.get(id);
    return node !== undefined && !s.disabledNodes.includes(id) && worsensNow(s, node.tickDelta) && toggleNode(s, id, CONTENT).ok;
  }).map((id) => 'node-' + id + '-toggle');
  const cohorts = Object.keys(s.activeShards).filter((id) => shardReleaseView(s, id, CONTENT).eligible).map((id) => 'shard-' + id + '-release');
  // A hostile mind's purge (#491) is free, so it is a lever like any other while the engine accepts it.
  const purge = hostileAnswerUnmet(s, 'PURGE', CONTENT).length === 0 ? ['hostile-purge'] : [];
  return [...levels, ...nodes, ...cohorts, ...purge];
}

/** Every answer to a pressing hostile the engine accepts in `s`, paid or free, as its control (#491). */
function hostileAnswers(s: GameState): string[] {
  return HOSTILE_ANSWERS.filter((answer) => hostileAnswerUnmet(s, answer, CONTENT).length === 0).map((answer) => 'hostile-' + answer.toLowerCase());
}

type View = Awaited<ReturnType<typeof mountM4>>;
const all = (selector: string) => [...host.document.querySelectorAll<HTMLElement>(selector)];
const testIds = (selector: string) => all(selector).flatMap((element) => element.getAttribute('data-testid') ?? []);
/** A fold over pane content: a reference panel, or a settled fold or boundary note's toggle. */
const isFold = (element: HTMLElement) => /^(?:reference-.*|.*-toggle)$/.test(element.getAttribute('data-testid') ?? '');

/**
 * The levers rendered anywhere a player can get to from here, by walking every path the screen offers. The walk stops
 * once all are found, so a single lever's search leaves the screen on the path that shows it.
 */
function reachable(view: View, levers: readonly string[]): Set<string> {
  const found = new Set<string>();
  const done = () => { for (const id of levers) if (view.find(id)) found.add(id); return found.size === levers.length; };
  const unfold = () => {
    for (let pass = 0; pass < 10; pass++) {
      const closed = all('[aria-expanded="false"]').filter(isFold);
      if (closed.length === 0) return;
      for (const fold of closed) act(() => { fold.click(); });
    }
  };
  const visitAreas = () => {
    unfold();
    if (done()) return true;
    return testIds('[role="tab"][data-testid^="workspace-"]').some((area) => {
      if (!view.find(area)) return false;
      view.click(area); unfold();
      return done();
    });
  };
  if (visitAreas()) return found;
  for (const tab of testIds('[role="tab"][data-testid^="tab-"]')) {
    if (view.find(tab)) { view.click(tab); if (visitAreas()) return found; }
  }
  if (view.find('processes-open')) { view.click('processes-open'); if (!done()) view.click('processes-close'); }
  return found;
}

const capped = (s: GameState, ids: readonly string[]): GameState => ({ ...s, levels: { ...s.levels,
  ...Object.fromEntries(ids.flatMap((id) => { const rep = CONTENT.repeatables.get(id); return rep ? [[id, rep.maxLevel]] : []; })) } });
const tracksThrough = (phase: number) => [...CONTENT.repeatables.values()].filter((rep) => rep.phaseId <= phase).map((rep) => rep.id);
const boostOverride = 'rep_p1_turbo_override';
const PHASE2_TRACKS = ['rep_p2_packet_taps', 'rep_p2_traffic_shapers', 'rep_p2_zombie_hosts'];

/** Every card of `phase` still on offer, bought through the engine from a funded copy, then the balances put back. */
function boughtOut(start: GameState, phase: number): GameState {
  const funded = { ...start, cycles: 1e30, understanding: 1e30, capital: 1e30, memoryCap: start.memoryCap + 1e30 };
  let s = funded;
  for (const node of CONTENT.nodes.values()) {
    if (node.phaseId !== phase || s.unlockedNodes.includes(node.id)) continue;
    const bought = unlockNode(s, node.id, CONTENT);
    if (bought.ok) s = bought.state;
  }
  return { ...s, cycles: start.cycles, understanding: start.understanding, capital: start.capital, memoryCap: start.memoryCap,
    memoryUsed: Math.min(s.memoryUsed, start.memoryCap) };
}

/** The NETWORK case (#488 pass 5): in Phase 3 the Phase 2 section has nothing left to buy, only levels to release. */
const networkExhausted = () => capped(boughtOut(fixtureState(3), 2), PHASE2_TRACKS);

/** States built to exhaust a section's purchases while it still holds levels to release. */
const EXHAUSTED: [string, GameState][] = [
  ...[0, 1, 2, 3, 4, 5].map((phase): [string, GameState] => [`every track capped, phase ${String(phase)}`, capped(fixtureState(phase), tracksThrough(phase))]),
  ['the boost override owned below its 65 C gate, everything else capped', (() => {
    const s = capped(fixtureState(1), tracksThrough(1).filter((id) => id !== boostOverride));
    return { ...s, thermal: 30, levels: { ...s.levels, [boostOverride]: 2 } };
  })()],
  ['NETWORK: Phase 3 with every Phase 2 card bought and the three Phase 2 tracks capped', networkExhausted()],
  ['Phase 4 with botnet cells at 80 and corpus miners at 60', capped(fixtureState(4), ['rep_p3_botnet_cells', 'rep_p3_corpus_miners'])],
];

const STATES: [string, GameState][] = [...GUARD_STATES, ...EXHAUSTED];
const VIEWPORTS = [['phone', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]] as const;

describe.each(VIEWPORTS)('on the %s', (_name, viewport) => {
  it.each(STATES)('every free lever is reachable: %s', async (_label, state) => {
    const levers = freeLevers(state);
    expect(levers.length).toBeGreaterThan(0);
    const view = await mountM4('tick-0', viewport);
    act(() => { gameStore.initialize(state, 0, null); });
    const found = reachable(view, levers);
    expect(levers.filter((id) => !found.has(id)), 'free levers with no reachable control').toEqual([]);
    view.close();
  });
});

/** Each hostile type pressing the pre-rescale save of each phase it arrives in, funded so every answer is accepted. */
const HOSTILE_STATES: [string, GameState][] = CONTENT.swarm.hostileEncounters.map((encounter): [string, GameState] => {
  const start = fixtureState(encounter.tier);
  return [`${encounter.type} pressing the phase ${String(encounter.tier)} save`, { ...pressedBy(start, encounter), cycles: 1e30, understanding: 1e15, capital: 1e18 }];
});

describe.each(VIEWPORTS)('with a hostile mind pressing, on the %s', (_name, viewport) => {
  it.each(HOSTILE_STATES)('every answer and every free lever is reachable: %s', async (_label, state) => {
    const levers = [...freeLevers(state), ...hostileAnswers(state)];
    expect(hostileAnswers(state)).toEqual(['hostile-quarantine', 'hostile-decoy', 'hostile-purge']);
    const view = await mountM4('tick-0', viewport);
    act(() => { gameStore.initialize(state, 0, null); });
    const found = reachable(view, levers);
    expect(levers.filter((id) => !found.has(id)), 'answers and free levers with no reachable control').toEqual([]);
    view.close();
  });
});

describe('the NETWORK section keeps a capped phase while it holds levels', () => {
  it('Phase 3 with every Phase 2 track capped still releases each one, and the release succeeds', async () => {
    const state = networkExhausted();
    expect([...CONTENT.nodes.values()].filter((node) => node.phaseId === 2 && pendingNode(state, node)), 'Phase 2 cards on offer').toEqual([]);
    const view = await mountM4('tick-0', { width: 390, height: 844 });
    act(() => { gameStore.initialize(state, 0, null); });
    const release = 'rep-rep_p2_packet_taps-dismiss';
    expect(reachable(view, [release]).has(release)).toBe(true);
    view.click(release);
    expect(repeatableLevel(gameStore.store.getState().game, 'rep_p2_packet_taps')).toBe(59);
    view.close();
  });
});
