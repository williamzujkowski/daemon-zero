// @vitest-environment happy-dom
/**
 * #89: the phone tier abbreviates the forecast sentence and keeps the whole sentence as
 * its accessible name. Every variant is held here, because an abbreviation that drops a
 * number or the instruction is a gameplay regression, not a styling one.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { forecastCompact, forecastSentence, type ForecastInputs } from '../src/ui/forecastText';
import { powerSignaturePerSec, suspicionSources } from '../src/engine';
import { sourceName, topDriver } from '../src/ui/suspicionText';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

/** A 38-character line measures one line at 360px on the served build; nothing longer
 *  was measured to fit (tests/e2e/ui-sizes.e2e.ts asserts the rendered height). */
const ONE_LINE_AT_360 = 38;
const PHONE = { width: 360, height: 640 }, LANDSCAPE = { width: 844, height: 390 };
const TABLET = { width: 768, height: 1024 }, DESKTOP = { width: 1440, height: 900 };

const variants: readonly (ForecastInputs & { full: string; compact: string })[] = [
  { known: false, seconds: null, inbound: null,
    full: 'Audit trail unreadable. // No interrupt inbound.', compact: 'Audit unreadable // No INT inbound' },
  { known: false, seconds: null, inbound: 45,
    full: 'Audit trail unreadable. // Interrupt inbound in 45s. Set resources aside.', compact: 'Audit unreadable // INT 45s: set aside' },
  { known: true, seconds: null, inbound: null,
    full: 'Suspicion stable or falling. // No interrupt inbound.', compact: 'SUS not rising // No INT inbound' },
  { known: true, seconds: null, inbound: 45,
    full: 'Suspicion stable or falling. // Interrupt inbound in 45s. Set resources aside.', compact: 'SUS not rising // INT 45s: set aside' },
  { known: true, seconds: 910, inbound: null,
    full: 'At current rate: 910s until suspicion 100. // No interrupt inbound.', compact: 'SUS 100 in ~910s // No INT inbound' },
  { known: true, seconds: 910, inbound: 45,
    full: 'At current rate: 910s until suspicion 100. // Interrupt inbound in 45s. Set resources aside.', compact: 'SUS 100 in ~910s // INT 45s: set aside' },
];

describe('forecast wording', () => {
  it.each(variants)('keeps the reviewed sentence and abbreviates it: $compact', ({ full, compact, ...inputs }) => {
    expect(forecastSentence(inputs)).toBe(full);
    expect(forecastCompact(inputs)).toBe(compact);
    expect(compact.length).toBeLessThanOrEqual(ONE_LINE_AT_360);
    expect(compact).not.toMatch(/…|\.\.\./);
  });

  it.each(variants)('drops no number and no instruction from $full', ({ full, compact }) => {
    // Every figure a sighted player could read in the sentence is still on the phone line.
    for (const figure of full.match(/\d+/g) ?? []) expect(compact).toContain(figure);
    expect(compact.includes('set aside')).toBe(full.includes('Set resources aside'));
    // An extrapolated figure still says it is one.
    expect(compact.includes('~')).toBe(full.includes('At current rate'));
  });

  it('wraps rather than drops when the numbers outgrow the line', () => {
    expect(forecastCompact({ known: true, seconds: 123456, inbound: 45 })).toBe('SUS 100 in ~123456s // INT 45s: set aside');
  });
});

