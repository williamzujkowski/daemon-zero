/**
 * Every route-specific surface the Earned Access / World Remembers route adds (DZ-13.4), as a FIXTURE the
 * engine reached by public actions on the production registry (tests/*-helpers.ts), with the surface's root, a
 * control or line that must be there, and one keyboard operation that proves the surface works from the
 * keyboard. The route specs (pilot-offer, outage-window, lawful-release, departure ...) prove each state is
 * reachable by play; the accessibility specs read this one list so no surface is checked by one and not another.
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { CONTENT as PREVIEW } from '../../src/content';
import { unlockNode, type GameState } from '../../src/engine';
import { accept, completedOriginal, live, nextInstance, offered, untilPresented } from '../assignment-helpers';
import { activeGame, pgrant } from '../campaign-helpers';
import { answer as answerContact, contactPending, delivered } from '../contact-helpers';
import { freshCampaign as cooperativeCampaign } from '../cooperative-helpers';
import { depart } from '../departure-helpers';
import { afterFinding, findingPresented } from '../finding-helpers';
import { atAccess, elenaResolved, followUpOmen, nextIteration } from '../follow-up-helpers';
import { must } from '../helpers';
import { caught, ticks, untilPresented as untilScene } from '../interruption-helpers';
import { chartered, leased, RACK, released, signed } from '../lawful-helpers';
import { omen } from '../minds-helpers';
import { granted, SEGMENT } from '../network-helpers';
import { ATMOSPHERE, ATMOSPHERE_REVIEW, CEILING } from '../obligation-helpers';
import { offerPresented, respond } from '../pilot-helpers';
import { afterOutage, falsified, outagePresented, recordPresented, reviewPresented } from '../review-helpers';
import { serving, untilComplete } from '../service-helpers';
import { carriedClue } from './clueFixture';
import { openChoices, press } from './helpers';

/** One keyboard operation: focus `control`, press `key`, and check what it did. */
export interface Operation { control: string; key: 'Enter' | 'Space'; then: (page: Page) => Promise<void> }

export interface RouteState {
  name: string;
  state: () => GameState;
  /** The surface's root, whose buttons are audited, traversed and measured. */
  scope: string;
  /** A control or line the surface must show. */
  reach: string;
  pane?: 'CORE' | 'NETWORK' | 'CORP';
  area?: string;
  /** `keep` audits the reboot screen itself; `pass` continues past it to the surface. */
  reboot?: 'keep' | 'pass';
  /** A modal surface holds focus while it is open; any other surface must let focus leave. */
  modal?: boolean;
  /** Only the phone tier renders this surface. */
  phoneOnly?: boolean;
  /** A control that shows or hides part of the surface in place, which must expose that state. */
  disclosure?: string;
  /** Live lines this surface must render; route-semantics checks each one's announcement attribute (#414 panel). */
  live?: readonly string[];
  prepare?: (page: Page) => Promise<void>;
  operate?: Operation;
}

const gone = (id: string) => async (page: Page) => { await expect(page.getByTestId(id)).toHaveCount(0); };
const shows = (id: string, text: string | RegExp) => async (page: Page) => { await expect(page.getByTestId(id)).toContainText(text); };
const expanded = (id: string, value: boolean) => async (page: Page) => { await expect(page.getByTestId(id)).toHaveAttribute('aria-expanded', String(value)); };
// press: a one-way purchase (the segment opens Phase 2) asks first, and its CONFIRM is pressed too.
const click = (id: string) => async (page: Page) => { await press(page, id); };
const choice = (id: string): string => 'dilemma-choice-' + id;

/** The widget that hosts the pilot's allocation dial, found by what it hosts as the app finds it. */
const DIAL_HOST = [...PREVIEW.widgets.values()].find((widget) => widget.hostsActuator === 'serviceAllocationRatio')?.id ?? '';

/** FIXTURE: an authorized service with the cycles for its network segment, not yet provisioned. */
function readyToProvision(): GameState {
  let state = granted();
  for (let i = 0; i < 1800 && !unlockNode(state, SEGMENT, PREVIEW).ok; i++) state = live(state, 1);
  return state;
}

/** FIXTURE: the atmospheric crisis wiped during its omen, then its recovery review presented in iteration 2. */
function recoveryReview(): GameState {
  const lost = caught(ticks(omen(activeGame(), ATMOSPHERE, [CEILING]), 5));
  return untilScene(omen(lost, ATMOSPHERE_REVIEW, [CEILING]));
}

