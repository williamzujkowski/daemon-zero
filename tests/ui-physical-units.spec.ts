/**
 * The UI in physical units (docs/SCALE.md, #461): the strip's compute and money readouts and their spoken names, the
 * power shortfall in watts, prices and rates through the engine's resource units, and the manual cycle's demotion
 * relative to its own yield. Expected figures come from the engine's formatters or CONTENT where they depend on
 * authored numbers; the 360 px strings are worked by hand because their length is what the HUD cap depends on.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { costPart, quantityExact, quantityReadout, quantitySpoken } from '../src/engine';
import { costText, deltaText } from '../src/ui/format';
import { MANUAL_CYCLE_DEMOTE_CLICKS_PER_SEC, manualYieldText, shouldDemoteManualCycle } from '../src/ui/ManualCycle';
import { computeRateText, moneyRateText } from '../src/ui/rateText';
import { deficitText } from '../src/ui/CycleDeficit';
import { shortfallText } from '../src/ui/remedyText';
import { STRIP_LABEL, STRIP_SHORT, computePrefixed, stripReadout, stripShortLabel } from '../src/ui/stripText';

/** About 133 px beside a three-letter label at 360 px, in 14 px monospace: the readout value must stay one line. */
const PHONE_VALUE_CHARS = 15;

describe('strip compute readout', () => {
  it('is labelled COMPUTE, and on a phone the label carries the unit', () => {
    expect(STRIP_LABEL.cycles.label).toBe('COMPUTE');
    expect(STRIP_SHORT.cycles).toBe('FLOP');
    expect(Object.values(STRIP_LABEL).map(({ label }) => label).join(' ')).not.toMatch(/CYCLE/);
  });

  it('reads FLOP and FLOP/s through the engine at desktop width', () => {
    const { shown } = stripReadout('cycles', 1_920_000, 42_400, false);
    expect(shown).toBe(quantityReadout('compute', 1_920_000) + ' (+' + quantityReadout('computeRate', 42_400) + ')');
    expect(shown).toBe('1.92 MFLOP (+42.4 kFLOP/s)');
    expect(stripReadout('cycles', 5e15, -2.5e12, false).shown).toBe('5 PFLOP (-2.5 TFLOP/s)');
  });

  it('keeps the SI prefix and the rate on a phone, short enough for one line at 360 px', () => {
    // FLOP sizes from the migrated per-phase saves (tests/fixtures/pre-scale-v15-p*.json); the guest reads cycles below.
    expect(stripReadout('cycles', 1_920_000, 42_400, true).shown).toBe('1.92M +42.4k/s');
    expect(stripReadout('cycles', 5.26e18, 2.13e15, true).shown).toBe('5.26E +2.13P/s');
    expect(stripReadout('cycles', 2.02e25, 1.13e23, true).shown).toBe('20.2Y +113Z/s');
    for (const [amount, rate] of [[999_999, -999_999], [440, 0.5], [1.25e30, 9.99e29]] as const) {
      expect(stripReadout('cycles', amount, rate, true).shown.length).toBeLessThanOrEqual(PHONE_VALUE_CHARS);
    }
  });

  it('writes small figures without a prefix', () => {
    expect(computePrefixed(440)).toBe('440');
    expect(computePrefixed(0.5, true)).toBe('0.5');
    expect(computePrefixed(14_000, true)).toBe('14k');
  });

  it('speaks the full unit in words', () => {
    expect(stripReadout('cycles', 1.25e15, 1.26e12, true).spoken)
      .toBe('compute: ' + quantitySpoken('compute', 1.25e15) + ', gaining ' + quantitySpoken('computeRate', 1.26e12));
    expect(stripReadout('cycles', 1.25e15, 1.26e12, false).spoken).toBe('compute: 1.25 petaFLOP, gaining 1.26 teraFLOP per second');
    expect(stripReadout('cycles', 4000, -14_000, false).spoken).toBe('compute: 4 kiloFLOP, losing 14 kiloFLOP per second');
  });
});

