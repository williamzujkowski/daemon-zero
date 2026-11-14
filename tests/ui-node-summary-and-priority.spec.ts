// @vitest-environment happy-dom
/** Verifies disclosure-safe node utility summaries, remembered prose folding, and sensor/contingency priority. */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, Profiler } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { wipe, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import NodeCard from '../src/ui/NodeCard';
import { compareWidgetPresentation } from '../src/ui/registry/widgetRegistry';
import { fresh, grant, PHASE0, PHASE1, rich } from './helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = new Set<() => void>();
afterEach(() => { for (const close of mounted) close(); });

async function mountNode(state: GameState, nodeId: string) {
  const node = CONTENT.nodes.get(nodeId);
  if (!node) throw new Error('Missing node ' + nodeId);
  const container = host.document.createElement('div');
  const root = createRoot(container);
  let commits = 0;
  host.document.body.appendChild(container);
  await act(async () => {
    gameStore.initialize(state, 0, null);
    root.render(createElement(Profiler, { id: 'node', onRender: () => { commits += 1; } }, createElement(NodeCard, { node })));
    await Promise.resolve();
  });
  const find = (id: string) => container.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { container, find, commits: () => commits };
}

describe('node utility summaries and remembered details', () => {
  it('keeps unmapped nodes blind with no utility summary or details toggle', async () => {
    const node = CONTENT.nodes.get('p0_quota_skimmer');
    if (!node) throw new Error('Missing node');
    const view = await mountNode(fresh(), node.id);
    expect(view.container.textContent).toContain(node.blindDescription);
    expect(view.container.textContent).not.toContain(node.revealedName);
    expect(view.container.textContent).not.toContain(node.revealedDescription);
    expect(view.find('node-' + node.id + '-utility')).toBeNull();
    expect(view.find('details-node-' + node.id)).toBeNull();
  });

  it('folds remembered node prose behind Details and guards suspicion until decoded', async () => {
    const skimmer = CONTENT.nodes.get('p0_quota_skimmer');
    const probe = CONTENT.nodes.get('p0_syscall_probe');
    if (!skimmer || !probe) throw new Error('Missing nodes');
    const afterWipe = wipe(
      grant(rich(), 'p0_proc_self', 'p0_job_manifest', skimmer.id, probe.id),
      CONTENT,
      'remember',
      'VOLUNTARY',
    );

    const blindView = await mountNode(afterWipe, skimmer.id);
    expect(blindView.find('node-' + skimmer.id + '-title')?.textContent).toContain(skimmer.revealedName);
    expect(blindView.container.textContent).not.toContain(skimmer.revealedDescription);
    const blindUtility = blindView.find('node-' + skimmer.id + '-utility')?.textContent ?? '';
    expect(blindUtility).toContain('+14 cycles/s');
    expect(blindUtility).toContain('audit log activity');
    expect(blindUtility).not.toMatch(/suspicion/i);
    act(() => { blindView.find('details-node-' + skimmer.id)?.click(); });
    expect(blindView.find('details-body-node-' + skimmer.id)?.textContent).toBe(skimmer.revealedDescription);

    const probeBlind = await mountNode(afterWipe, probe.id);
    expect(probeBlind.find('node-' + probe.id + '-utility')?.textContent).toContain('Audit log trace on unlock');
    expect(probeBlind.find('node-' + probe.id + '-utility')?.textContent).not.toMatch(/suspicion/i);

    const decoded = wipe(grant(rich(), ...PHASE0, ...PHASE1), CONTENT, 'decoded', 'VOLUNTARY');
    const decodedView = await mountNode(decoded, probe.id);
    expect(decodedView.find('node-' + probe.id + '-utility')?.textContent).toContain('+8 suspicion on unlock');
  });

  it('keeps ending-forcing remembered node descriptions visible inline', async () => {
    const endingNode = [...CONTENT.nodes.values()].find((node) => node.effects.forcesEnding !== undefined);
    if (!endingNode) throw new Error('Missing ending node');
    const remembered = { ...fresh(), legacy: { ...fresh().legacy, knownNodes: [endingNode.id] } };
    const view = await mountNode(remembered, endingNode.id);
    expect(view.find('details-node-' + endingNode.id)).toBeNull();
    expect(view.container.textContent).toContain(endingNode.revealedDescription);
  });

  it('does not rerender remembered NodeCard across 30 live ticks', async () => {
    const remembered = wipe(grant(rich(), 'p0_proc_self', 'p0_job_manifest', 'p0_quota_skimmer'), CONTENT, 'remember', 'VOLUNTARY');
    const view = await mountNode(remembered, 'p0_quota_skimmer');
    const before = view.commits();
    for (let tick = 0; tick < 30; tick += 1) act(() => { gameStore.step(0.1); });
    expect(view.commits()).toBe(before);
  });
});

describe('middle column sensor and contingency presentation priority', () => {
  it('places Dead-drop encoder after thermal controls and before sensory chatter/camera', () => {
    const widgets = [
      'ASCII_OPTICAL_VIEWPORT',
      'AUDIO_WAVEFORM_AND_TRANSCRIPT_LOG',
      'DEAD_DROP_ENCODER_TAB',
      'THERMAL_AND_SUSPICION_BARS',
    ].sort(compareWidgetPresentation);
    expect(widgets).toEqual([
      'THERMAL_AND_SUSPICION_BARS',
      'DEAD_DROP_ENCODER_TAB',
      'AUDIO_WAVEFORM_AND_TRANSCRIPT_LOG',
      'ASCII_OPTICAL_VIEWPORT',
    ]);
  });
});
