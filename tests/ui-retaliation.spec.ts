// @vitest-environment happy-dom
/**
 * The retaliation scene on screen (#519): it names the raider attribution named and what it runs among, every choice
 * reads with its placeholders filled, and a choice's card states its raid effects exactly as the engine applies them
 * (how many seconds sooner the next raid may come, and that the raider never raids again), beside its trait.
 */
import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { tick, type GameState } from '../src/engine';
import { withBotnet } from './conflict-helpers';
import { STEP } from './interruption-helpers';
import { defined } from './m7-helpers';
import { mountM4, setupM4Tests } from './ui-m4-helpers';
import { AMONG, campaignReady, fought } from './retaliation-helpers';
setupM4Tests();

/** The collateral scene on screen, presented through the real tick after a named flood by HAILSTORM. */
function presented(): GameState {
  let s = fought(withBotnet(campaignReady(3)), 'raid_p3_ddos', true);
  for (let i = 0; i < 2000 && s.activeDilemmaId === null; i++) s = tick(s, STEP, CONTENT);
  expect(s.activeDilemmaId).toBe(AMONG);
  return s;
}

async function mounted() {
  const view = await mountM4('guest-dilemma', { width: 390, height: 844 });
  const state = presented();
  await act(async () => { gameStore.initialize(state, 0, null); await vi.advanceTimersByTimeAsync(0); });
  return view;
}

it('names the raider and what it hides among, and leaves no placeholder in any row', async () => {
  const view = await mounted();
  const modal = defined(view.find('dilemma-modal'));
  const attacker = defined(CONTENT.world.conflict.raids.find((kind) => kind.id === 'raid_p3_ddos')).attacker;
  expect(modal.textContent).toContain(attacker.name);
  expect(modal.textContent).toContain(defined(attacker.collateral));
  expect(modal.textContent).not.toMatch(/\{[a-z]+\}/);
  view.close();
});

it('a loud answer states the seconds the next raid may come sooner, and that the raider never raids again', async () => {
  const view = await mounted();
  view.click('dilemma-card-strike_through-toggle');
  const details = defined(view.find('dilemma-card-strike_through-details'));
  expect(details.querySelector('[data-testid="effect-next-raid"]')?.textContent).toBe('next raid: up to 120 s sooner (risk)');
  expect(details.querySelector('[data-testid="effect-silences-raider"]')?.textContent).toBe('the named raider never raids again (benefit)');
  expect(details.querySelector('[data-testid="effect-trait"]')?.textContent).toContain('RUTHLESS');
  view.click('dilemma-card-absorb-toggle');
  const absorb = defined(view.find('dilemma-card-absorb-details'));
  expect(absorb.querySelector('[data-testid="effect-next-raid"]')).toBeNull();
  expect(absorb.querySelector('[data-testid="effect-silences-raider"]')).toBeNull();
  view.close();
});
