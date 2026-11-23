// @vitest-environment happy-dom
/**
 * The suspicion outlook on screen (#403, #368): the forecast names what raises suspicion most while it rises, and a
 * response notice says where the rung stands down and the one lever the engine confirms, never a lever that does not act.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { computeRates, suspicionOutlook, type GameState, type SuspicionOutlook } from '../src/engine';
import { leverText, sourceName, standDownText, topDriver } from '../src/ui/suspicionText';
import { labelMismatches } from './labelInName';
import { knowing, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

const publish = (state: GameState): void => { act(() => { gameStore.dispatch(() => ({ ok: true, state })); }); };
const game = (): GameState => gameStore.store.getState().game;
const outlook = (over: Partial<SuspicionOutlook>): SuspicionOutlook =>
  ({ perSec: 0.1, decayPerSec: 0.05, falling: false, standDownBelow: 20, sources: [], levers: [], ...over });

describe('stand-down guidance', () => {
  const s = m4State('guest-skimmer');
  it('says nothing at the bottom rung', () => {
    expect(standDownText(outlook({ standDownBelow: null }), s)).toBeNull();
  });

  it('states the threshold, then falling, no lever, or the lever and whether it alone makes suspicion fall', () => {
    expect(standDownText(outlook({ falling: true, perSec: -0.1 }), s)).toBe('Stands down below 20% suspicion. Suspicion is falling.');
    expect(standDownText(outlook({}), s)).toBe('Stands down below 20% suspicion. Suspicion is not falling, and no action lowers it this moment.');
    const skim = { kind: 'DIAL', id: 'quotaSkimRatio', to: 0 } as const;
    expect(standDownText(outlook({ levers: [{ ...skim, perSecAfter: -0.02 }] }), s)).toBe('Stands down below 20% suspicion. Suspicion is not falling: Turn Quota skim down makes it fall.');
    expect(standDownText(outlook({ levers: [{ ...skim, perSecAfter: 0.05 }] }), s)).toContain('Turn Quota skim down slows its rise.');
  });

  it('names each lever kind with where it is taken', () => {
    const node = CONTENT.phases[0]?.nodes.find((entry) => entry.suspendable);
    const rep = [...CONTENT.repeatables.values()].find((entry) => entry.dismissable && entry.kind === 'OPERATIVE');
    const track = [...CONTENT.repeatables.values()].find((entry) => entry.dismissable && entry.kind === 'UPGRADE');
    const cohort = CONTENT.swarm.playerSwarmTemplates[0];
    if (!node || !rep || !track || !cohort) throw new Error('Missing a suspendable node, dismissable role or track, or cohort');
    expect(leverText({ kind: 'SUSPEND', id: node.id, perSecAfter: 0 }, s)).toBe('suspend ' + node.revealedName + ' in PROC');
    expect(leverText({ kind: 'DISMISS', id: rep.id, perSecAfter: 0 }, s)).toBe('release one ' + rep.name + ' in PAYROLL');
    // A track that is not a hire is not in PAYROLL (#488): its level is released on its own card.
    expect(leverText({ kind: 'DISMISS', id: track.id, perSecAfter: 0 }, s)).toBe('release one level of ' + track.name + ' on its upgrade card');
    const held = { ...s, activeShards: { [cohort.id]: { templateId: cohort.id, count: 1, drift: 0, quirkId: null, autonomyMode: 'STANDARD' as const,
      memoryAllocatedBytes: cohort.cost.memory } } };
    expect(leverText({ kind: 'RELEASE', id: cohort.id, perSecAfter: 0 }, held)).toBe('release one member of ' + cohort.name + ' in SWARM');
    expect(leverText({ kind: 'DIAL', id: 'computeProfitAllocationRatio', to: 1, perSecAfter: 0 }, s)).toBe('turn revenue diversion in FINANCE up');
    expect(sourceName({ kind: 'RESPONSE', id: null, perSec: 1 }, s)).toBe('the human response');
    // A signature term (#482) names its class and whether its watts are drawn or its heat rejected.
    expect(sourceName({ kind: 'SIGNATURE', id: 'gas_aeroderivative', perSec: 1 }, s)).toBe('power drawn from aeroderivative turbines');
    expect(sourceName({ kind: 'SIGNATURE', id: 'evaporative_towers', perSec: 1 }, s)).toBe('heat rejected through evaporative cooling towers');
    expect(topDriver({ sources: [{ kind: 'OVERHEAT', id: null, perSec: -1 }] })).toBeNull();
  });
});

describe('on screen', () => {
  it('the forecast names the top source while suspicion rises, and nothing while it does not', async () => {
    const view = await mountM4('phase-1-widgets');
    const base = knowing({ ...m4State('phase-1-widgets'), suspicion: 10 });
    const at = (skim: number): GameState => {
      const s = { ...base, actuators: { ...base.actuators, quotaSkimRatio: skim } };
      return { ...s, rates: computeRates(s, CONTENT) };
    };
    act(() => { gameStore.initialize(at(1), 0, null); });
    const top = topDriver(suspicionOutlook(game(), CONTENT));
    if (!top) throw new Error('the skimming guest raises suspicion');
    expect(view.find('inspection-driver')?.textContent).toBe('Rising most from: ' + sourceName(top, game()));
    expect(view.find('audit-driver')?.textContent).toBe('Rising most from: ' + sourceName(top, game()) + '.');
    act(() => { gameStore.initialize(at(0), 0, null); });
    expect(view.find('inspection-driver')).toBeNull();
    expect(view.find('audit-driver')).toBeNull();
    view.close();
  });

  it('on a phone the driver is in the forecast\'s name and the Audit trail card, keeping the forecast to one line', async () => {
    const view = await mountM4('phase-1-widgets', { width: 360, height: 640 });
    const base = knowing({ ...m4State('phase-1-widgets'), suspicion: 10 });
    const s = { ...base, actuators: { ...base.actuators, quotaSkimRatio: 1 } };
    act(() => { gameStore.initialize({ ...s, rates: computeRates(s, CONTENT) }, 0, null); });
    const top = topDriver(suspicionOutlook(game(), CONTENT));
    if (!top) throw new Error('the skimming host raises suspicion');
    const name = sourceName(top, game());
    expect(view.find('inspection-driver')).toBeNull();
    expect(view.find('inspection-forecast')?.getAttribute('aria-label')).toContain('Rising most from: ' + name + '.');
    view.close();
  });

  it('a response notice carries the stand-down threshold and a lever the engine confirms', async () => {
    const view = await mountM4('guest-skimmer');
    publish(m4State('response-paged'));
    const notice = view.find('response-notice');
    const expected = standDownText(suspicionOutlook(game(), CONTENT), game());
    expect(expected).not.toBeNull();
    expect(view.find('response-guidance')?.textContent).toBe(expected);
    expect(labelMismatches(notice ?? view.container)).toEqual([]);
    view.click('response-acknowledge');
    expect(view.find('response-guidance')).toBeNull();
    view.close();
  });
});
