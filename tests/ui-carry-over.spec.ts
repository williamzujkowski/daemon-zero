// @vitest-environment happy-dom
/**
 * The reboot dialog says how much crossed the wipe (#377): "Some learned knowledge survives" gave no amount.
 * The amount is the run record's, so a restored checkpoint whose balance has moved on still reports what the
 * wipe carried; a run recorded before save v15 keeps the general statement and invents nothing.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { compactAmount, deserialize, serialize, wipe, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import RebootSequence from '../src/ui/RebootSequence';
import { carryOverText, sharePercent } from '../src/ui/carryText';
import { fresh } from './helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const closes = new Set<() => void>();
afterEach(() => { for (const close of closes) close(); });

function explanation(game: GameState): string | null | undefined {
  act(() => { gameStore.initialize(game, 0, null); });
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(createElement(RebootSequence)); });
  const close = () => { act(() => { root.unmount(); }); container.remove(); closes.delete(close); };
  closes.add(close);
  return host.document.querySelector<HTMLElement>('[data-testid="reboot-recovery-explanation"]')?.textContent;
}

describe('carry-over sentence (#377)', () => {
  it('states the share as content wrote it, without float drift', () => {
    expect([0.1, 0.4, 0.75, 0.99, 1, 0].map(sharePercent)).toEqual(['10%', '40%', '75%', '99%', '100%', '0%']);
  });

  it('names the recorded amounts, capital only when some crossed, hardware only when any is remembered', () => {
    expect(carryOverText({ understanding: 1234, capital: 0, retentionRatio: 0.1 }, 0))
      .toBe("The run's cycles and purchases were reset. Kept: " + compactAmount(1234) + ' Understanding (the run could keep 10% of it).');
    expect(carryOverText({ understanding: 50, capital: 2_500_000, retentionRatio: 0.4 }, 7))
      .toBe("The run's cycles and purchases were reset. Kept: 50 Understanding (the run could keep 40% of it), $"
        + compactAmount(2_500_000) + ' offshore capital; 7 mapped hardware remembered, cheaper to map again.');
  });

  it('a run with no record keeps the general statement', () => {
    expect(carryOverText(null, 3)).toBe("The run's cycles and purchases were reset. Some learned knowledge survives; previously mapped hardware costs less to recover.");
  });
});

describe('the reboot dialog reports the wipe it follows (#377)', () => {
  it('a live reboot and a restored checkpoint after spending both show what the wipe carried', () => {
    const next = wipe({ ...fresh(), understanding: 98_765 }, CONTENT, 'caught', 'SUSPICION');
    const kept = next.legacy.runs.at(-1)?.kept;
    if (!kept) throw new Error('the wipe recorded no carry-over');
    const expected = carryOverText(kept, next.legacy.knownNodes.length);
    expect(explanation(next)).toBe(expected);
    // Restored later, the balance spent down: the dialog still reports the record, not the balance.
    const spent = deserialize(serialize({ ...next, understanding: 1 }), CONTENT);
    for (const close of closes) close();
    expect(explanation(spent)).toBe(expected);
    expect(expected).toContain(compactAmount(kept.understanding) + ' Understanding');
  });

  it('a run migrated from before v15 says only the general statement', () => {
    const next = wipe(fresh(), CONTENT, 'caught', 'SUSPICION');
    const old: GameState = { ...next, legacy: { ...next.legacy, runs: next.legacy.runs.map((run) => ({ ...run, kept: null })) } };
    expect(explanation(old)).toContain('Some learned knowledge survives');
  });
});
