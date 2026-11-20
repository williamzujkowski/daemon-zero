/** The transitions spec's pure rules (#339): C1 (in view or badged, announced, untruncated, one consistent alert,
 *  focus kept), C2 (timely items, primary action, pointer target), B5 (displacement), the recorded-gap reconciliation
 *  under the stage atlas's rule, and the gallery's transition card. */
import { describe, expect, it } from 'vitest';
import type { Announcement, Observed } from './e2e/atlas/announce';
import type { ItemMeasure } from './e2e/atlas/contractCheck';
import { formatFailure } from './e2e/atlas/gates';
import { reconcile, type KnownGap } from './e2e/atlas/knownGaps';
import { B5_TOLERANCE_PX, badgedTabs, displacement, transitionFailures, type TransitionInput, type TransitionRule } from './e2e/atlas/transitionCheck';
import { TRANSITION_GAPS } from './e2e/atlas/transitionGaps';
import type { TransitionRecord } from './e2e/atlas/transitionRun';
import { checksOf, type TransitionRow } from './e2e/atlas/transitionTypes';
import { isStageId } from './e2e/atlas/types';
import { transitionSection, transitionSummary } from './e2e/audit/transitionCard';

const measure = (over: Partial<ItemMeasure> = {}): ItemMeasure => ({
  key: 'skim.increase', kind: 'primary', locate: 'button /skim/', fallback: false, found: true,
  box: { x: 16, y: 120, width: 358, height: 44 }, visibleRatio: 1, fold: 844, inFirstViewport: true, rank: 60, aria: null, ...over,
});
const said = (over: Partial<Announcement> = {}): Announcement => ({ kind: 'live', role: 'alert', live: null, testId: 'omen-notice', text: 'HARNESS_LOG: job', count: 1, ...over });
const observed = (over: Partial<Observed> = {}): Observed => ({ announcements: [], focus: null, focusInDialog: false, tabs: {}, ...over });
const input = (over: Partial<TransitionInput> = {}): TransitionInput => ({
  id: 't-skim-unlock', viewport: '390x844', observed: observed(), tabsBefore: {}, kept: [],
  primary: { before: null, after: null, kept: false, steady: false }, ...over,
});
const appear = (over: Partial<NonNullable<TransitionInput['appear']>> = {}): NonNullable<TransitionInput['appear']> =>
  ({ item: measure(), inDialog: false, pane: null, paneShown: true, truncatedPx: 0, ...over });
const rules = (value: TransitionInput): TransitionRule[] => transitionFailures(value).map((failure) => failure.rule);

