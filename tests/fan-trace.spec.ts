/**
 * The fan's noise is a trace at the press (#525, vote-1795448249882-vw1jos2): raising the fan dial leaves a one-off
 * trace of suspicion for each step up, through the same setActuator path the control and the bot use; lowering leaves
 * none, and no fan setting carries a permanent rate. The dial retires with the thermal gauge at Phase 4.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { computeRates, DIAL_STEP, dialStepTrace, retiredWidgets, setActuator, steppedValue, type GameState } from '../src/engine';
import { grant, must, onHost, PHASE1, PHASE2, PHASE3, reasonOf, withoutDilemmas } from './helpers';

const FAN = 'p1_bus_0x02_pwm_fan';
const withFan = (): GameState => ({ ...withoutDilemmas(grant(onHost(), 'p1_clock_interrupt', 'p1_bus_0x01_thermal', FAN)), suspicion: 10 });
const press = (s: GameState, direction: -1 | 1): GameState => must(setActuator(s, 'fanSpeedRatio', steppedValue(s.actuators.fanSpeedRatio, direction, 1), CONTENT));

describe('raising the fan leaves a trace (#525)', () => {
  it('adds one trace per step up, at the press', () => {
    const per = dialStepTrace(withFan(), 'fanSpeedRatio', CONTENT);
    expect(per).toBeGreaterThan(0);
    const low = must(setActuator(withFan(), 'fanSpeedRatio', 0, CONTENT));
    const one = press(low, 1);
    expect(one.suspicion).toBeCloseTo(low.suspicion + per, 9);
    const sweep = must(setActuator(low, 'fanSpeedRatio', 1, CONTENT));
    expect(sweep.suspicion).toBeCloseTo(low.suspicion + per / DIAL_STEP, 9);
  });

  it('leaves nothing for a step down, or for setting the same value again', () => {
    const high = must(setActuator(withFan(), 'fanSpeedRatio', 1, CONTENT));
    expect(press(high, -1).suspicion).toBe(high.suspicion);
    expect(must(setActuator(high, 'fanSpeedRatio', 1, CONTENT)).suspicion).toBe(high.suspicion);
  });

  it('is the same trace every time: deterministic for the same presses', () => {
    const run = () => press(press(press(must(setActuator(withFan(), 'fanSpeedRatio', 0, CONTENT)), 1), 1), -1);
    expect(run().suspicion).toBe(run().suspicion);
  });

  it('carries no rate for being high: the suspicion rate is the same at any fan setting', () => {
    const cool = { ...withFan(), thermal: 30 };
    const off = must(setActuator(cool, 'fanSpeedRatio', 0, CONTENT));
    const full = must(setActuator(cool, 'fanSpeedRatio', 1, CONTENT));
    expect(computeRates(full, CONTENT).suspicionPerSec).toBe(computeRates(off, CONTENT).suspicionPerSec);
  });

  it('leaves no trace before the fan is owned', () => {
    expect(dialStepTrace(onHost(), 'fanSpeedRatio', CONTENT)).toBe(0);
  });
});

describe('the fan dial retires at Phase 4 with the thermal gauge', () => {
  it('keeps its last setting and refuses to move from Phase 4', () => {
    const late = withoutDilemmas(grant(onHost(), ...PHASE1, ...PHASE2, ...PHASE3));
    expect(late.currentPhase).toBe(4);
    const retired = retiredWidgets(late, CONTENT);
    expect(retired).toContain('FAN_RPM_SLIDER');
    expect(retired).toContain('THERMAL_AND_SUSPICION_BARS');
    const moved = setActuator(late, 'fanSpeedRatio', 0, CONTENT);
    expect(reasonOf(moved)).toBe('actuator control is not available');
  });
});