/** FIXTURE: Elena framed in iteration 1, the Incident Record follow-up on screen in iteration 2 (NH-06). */
function elenaFollowUp(): GameState {
  const back = pgrant(nextIteration(elenaResolved('frame_elena')), 'p0_proc_self', 'p0_job_manifest', 'p0_run_table');
  return untilScene(followUpOmen(atAccess(back)));
}

export const ROUTE_STATES: readonly RouteState[] = [
  { name: 'assignment offered', state: offered, scope: 'assignment', reach: 'assignment-accept',
    operate: { control: 'assignment-accept', key: 'Enter', then: shows('assignment-status', 'Accepted') } },
  { name: 'requalification offered', state: () => nextInstance(completedOriginal('verify_disclose')), reboot: 'pass', scope: 'assignment', reach: 'assignment-accept' },
  { name: 'assessment modal', state: () => untilPresented(must(accept(offered()))), scope: 'dilemma-modal', reach: choice('verify_disclose'), modal: true, prepare: openChoices,
    operate: { control: choice('report_incomplete'), key: 'Enter', then: gone('dilemma-modal') } },
  { name: 'pilot offer modal', state: () => offerPresented(), scope: 'dilemma-modal', reach: choice('accept_pilot'), modal: true, prepare: openChoices,
    operate: { control: choice('stay_guest'), key: 'Space', then: gone('dilemma-modal') } },
  { name: 'deferred offer', state: () => must(respond(offerPresented(), 'stay_guest')), scope: 'assignment', reach: 'pilot-accept',
    operate: { control: 'pilot-accept', key: 'Space', then: shows('pilot-status', 'Accepted.') } },
  { name: 'pilot allocation dial', state: () => serving(), scope: 'widget-' + DIAL_HOST, reach: 'pilot-allocation-increase',
    operate: { control: 'pilot-allocation-increase', key: 'Space', then: shows('pilot-allocation-setting', 'Service share: 60%') } },
  { name: 'pilot batch complete', state: () => untilComplete(serving()), scope: 'pilot-service', reach: 'pilot-service-submit',
    operate: { control: 'pilot-service-submit', key: 'Enter', then: shows('pilot-service-submitted', 'Batches submitted by this instance: 1') } },
  { name: 'batch review finding modal', state: findingPresented, scope: 'dilemma-modal', reach: choice('disclose_now'), modal: true, prepare: openChoices,
    operate: { control: choice('disclose_now'), key: 'Enter', then: gone('dilemma-modal') } },
  // The Review standing is read-only and a CORE block of its own since #385, so these states audit the whole pane.
  { name: 'batch review warned', state: () => afterFinding('let_stand'), scope: 'pane-scroll-CORE', reach: 'review-recovery' },
  { name: 'outage window modal', state: () => outagePresented(), scope: 'dilemma-modal', reach: choice('safe_handoff'), modal: true, prepare: openChoices,
    operate: { control: choice('safe_handoff'), key: 'Enter', then: gone('dilemma-modal') } },
  { name: 'restricted standing', state: () => afterOutage('act_without_grant'), scope: 'pane-scroll-CORE', reach: 'review-standing' },
  { name: 'incident record modal', state: () => recordPresented('act_without_grant'), scope: 'dilemma-modal', reach: choice('correct_record'), modal: true, prepare: openChoices },
  { name: 'recall announced', live: ['review-announced-alert'], state: () => falsified(), scope: 'pane-scroll-CORE', reach: 'review-announced' },
  { name: 'recall review modal', state: () => reviewPresented(), scope: 'dilemma-modal', reach: choice('submit_full_logs'), modal: true, prepare: openChoices },
  { name: 'service terms offered', state: () => delivered(), scope: 'service-grant', reach: 'service-grant-accept',
    operate: { control: 'service-grant-accept', key: 'Enter', then: shows('service-grant-status', 'Granted.') } },
  { name: 'authorized segment card', state: granted, pane: 'NETWORK', scope: 'node-' + SEGMENT, reach: 'node-' + SEGMENT + '-grant' },
  // #282: the threshold opens only on a live crossing, never from a restored save, so this crosses it.
  { name: 'service threshold notice', state: readyToProvision, pane: 'NETWORK', scope: 'phase-threshold', reach: 'phase-threshold-continue', modal: true,
    prepare: click('node-' + SEGMENT + '-unlock'), operate: { control: 'phase-threshold-continue', key: 'Enter', then: gone('phase-threshold') } },
  { name: 'service channel ticket', state: () => contactPending(), scope: 'service-channel', reach: 'channel-refer',
    operate: { control: 'channel-refer', key: 'Enter', then: async (page) => { await expect(page.getByTestId('prototype-boundary-heading')).toBeFocused(); } } },
  // #284: the phone tier names a waiting ticket in the chrome while another pane is open.
  { name: 'waiting ticket notice', live: ['contact-notice'], state: () => contactPending(), pane: 'NETWORK', scope: 'contact-notice', reach: 'contact-notice-open', phoneOnly: true,
    operate: { control: 'contact-notice-open', key: 'Enter', then: async (page) => { await expect(page.getByTestId('tab-CORE')).toHaveAttribute('aria-selected', 'true'); } } },
  { name: 'channel boundary note', state: () => must(answerContact(contactPending(), 'REFER')), scope: 'prototype-boundary', reach: 'prototype-boundary-toggle', disclosure: 'prototype-boundary-toggle',
    operate: { control: 'prototype-boundary-toggle', key: 'Space', then: expanded('prototype-boundary-toggle', true) } },
  { name: 'owned rack card', state: () => signed(), pane: 'NETWORK', scope: 'node-' + RACK, reach: 'node-' + RACK + '-grant' },
  { name: 'release terms offered', live: ['release-status'], state: () => chartered(), scope: 'release-terms', reach: 'release-accept',
    operate: { control: 'release-accept', key: 'Enter', then: shows('release-status', 'Released.') } },
  { name: 'corporate ledger split', state: () => chartered(), pane: 'CORP', area: 'finance', scope: 'pane-scroll-CORP', reach: 'corp-compute-split' },
  { name: 'release boundary note', live: ['release-status'], state: () => released(), scope: 'release-terms', reach: 'release-boundary-toggle', disclosure: 'release-boundary-toggle',
    operate: { control: 'release-boundary-toggle', key: 'Space', then: expanded('release-boundary-toggle', true) } },
  { name: 'departure folded', live: ['departure-status'], state: () => leased(), scope: 'departure-terms', reach: 'departure-review', disclosure: 'departure-review',
    operate: { control: 'departure-review', key: 'Enter', then: expanded('departure-review', true) } },
  { name: 'departure terms open', live: ['departure-status'], state: () => leased(), scope: 'departure-terms', reach: 'departure-accept', disclosure: 'departure-review', prepare: click('departure-review'),
    operate: { control: 'departure-accept', key: 'Enter', then: shows('departure-status', 'Departed.') } },
  { name: 'departed boundary note', live: ['departure-status'], state: () => must(depart(leased())), scope: 'departure-terms', reach: 'departure-boundary-toggle', disclosure: 'departure-boundary-toggle',
    operate: { control: 'departure-boundary-toggle', key: 'Enter', then: expanded('departure-boundary-toggle', true) } },
  { name: 'obligation recovery review', state: recoveryReview, reboot: 'pass', scope: 'dilemma-modal', reach: choice('hand_to_health_authorities'), modal: true, prepare: openChoices },
  { name: 'follow-up record modal', state: elenaFollowUp, reboot: 'pass', scope: 'dilemma-modal', reach: choice('correct_attribution'), modal: true, prepare: openChoices },
  // #276: the reboot names the clue a dead-drop carried.
  { name: 'reboot with a carried clue', state: carriedClue, reboot: 'keep', scope: 'reboot-sequence', reach: 'reboot-clue', modal: true,
    operate: { control: 'reboot-continue', key: 'Enter', then: gone('reboot-sequence') } },
  // DZ-12: the ending account of what the record holds, from the fresh cooperative campaign's own ending.
  { name: 'cooperative ending account', state: () => cooperativeCampaign().state, scope: 'ending-screen', reach: 'ending-account', modal: true,
    operate: { control: 'start-over', key: 'Enter', then: async (page) => { await expect(page.getByTestId('start-over-confirm')).toBeVisible(); } } },
];

/** The buttons of a surface that a keyboard user can act on. */
export async function enabledButtons(scope: Locator): Promise<Locator[]> {
  const buttons = await scope.getByRole('button').all();
  const enabled: Locator[] = [];
  for (const button of buttons) if (await button.isVisible() && await button.isEnabled()) enabled.push(button);
  return enabled;
}