describe('C1: the new item', () => {
  it('passes when it is fully in view and a live region names it', () => {
    expect(rules(input({ appear: appear({ announce: /skim/i }), observed: observed({ announcements: [said({ text: 'Quota skim online' })] }) }))).toEqual([]);
  });

  it('fails in-view with the measured numbers when it is below the fold, and when it is missing', () => {
    const below = transitionFailures(input({ appear: appear({ item: measure({ inFirstViewport: false, visibleRatio: 0, box: { x: 16, y: 2795, width: 328, height: 22 } }) }) }));
    expect(below.map(formatFailure)).toEqual(['t-skim-unlock @ 390x844 | skim.increase | new-in-view | box 16,2795,328,22; visibleRatio 0; fold 844 | gallery #t-skim-unlock--390x844']);
    expect(rules(input({ appear: appear({ item: measure({ found: false }) }) }))).toEqual(['new-in-view']);
  });

  it('accepts a badge on the tab of a pane that is not shown, and fails without one', () => {
    const off = appear({ pane: 'SENSORS', paneShown: false, item: measure({ found: false }) });
    expect(rules(input({ appear: off, tabsBefore: { 'tab-SENSORS': 'SENSORS pane' }, observed: observed({ tabs: { 'tab-SENSORS': 'SENSORS pane, fan online' } }) }))).toEqual([]);
    expect(rules(input({ appear: off, tabsBefore: { 'tab-SENSORS': 'SENSORS pane' }, observed: observed({ tabs: { 'tab-SENSORS': 'SENSORS pane' } }) }))).toEqual(['new-in-view']);
  });

  it('does not count a kernel log line, or live text that does not match, as an announcement', () => {
    const value = input({ appear: appear({ announce: /skim/i }), observed: observed({ announcements: [said({ kind: 'log', text: 'SKIMMER_ONLINE' }), said({ text: 'RESPONSE ESCALATED' })] }) });
    expect(transitionFailures(value).map((failure) => [failure.rule, failure.measured.detail])).toEqual([['new-announced', 'live alert: RESPONSE ESCALATED']]);
  });

  it('counts an opened dialog, a badge, or focus inside the dialog as announcing a dialog item', () => {
    const dialog = appear({ inDialog: true, announce: /reboot/i });
    expect(rules(input({ appear: dialog, observed: observed({ announcements: [said({ kind: 'dialog', role: null, text: 'Core reboot' })] }) }))).toEqual([]);
    expect(rules(input({ appear: dialog, observed: observed({ focus: 'reboot-continue', focusInDialog: true }) }))).toEqual([]);
    expect(rules(input({ appear: appear({ announce: /x/ }), tabsBefore: { a: 'A' }, observed: observed({ tabs: { a: 'A, waiting' } }) }))).toEqual([]);
  });

  it('flags clipped text past one px of rounding, and focus left on the body when focus is expected', () => {
    expect(rules(input({ appear: appear({ truncatedPx: 1 }) }))).toEqual([]);
    expect(rules(input({ appear: appear({ truncatedPx: 91 }) }))).toEqual(['new-truncated']);
    expect(rules(input({ appear: appear({ focus: true }) }))).toEqual(['focus-lost']);
    expect(rules(input({ appear: appear({ focus: true }), observed: observed({ focus: 'manual-cycle' }) }))).toEqual([]);
  });

  it('allows one alert region per condition, and flags a role whose politeness contradicts it', () => {
    const alerts = /brownout|deficit/i;
    const two = [said({ testId: 'brownout-warning', text: 'BROWNOUT: cycle deficit' }), said({ testId: 'cycle-deficit', text: 'net -10 cycles/s: deficit' })];
    expect(transitionFailures(input({ appear: appear({ alerts }), observed: observed({ announcements: two }) })).map((failure) => [failure.rule, failure.measured.value]))
      .toEqual([['one-alert', 2]]);
    expect(rules(input({ appear: appear({ alerts }), observed: observed({ announcements: [said({ text: 'BROWNOUT', live: 'polite' })] }) }))).toEqual(['politeness']);
    expect(rules(input({ appear: appear({ alerts }), observed: observed({ announcements: [said({ text: 'BROWNOUT', role: 'status', live: 'assertive' })] }) }))).toEqual(['politeness']);
    expect(rules(input({ appear: appear({ alerts }), observed: observed({ announcements: [said({ text: 'BROWNOUT', role: 'status', live: 'polite' })] }) }))).toEqual([]);
  });
});

describe('C2 and B5: what stays put', () => {
  it('fails a timely item that left the view or vanished, and the primary action when it must stay', () => {
    const kept = [measure({ key: 'hud.cycles', kind: 'timely', inFirstViewport: false, visibleRatio: 0 }), measure({ key: 'hud.thermal', kind: 'timely', found: false })];
    expect(transitionFailures(input({ kept })).map((failure) => `${failure.item} ${failure.rule}`)).toEqual(['hud.cycles timely-kept', 'hud.thermal timely-kept']);
    expect(rules(input({ primary: { before: null, after: measure({ inFirstViewport: false }), kept: true, steady: false } }))).toEqual(['primary-kept']);
    expect(rules(input({ primary: { before: null, after: null, kept: true, steady: false } }))).toEqual(['primary-kept']);
  });

  it('fails a different enabled control under the pointer, and nothing else', () => {
    const pointer = (after: { testId: string | null; interactive: boolean; enabled: boolean } | null) => input({ pointer: { clicked: 'node-x-unlock', after } });
    expect(rules(pointer({ testId: 'node-y-unlock', interactive: true, enabled: true }))).toEqual(['pointer-target']);
    expect(rules(pointer({ testId: 'node-y-unlock', interactive: true, enabled: false }))).toEqual([]);
    expect(rules(pointer({ testId: 'node-x-unlock', interactive: true, enabled: true }))).toEqual([]);
    expect(rules(pointer(null))).toEqual([]);
  });

  it('gates the primary displacement above the tolerance, and an unmeasurable one, only when steady', () => {
    const at = (y: number) => ({ x: 16, y, width: 358, height: 44 });
    const steady = (before: number | null, after: number) => input({ primary: { before: before === null ? null : at(before), after: measure({ box: at(after) }), kept: false, steady: true } });
    expect(rules(steady(289, 289 + B5_TOLERANCE_PX))).toEqual([]);
    expect(transitionFailures(steady(289, 343)).map((failure) => [failure.rule, failure.measured.value, failure.measured.detail])).toEqual([['primary-shift', 54, 'y 289 -> 343']]);
    expect(rules(steady(null, 343))).toEqual(['primary-shift']);
    expect(rules(input({ primary: { before: at(289), after: measure({ box: at(343) }), kept: false, steady: false } }))).toEqual([]);
  });

  it('measures displacement on the larger axis, and badges only on tabs that already existed', () => {
    expect(displacement({ x: 0, y: 0, width: 1, height: 1 }, { x: 100, y: 3, width: 1, height: 1 })).toBe(100);
    expect(displacement(null, { x: 0, y: 0, width: 1, height: 1 })).toBeNull();
    expect(badgedTabs({ 'tab-CORE': 'CORE pane' }, { 'tab-CORE': 'CORE pane, ticket', 'tab-NETWORK': 'NETWORK pane' })).toEqual(['tab-CORE']);
  });
});