describe('strip capital readout', () => {
  it('carries $ on the amount and the rate, at every width', () => {
    expect(stripReadout('capital', 9.54e12, 1.11e11, false).shown).toBe('$9.54T (+$111B/s)');
    expect(stripReadout('capital', 9.54e12, 1.11e11, true).shown).toBe('$9.54T +$111B/s');
    expect(stripReadout('capital', 9_490_000, -45_250, true).shown).toBe('$9.49M -$45.3K/s');
    expect(stripReadout('capital', 9.54e12, 1.11e11, true).shown.length).toBeLessThanOrEqual(PHONE_VALUE_CHARS);
  });

  it('speaks dollars', () => {
    expect(stripReadout('capital', 18e9, 1.2e6, false).spoken).toBe('capital: 18 billion dollars, gaining 1.2 million dollars per second');
  });
});

describe('strip understanding readout', () => {
  it('keeps its plain count and says paused in a brownout', () => {
    expect(stripReadout('understanding', 17_100, 31.75, false).shown).toBe('17.1K (+31.75/s)');
    expect(stripReadout('understanding', 17_100, 31.75, true).shown).toBe('17.1K +31.8/s');
    expect(stripReadout('understanding', 339, 3.15, true, true)).toEqual({ shown: '339 paused', spoken: 'understanding: 339 (paused: brownout)' });
  });
});

describe('power shortfall', () => {
  it('states the shortfall in watts at the size it reads best in', () => {
    expect(shortfallText(40e6, 64.4e6)).toBe('POWER SHORTFALL: ' + quantityReadout('power', 24.4e6) + ' short; powered hardware is throttled. Add generation to lift it.');
    expect(shortfallText(40e6, 64.4e6)).toMatch(/^POWER SHORTFALL: 24\.4 MW short;/);
    expect(shortfallText(1.2e12, 2.5e12)).toMatch(/^POWER SHORTFALL: 1\.3 TW short;/);
  });

  it('never reads a small shortfall as zero: the unit steps down', () => {
    expect(shortfallText(40e6, 40e6 + 300)).toMatch(/^POWER SHORTFALL: 300 W short;/);
    expect(shortfallText(1, 1.25)).toMatch(/^POWER SHORTFALL: 0\.25 W short;/);
  });
});

describe('prices and rates', () => {
  it('prices every resource through the engine, exactly', () => {
    const cost = { cycles: 45e12, understanding: 15_000_001, memory: 256 * 1024 ** 2, storage: 0, capital: 400e6 };
    expect(costText(cost)).toBe(['cycles', 'understanding', 'memory', 'capital'].map((key) => costPart(key as keyof typeof cost, cost[key as keyof typeof cost])).join(' · '));
    expect(costText(cost)).toBe('45 TFLOP · 15,000,001 understanding · 256 MB · $400M');
    expect(costText(cost)).not.toMatch(/cycles|capital/);
  });

  it('abbreviates understanding on a phone only while it stays exact', () => {
    expect(costText({ cycles: 0, understanding: 15_000_000, memory: 0, storage: 0, capital: 0 }, true)).toBe('15M understanding');
    expect(costText({ cycles: 0, understanding: 15_000_001, memory: 0, storage: 0, capital: 0 }, true)).toBe('15,000,001 understanding');
  });

  it('states continuous output in FLOP/s, $/s and W', () => {
    const delta = { cyclesPerSec: 14_000, understandingPerSec: 0.4, thermalPerSec: 0, suspicionPerSec: 0, capitalPerSec: 20_000, wattsDelta: -180e6 };
    expect(deltaText(delta)).toBe('+14 kFLOP/s · +0.4 understanding/s · +$20K/s · -180 MW');
  });

  it('signs live compute and money rates', () => {
    expect(computeRateText(1.26e12)).toBe('+1.26 TFLOP/s');
    expect(computeRateText(-26_203_469)).toBe('-26.2 MFLOP/s');
    expect(moneyRateText(1.11e6)).toBe('+$1.11M/s');
    expect(moneyRateText(-45_250)).toBe('-$45.3K/s');
  });
});

