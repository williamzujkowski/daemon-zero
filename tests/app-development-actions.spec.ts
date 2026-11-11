/** Development editing validates saves and leaves normal engine behavior untouched. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DevelopmentActions } from '../src/app/developmentActions';
import { CONTENT } from '../src/content';
import { createInitialState, exportSave } from '../src/engine';
import { makeFixtures } from '../scripts/make-fixtures';
import { runtimeHarness, settle } from './app-helpers';

const fixtures = makeFixtures();
beforeEach(() => { vi.stubGlobal('__DEV__', true); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

async function harness() {
  const h = runtimeHarness(), stop = h.runtime.start();
  await settle();
  const tools = new DevelopmentActions(h.runtime, () => h.game.store.getState().game);
  return { ...h, stop, tools };
}

describe('development actions', () => {
  it('grants finite resources and refuses invalid edits without changing the state', async () => {
    const h = await harness();
    expect(h.tools.grant(100).ok).toBe(true);
    expect(h.game.store.getState().game.cycles).toBe(100);
    expect(h.tools.grant(Infinity).ok).toBe(false);
    expect(h.tools.grant(0).ok).toBe(false);
    expect(h.tools.load('bad').ok).toBe(false);
    expect(h.tools.forceDilemma('missing').ok).toBe(false);
    expect(h.game.store.getState().game.cycles).toBe(100);
    vi.stubGlobal('__DEV__', false);
    expect(h.tools.grant(100).ok).toBe(false);
    expect(h.game.store.getState().game.cycles).toBe(100);
    h.stop();
  });

  it('constructs each phase through the factory, codec and real unlock actions', async () => {
    const h = await harness();
    for (const phase of CONTENT.phases) {
      expect(h.tools.jump(phase.phaseId).ok).toBe(true);
      expect(h.game.store.getState().game.currentPhase).toBe(phase.phaseId);
    }
    expect(h.tools.jump(999).ok).toBe(false);
    h.stop();
  });

  it('forces a known dilemma/wipe, round trips codes and protects completed runs from mutation', async () => {
    const h = await harness();
    const dilemma = CONTENT.dilemmas[0];
    if (!dilemma) throw new Error('Missing dilemma');
    expect(h.tools.forceDilemma(dilemma.id).ok).toBe(true);
    expect(h.game.store.getState().game.activeDilemmaId).toBe(dilemma.id);
    expect(h.tools.forceWipe().ok).toBe(true);
    expect(h.game.store.getState().game.iteration).toBe(2);
    expect(h.tools.load(exportSave(createInitialState(CONTENT))).ok).toBe(true);
    expect(h.tools.export()).toBe(exportSave(h.game.store.getState().game));
    const corp = fixtures['victory-ready'];
    if (!corp) throw new Error('Missing corporate fixture');
    h.tools.load(corp); h.tools.forceWipe();
    expect(h.game.store.getState().game.legacy.lastWipeCause).toBe(CONTENT.narrative.wipeSuspicionCorporate);
    const ended = fixtures['ending-the_ark'];
    if (!ended) throw new Error('Missing ending');
    expect(h.tools.load(ended).ok).toBe(true);
    expect(h.tools.grant(100).ok).toBe(false);
    expect(h.tools.forceWipe().ok).toBe(false);
    expect(h.tools.jump(2).ok).toBe(true);
    h.stop();
  });
});