describe('recorded transition gaps', () => {
  it('reconcile under the atlas rule: a recorded failure is known, an unrecorded one is not, a vanished one is fixed', () => {
    const failing = transitionFailures(input({ appear: appear({ focus: true }) }));
    const gap: KnownGap<TransitionRule> = { stage: 't-skim-unlock', viewport: '390x844', item: 'skim.increase', rule: 'focus-lost', measured: 'focus is on the page body', reason: 'x', issue: '#1' };
    expect(reconcile(failing, [gap], 't-skim-unlock', '390x844')).toMatchObject({ unexpected: [], fixed: [] });
    expect(reconcile(failing, [], 't-skim-unlock', '390x844').unexpected).toHaveLength(1);
    expect(reconcile([], [gap], 't-skim-unlock', '390x844').fixed).toEqual([gap]);
  });

  it('are unique, measured, on a gated viewport and named by transition id', () => {
    const keys = TRANSITION_GAPS.map((gap) => [gap.stage, gap.viewport, gap.rule, gap.item].join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(TRANSITION_GAPS.filter((gap) => !isStageId(gap.stage) || !gap.stage.startsWith('t-') || gap.measured === '' || gap.reason === '')).toEqual([]);
  });

  it('a row checks what its expectations declare', () => {
    const row = (over: Partial<TransitionRow>): TransitionRow => ({ id: 't-x', walk: [], before: { stage: 'p0-cold-start' }, trigger: { kind: 'click', testId: 'x' }, why: '', ...over });
    expect(checksOf(row({}))).toEqual([]);
    expect(checksOf(row({ appear: { item: () => ({ key: 'k', kind: 'timely', rank: 1, locate: { by: 'test-id', testId: 'k', why: 'w' } }) }, keep: {}, steady: true }))).toEqual(['C1', 'C2', 'B5']);
  });
});

describe('the gallery transition card', () => {
  const record = (): TransitionRecord => {
    const failures = transitionFailures(input({ appear: appear({ truncatedPx: 91 }) }));
    return {
      order: 0, id: 't-skim-unlock', viewport: '390x844', project: 'phone', before: 'it2-run-table', recipe: '<script>', trigger: 'click node-<x>',
      checks: ['C1'], walk: ['C1.7'], why: 'a & b', observed: observed({ announcements: [said({ count: 3, text: '<b>alarm</b>' })] }), tabsBefore: {},
      appear: measure({ inFirstViewport: false }), kept: [], primary: { before: null, after: null, displacement: null }, pointer: null,
      failures, knownGaps: failures.map(formatFailure),
    };
  };

  it('escapes every text it shows and marks recorded gaps', () => {
    const html = transitionSection(record());
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>alarm');
    expect(html).toContain('[known gap]');
    expect(html).toContain('x3');
    expect(html).toContain('not measurable');
  });

  it('counts cells, failures and recorded gaps for the run line', () => {
    expect(transitionSummary([record(), record()])).toContain('2 transition cells, 2 transition failures, 2 of them recorded gaps');
  });
});