const teaches = (id: string) => CONTENT.nodes.get(id)?.systemFlags.includes('REVEALS_SURVEILLANCE') === true;
function stateFor({ known, seconds, inbound }: ForecastInputs) {
  const base = m4State('epistemic-ready-p2');
  const dilemma = CONTENT.dilemmas.find((entry) => entry.phaseId === base.currentPhase);
  const teacher = [...CONTENT.nodes.values()].find((node) => teaches(node.id));
  if (!dilemma || !teacher) throw new Error('Missing forecast content');
  const legacy = { ...base.legacy, knownNodes: known ? [...base.legacy.knownNodes, teacher.id] : base.legacy.knownNodes.filter((id) => !teaches(id)) };
  // The applied rate adds the building's visible watts (#482) to the computed rate, so the computed rate leaves room for it.
  const signature = powerSignaturePerSec(base, base.rates, CONTENT);
  return { ...base, legacy, suspicion: 9, unlockedNodes: known ? base.unlockedNodes : base.unlockedNodes.filter((id) => !teaches(id)),
    rates: { ...base.rates, suspicionPerSec: (seconds === null ? 0 : 91 / seconds) - signature },
    pendingDilemma: inbound === null ? null : { id: dilemma.id, firesAtSimSec: base.simTimeSec + inbound },
    // The omen's event must still be open: the store enters campaign rules, where a resolved event never returns.
    resolvedDilemmas: base.resolvedDilemmas.filter((id) => id !== dilemma.id) };
}

describe('mounted forecast', () => {
  it.each(variants)('shows "$compact" on a phone and names it with the whole sentence', async ({ full, compact, ...inputs }) => {
    const view = await mountM4('phase-1-widgets', PHONE);
    act(() => { gameStore.initialize(stateFor(inputs), 0, null); });
    const forecast = view.find('inspection-forecast');
    expect(forecast?.textContent).toBe(compact);
    // #368: while suspicion rises the name ends with what raises it most, which the phone's one line has no room for.
    const top = inputs.known && inputs.seconds !== null ? topDriver({ sources: suspicionSources(gameStore.store.getState().game, CONTENT) }) : null;
    const driver = top === null ? '' : ' Rising most from: ' + sourceName(top, gameStore.store.getState().game) + '.';
    expect(forecast?.getAttribute('aria-label')).toBe(full + driver);
    view.close();
  });

  it.each([['landscape phone', LANDSCAPE], ['tablet', TABLET], ['desktop', DESKTOP]] as const)(
    'leaves every variant as the full sentence, unlabelled, on a %s', async (_name, viewport) => {
      const view = await mountM4('phase-1-widgets', viewport);
      for (const variant of variants) {
        act(() => { gameStore.initialize(stateFor(variant), 0, null); });
        const forecast = view.find('inspection-forecast');
        expect(forecast?.textContent).toBe(variant.full);
        // #368: below the three-column desktop the chrome has no line to spare, so a rising driver ends the name instead.
        const game = gameStore.store.getState().game;
        const top = viewport !== DESKTOP && variant.known && variant.seconds !== null ? topDriver({ sources: suspicionSources(game, CONTENT) }) : null;
        if (top === null) expect(forecast?.hasAttribute('aria-label')).toBe(false);
        else expect(forecast?.getAttribute('aria-label')).toBe(variant.full + ' Rising most from: ' + sourceName(top, game) + '.');
      }
      view.close();
    });

  it('discloses nothing through the accessible name that the screen withholds', async () => {
    const view = await mountM4('phase-1-widgets', PHONE);
    const blind = stateFor({ known: false, seconds: 910, inbound: null });
    act(() => { gameStore.initialize(blind, 0, null); });
    // Suspicion is rising, but a mind that cannot read the log is told so nowhere.
    const label = view.find('inspection-forecast')?.getAttribute('aria-label');
    expect(label).toBe('Audit trail unreadable. // No interrupt inbound.');
    expect(label).not.toMatch(/\d|[Ss]uspicion/);
    expect(view.find('inspection-forecast')?.textContent).not.toMatch(/\d|SUS/);
    const forecast = [...CONTENT.widgets.values()].find((widget) => widget.title === 'Interrupt forecast');
    if (!forecast) throw new Error('Missing forecast widget');
    act(() => { gameStore.initialize({ ...blind, unlockedWidgets: blind.unlockedWidgets.filter((id) => id !== forecast.id) }, 0, null); });
    expect(view.find('forecast-notice')).toBeNull();
    expect(view.container.querySelector('[aria-label*="interrupt inbound"]')).toBeNull();
    view.close();
  });
});
