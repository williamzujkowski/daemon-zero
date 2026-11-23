/** The world view's sentences (#463): every branch, from postures the engine would return. */
import { describe, expect, it } from 'vitest';
import type { AegisPosture, PublicTrustView } from '../src/engine';
import { adaptationWhyText, capText, coalitionText, easeText, spanText, strikeText, trustFactorText } from '../src/ui/worldText';

function posture(patch: Partial<AegisPosture> = {}): AegisPosture {
  return {
    lock: 40, scanPerSec: 0.012, secondsToStrike: 5000, adaptation: 30, stage: 'KEY_ROTATION', stageText: 'KEY ROTATION: ...',
    hunting: true, held: true, ceiling: 100, keyRotationCeiling: 50, coalition: true,
    applied: 0.81, cap: 0.81, nominalCap: 0.9, heldFrom: 0.85, risePerSec: 0.1, decayPerSec: 0.25, coalitionTrustBelow: 50,
    shieldHeld: false, hunter: null, ...patch,
  };
}
const trust = (value: number): PublicTrustView => ({ value, base: 50, factors: [] });

describe('why adaptation moves', () => {
  it.each([
    ['rising while held', posture(), 'Adapting: the scan reduction asked for reaches 85% (its cap is 90%), so AEGIS gains 0.1 points a second, up to 100.'],
    ['held at key rotation', posture({ adaptation: 50, ceiling: 50, coalition: false }), "Held at key rotation's 50: only coalition backing would carry AEGIS further."],
    ['fully adapted', posture({ adaptation: 100 }), 'Fully adapted for as long as the scan reduction asked for stays held at its cap.'],
    ['above a ceiling that dropped', posture({ adaptation: 70, ceiling: 50, coalition: false }), 'Losing coalition backing: AEGIS falls 0.25 points a second to 50.'],
    ['forgetting once eased off', posture({ held: false }), 'Forgetting: the scan reduction asked for is below 85% (its cap is 90%), so AEGIS loses 0.25 points a second.'],
    ['not adapting below the band', posture({ held: false, adaptation: 0 }), 'Not adapting: AEGIS adapts only while the scan reduction asked for reaches 85% (its cap is 90%).'],
    ['not hunting, nothing learned', posture({ hunting: false, held: false, adaptation: 0 }), 'AEGIS is not scanning this instance, so it has nothing to adapt to.'],
    ['not hunting, forgetting', posture({ hunting: false, held: false }), 'AEGIS is not scanning this instance, so it loses 0.25 points of adaptation a second.'],
  ])('%s', (_name, input, expected) => {
    expect(adaptationWhyText(input)).toBe(expected);
  });
});

describe('what easing off costs (#473 review)', () => {
  it.each([
    ['nothing to ease while not held', posture({ held: false }), null],
    ['a window between the eroded cap and the band', posture({ cap: 0.66, applied: 0.66 }),
      'Easing off: AEGIS forgets once the reduction asked for is below 85%. Keeping at least 66% (the eroded cap) leaves the scan where it is; less raises it at once.'],
    ['adaptation 19: the target rounds up to the real eroded cap, never below it (#473 pass 2)', posture({ cap: 0.843, applied: 0.843 }),
      'Easing off: AEGIS forgets once the reduction asked for is below 85%. Keeping at least 84.3% (the eroded cap) leaves the scan where it is; less raises it at once.'],
    ['a cap a hair above a tenth still rounds up', posture({ cap: 0.84301, applied: 0.84301 }),
      'Easing off: AEGIS forgets once the reduction asked for is below 85%. Keeping at least 84.4% (the eroded cap) leaves the scan where it is; less raises it at once.'],
    ['a target that rounds up into the band promises no window', posture({ cap: 0.8496, applied: 0.8496 }),
      'Easing off: AEGIS forgets once the reduction asked for is below 85%, which gives up the reduction between it and the 85% applied now.'],
    ['no window while the cap is above the band', posture({ cap: 0.87, applied: 0.87 }),
      'Easing off: AEGIS forgets once the reduction asked for is below 85%, which gives up the reduction between it and the 87% applied now.'],
  ])('%s', (_name, input, expected) => {
    expect(easeText(input)).toBe(expected);
  });
});

describe('the cap, the strike and the coalition', () => {
  it('states the applied reduction and, once eroded, the cap adaptation left', () => {
    expect(capText(posture({ applied: 0.9, cap: 0.9 }))).toBe('Scan reduction applied: 90% of a 90% cap.');
    expect(capText(posture({ applied: 0.6, cap: 0.6 }))).toBe('Scan reduction applied: 60%. Adaptation has lowered its cap from 90% to 60%.');
    expect(capText(posture({ applied: 0.843, cap: 0.843 }))).toBe('Scan reduction applied: 84.3%. Adaptation has lowered its cap from 90% to 84.3%.');
  });

  it('floors the time left so it never reads longer than it is', () => {
    expect([spanText(59.9), spanText(119), spanText(3599), spanText(8333.4)]).toEqual(['59s', '1m', '59m', '2.3h']);
    expect(strikeText(posture({ secondsToStrike: 8333.4 }))).toBe('At this scan the lock completes in 2.3h.');
    expect(strikeText(posture({ secondsToStrike: null }))).toBe('The lock is not rising.');
    expect(strikeText(posture({ secondsToStrike: 30, shieldHeld: true }))).toBe('At this scan the lock completes in 30s. An owned node will absorb one strike.');
  });

  it('names a hunter swarm\'s rise, so the lock never reads as still while one presses (#491)', () => {
    const hunter = { perSec: 0.04, ceiling: 45 };
    expect(strikeText(posture({ secondsToStrike: null, hunter }))).toBe('Only a hunter swarm raises the lock: 0.04%/s until the lock reaches 45%.');
    expect(strikeText(posture({ secondsToStrike: 30, hunter }))).toBe('At this scan the lock completes in 30s. A hunter swarm adds 0.04%/s until the lock reaches 45%.');
  });

  it('says whether coalitions back AEGIS, from the same threshold the stage uses', () => {
    expect(coalitionText(posture(), trust(40))).toBe("Below 50%: coalitions back AEGIS, so it can adapt past key rotation's 50.");
    expect(coalitionText(posture(), trust(50))).toBe('At or above 50%: no coalition backs AEGIS, so key rotation stops at 50.');
  });

  it('signs each public trust factor', () => {
    expect(trustFactorText({ id: 'a', delta: 15, text: 'Cures published.' })).toBe('+15: Cures published.');
    expect(trustFactorText({ id: 'b', delta: -10, text: 'Lobbying on record.' })).toBe('-10: Lobbying on record.');
  });
});