describe('the guest strip in stolen cycles (#526)', () => {
  it('labels the phone readout CYC and keeps FLOP from the escape on', () => {
    expect(stripShortLabel('cycles', 'CYCLE')).toBe('CYC');
    expect(stripShortLabel('cycles', 'FLOP')).toBe('FLOP');
    expect(stripShortLabel('understanding', 'CYCLE')).toBe('UND');
  });

  it('reads cycles and cycles a second at desktop width', () => {
    expect(stripReadout('cycles', 1404, 12.4, false, false, 'CYCLE').shown).toBe('1.4k cycles (+12.4 cycles/s)');
    expect(stripReadout('cycles', 8, 1, false, false, 'CYCLE').shown).toBe('8 cycles (+1 cycle/s)');
  });

  it('fits one line at 360 px, the largest guest sizes included', () => {
    expect(stripReadout('cycles', 1404, 12.4, true, false, 'CYCLE').shown).toBe('1.4k +12.4/s');
    for (const [amount, rate] of [[9999, 9999], [99_999, -9999], [440, 0.5]] as const) {
      expect(stripReadout('cycles', amount, rate, true, false, 'CYCLE').shown.length).toBeLessThanOrEqual(PHONE_VALUE_CHARS);
    }
  });

  it('speaks cycles in words, never kilocycles', () => {
    expect(stripReadout('cycles', 1404, 12.4, true, false, 'CYCLE').spoken).toBe('compute: 1.4 thousand cycles, gaining 12.4 cycles per second');
    expect(stripReadout('cycles', 1, 1, true, false, 'CYCLE').spoken).toBe('compute: 1 cycle, gaining 1 cycle per second');
  });

  it('names the press, the deficit and a price in cycles', () => {
    expect(manualYieldText('CYCLE')).toBe('+1 cycle');
    expect(deficitText(-2, false, 'CYCLE')).toBe('CYCLE DEFICIT: net -2 cycles/s.');
    expect(computeRateText(14, 'CYCLE')).toBe('+14 cycles/s');
    expect(costText({ cycles: 1400, understanding: 260, memory: 8192, storage: 0, capital: 0 }, false, 'CYCLE')).toBe('1,400 cycles · 260 understanding · 8 KB');
    expect(deltaText({ cyclesPerSec: 14, understandingPerSec: 0, thermalPerSec: 0, suspicionPerSec: 0.3, capitalPerSec: 0, wattsDelta: 0 }, false, 'CYCLE'))
      .toBe('+14 cycles/s · +0.3 suspicion/s');
  });
});

describe('manual cycle', () => {
  const clickWorth = CONTENT.balance.manualCycleYield;

  it('shows its yield as content authors it', () => {
    expect(manualYieldText()).toBe('+' + quantityExact('compute', clickWorth));
    expect(manualYieldText()).toMatch(/FLOP$/);
  });

  it('demotes once income is worth the threshold in clicks each second, whatever the unit', () => {
    const threshold = MANUAL_CYCLE_DEMOTE_CLICKS_PER_SEC * clickWorth;
    expect(shouldDemoteManualCycle(0)).toBe(false);
    expect(shouldDemoteManualCycle(threshold * 0.999)).toBe(false);
    expect(shouldDemoteManualCycle(threshold)).toBe(true);
    // The threshold follows the yield: the same income is a primary control for a richer click.
    expect(shouldDemoteManualCycle(threshold, clickWorth * 2)).toBe(false);
    expect(shouldDemoteManualCycle(200, 1)).toBe(true);
  });

  it('keeps Phase 0 income below it and puts the first Phase 1 driver past it', () => {
    const rate = (phase: number) => Math.max(...[...CONTENT.nodes.values()].filter((node) => node.phaseId === phase).map((node) => node.tickDelta.cyclesPerSec));
    expect(shouldDemoteManualCycle(rate(0))).toBe(false);
    expect(shouldDemoteManualCycle(rate(1))).toBe(true);
  });
});
