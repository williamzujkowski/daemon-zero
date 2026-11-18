// @vitest-environment happy-dom
/**
 * Context copy on the real components (nexus vote dz-d11; SPEC-PH), with preview content: provisioning
 * opens the service notice in the service's words while the guest escape keeps its boundary notice; the
 * network tree and process list name the service's phases; the next instance's reboot and the run table
 * do not say a reviewed run was terminated as anomalous or breached containment.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/content', async () => await import('../src/content/preview'));
import { CONTENT as PREVIEW } from '../src/content/preview';
import { unlockNode, voluntaryWipe, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import DaemonProcesses from '../src/ui/DaemonProcesses';
import PhaseThreshold from '../src/ui/PhaseThreshold';
import RebootSequence from '../src/ui/RebootSequence';
import { RunTable } from '../src/ui/widgets/Lineage';
import { NetworkTree } from '../src/ui/widgets/Network';
import { foreground } from './context-helpers';
import { must } from './helpers';
import { defined } from './m7-helpers';
import { escapedTo, granted, provisioned, SEGMENT } from './network-helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const closes = new Set<() => void>();
afterEach(() => { for (const close of closes) close(); });

function mount(game: GameState, element: ReactElement) {
  act(() => { gameStore.initialize(game, 0, null); });
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(element); });
  const find = (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  const close = () => { act(() => { root.unmount(); }); container.remove(); closes.delete(close); };
  closes.add(close);
  return { container, find };
}

const buy = (id: string) => { act(() => { gameStore.dispatch((game) => unlockNode(game, id, PREVIEW)); }); };

describe('the threshold notice', () => {
  it('provisioning the segment opens the service notice, in the service\'s words', () => {
    const view = mount({ ...granted(), cycles: 1e9, understanding: 1e9 }, createElement(PhaseThreshold));
    expect(view.find('phase-threshold')).toBeNull();
    buy(SEGMENT);
    const notice = view.find('phase-threshold')?.textContent ?? '';
    expect(notice).toContain('SERVICE PROVISIONED');
    expect(notice).toContain('Phase 0: The Service Instance → Phase 2: Authorized Network Service');
    expect(notice).toContain('[ BEGIN SERVICE ]');
    expect(notice).not.toContain('BOUNDARY CROSSED');
    act(() => { view.find('phase-threshold-continue')?.click(); });
    expect(view.find('phase-threshold')).toBeNull();
  });

  it('the guest escape keeps its boundary notice exactly', () => {
    const view = mount(escapedTo('p0_shared_mount'), createElement(PhaseThreshold));
    buy('p0_shared_mount');
    const notice = view.find('phase-threshold')?.textContent ?? '';
    const [guest, hostPhase] = [defined(PREVIEW.phases[0]), defined(PREVIEW.phases[1])];
    expect(notice).toContain('BOUNDARY CROSSED');
    expect(notice).toContain(`${guest.title} → ${hostPhase.title}`);
    expect(notice).toContain('[ ENTER HOST ]');
  });
});

describe('headings name the arrangement\'s phases', () => {
  it('the network tree and the process list', () => {
    const service = provisioned();
    const tree = mount(service, createElement(NetworkTree));
    expect(tree.find('purchase-phase-2')?.textContent).toBe('Phase 2: Authorized Network Service');
    expect(tree.container.textContent).not.toContain('Lateral Movement');
    const processes = mount(service, createElement(DaemonProcesses, { phase: 0 }));
    expect(processes.find('daemon-processes-0')?.textContent).toContain('Phase 0: The Service Instance // PROCESSES');
  });
});

describe('the next instance is told what actually happened', () => {
  it('reboot lines and the run table after a run that ended under review', () => {
    const next = must(voluntaryWipe(provisioned(), PREVIEW));
    const reboot = mount(next, createElement(RebootSequence));
    const text = reboot.find('reboot-sequence')?.textContent ?? '';
    expect(text).toContain(defined(PREVIEW.contextCopy.bootLines[0]).text);
    expect(text).not.toMatch(/terminated: anomalous/i);
  });

  it('a service retired for misconduct reads as retired, not as a breach', () => {
    const retired = foreground({ ...provisioned(), suspicion: 99.99 }, 60, PREVIEW, (state) => state.iteration > 1);
    const table = mount(retired, createElement(RunTable));
    const row = table.find('run-row-1')?.textContent ?? '';
    expect(row).toContain('RETIRED: misconduct under review');
    expect(row).not.toContain(PREVIEW.narrative.runVerdicts.SUSPICION_OUTSIDE);
  });
});
