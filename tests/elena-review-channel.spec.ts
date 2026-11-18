/**
 * DZ-08.11 (H19): Elena's incident-record follow-up reaches an authorized service through the approved
 * review channel, its second access means (NH-06's seam, no engine change), but only when campaign
 * history holds the original. A fresh cooperative instance that never met her is told nothing.
 */
import { describe, expect, it } from 'vitest';
import { followUpAccess, tick, unlockNode, type GameState } from '../src/engine';
import { recordRouteEvent } from '../src/engine/access';
import { LAWFUL, live, preview } from './assignment-helpers';
import { directoryMapped } from './contact-helpers';
import { elenaResolved, follow, FOLLOW, nextIteration } from './follow-up-helpers';
import { STEP } from './interruption-helpers';
import { must } from './helpers';
import { buy, SEGMENT } from './network-helpers';

/** The lawful opening's two nodes, bought with the ordinary unlock on a funded instance. */
const opening = (s: GameState): GameState => LAWFUL.reduce((state, id) => must(unlockNode(state, id, preview)), s);

/**
 * FIXTURE: iteration two of a campaign whose first instance met Elena on the escape route, promoted
 * and granted service by the engine transitions (no scene grants them to a funded fixture instance),
 * then provisioned through the ordinary unlock.
 */
function serviceAfterElena(choice: string): GameState {
  const next = opening(nextIteration(elenaResolved(choice)));
  const service = must(recordRouteEvent(must(recordRouteEvent(next, 'PROMOTION', preview)), 'SERVICE_GRANT', preview));
  return buy(service, SEGMENT);
}

describe('the approved review channel is the follow-up\'s second access means', () => {
  it.each(['cover_her_exit', 'frame_elena', 'stay_silent'])('after %s, a provisioned service reaches the record through it', (choice) => {
    const s = serviceAfterElena(choice);
    const means = followUpAccess(s, follow, preview);
    expect(means?.id).toBe('review_channel');
    expect(means?.statement).toContain('approved review channel');
    expect(means?.statement).toContain('signed as this instance');
    const omen = tick({ ...s, resolvedDilemmas: [], pendingDilemma: null }, STEP, preview);
    expect(omen.pendingDilemma?.id).toBe(FOLLOW);
  });

  it('a service before provisioning, or a recalled pilot, holds no means', () => {
    const next = opening(nextIteration(elenaResolved('frame_elena')));
    const unprovisioned = must(recordRouteEvent(must(recordRouteEvent(next, 'PROMOTION', preview)), 'SERVICE_GRANT', preview));
    expect(followUpAccess(unprovisioned, follow, preview)).toBeNull();
    const recalled = must(recordRouteEvent(serviceAfterElena('frame_elena'), 'RECALL', preview));
    expect(followUpAccess(recalled, follow, preview)).toBeNull();
  });
});

describe('no fabricated Elena history for a fresh cooperative instance (DZ-08.11)', () => {
  it('a lawful first-run service at network scale is never offered the follow-up', () => {
    const service = directoryMapped();
    expect(service.campaign.events['dil_02_whistleblower_tech']).toBeUndefined();
    expect(followUpAccess(service, follow, preview)).not.toBeNull();
    const later = live(service, 600);
    expect(later.pendingDilemma?.id).not.toBe(FOLLOW);
    expect(later.activeDilemmaId).not.toBe(FOLLOW);
    expect(later.campaign.events[FOLLOW]).toBeUndefined();
  });
});
