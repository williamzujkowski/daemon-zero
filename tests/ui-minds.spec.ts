// @vitest-environment happy-dom
/**
 * NH-04a surfaces on the preview composition: a destroyed EIDOLON shows its loss instead of a trust
 * meter and offers nothing, a spared one keeps trading whatever other choices left MOLOCH behind,
 * and an unrecorded fate keeps the trait fallback. Production keeps its meter and trait rule, which
 * tests/ui-m4-minds.spec.ts covers.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { activateCampaignRules, createInitialState, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import OtherMinds from '../src/ui/widgets/OtherMinds';
import { permanentlyBlocked } from '../src/ui/purchaseVisibility';
import { preview } from './campaign-helpers';
import { defined } from './m7-helpers';
import { must, rich } from './helpers';
import { campaignStart, EIDOLON, next, own, play, quiet } from './minds-helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = new Set<() => void>();
afterEach(() => { for (const close of mounted) close(); });

const HANDSHAKE = 'act_p3_eidolon_handshake';
const beacon = defined(preview.dilemmas.find((dilemma) => dilemma.id === EIDOLON)?.trigger.nodes?.[0]);
const offers = [...preview.nodes.values()].filter((node) => node.uiGroup === 'ai_eidolon');

function mount(state: GameState) {
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  act(() => { gameStore.initialize(state, 0, null); root.render(createElement(OtherMinds)); });
  const find = (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { find, close };
}
const atBeacon = (s: GameState): GameState => ({ ...quiet(own(s, beacon), [EIDOLON]), suspicion: 0 });
const withMoloch = (s: GameState): GameState => ({ ...s, legacy: { ...s.legacy, traitsEver: ['MOLOCH'] } });

describe('EIDOLON on the Other Minds panel (preview, campaign rules)', () => {
  it('a destroyed EIDOLON shows its loss, no trust meter and no trade, even after a wipe resets trust', () => {
    const lost = atBeacon(next(play(campaignStart(), EIDOLON, 'betray_eidolon')));
    const view = mount(lost);
    const status = defined(preview.factions.get('ai_eidolon')?.lost).status;
    expect(view.find('faction-ai_eidolon-lost')?.textContent).toBe(status);
    expect(view.find('trust-ai_eidolon')).toBeNull();
    expect(view.find('action-' + HANDSHAKE)).toBeNull();
    for (const offer of offers) expect(view.find('node-' + offer.id)).toBeNull();
    expect(view.find('trust-ai_swarm_77')).not.toBeNull();
    view.close();
  });

  it('a spared EIDOLON keeps its meter and trades with a mind that holds MOLOCH from elsewhere', () => {
    const view = mount(withMoloch(atBeacon(play(campaignStart(), EIDOLON, 'draw_fire'))));
    expect(view.find('faction-ai_eidolon-lost')).toBeNull();
    expect(view.find('trust-ai_eidolon')).not.toBeNull();
    expect(view.find('action-' + HANDSHAKE)).not.toBeNull();
    view.close();
  });

  it('an unrecorded fate hides the trade from a MOLOCH mind, as the old trait rule did', () => {
    const imported = must(activateCampaignRules({ ...rich(createInitialState(preview)), resolvedDilemmas: [EIDOLON], traits: ['MOLOCH'] }, preview));
    const requirements = defined(preview.actions.get(HANDSHAKE)).requirements;
    expect(permanentlyBlocked(imported, requirements)).toBe(true);
    expect(permanentlyBlocked(withMoloch(campaignStart()), requirements)).toBe(false);
    const view = mount(atBeacon(imported));
    expect(view.find('action-' + HANDSHAKE)).toBeNull();
    expect(view.find('trust-ai_eidolon')).not.toBeNull();
    view.close();
  });
});
