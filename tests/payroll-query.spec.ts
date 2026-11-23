/** The payroll query (#210) states the totals, cap and inert effects the tick actually applies. */
import { describe, expect, it } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { CONTENT } from '../src/content';
import type { Repeatable } from '../src/content/schema';
import { computeRates, importSave, payrollView, type GameState } from '../src/engine';
import { scaleScrutinyPerSec } from '../src/engine/scrutiny';
import { powerSignaturePerSec } from '../src/engine/signature';
import { huntedForScale } from '../src/engine/threatQuery';

const fixtures = makeFixtures();
function load(name: string): GameState {
  const code = fixtures[name];
  if (!code) throw new Error('Missing fixture ' + name);
  return importSave(code, CONTENT);
}
const operatives = [...CONTENT.repeatables.values()].filter((rep) => rep.kind === 'OPERATIVE');
const aegisRoles = operatives.filter((rep) => rep.perLevelEffects.aegisScanReduction > 0)
  .sort((left, right) => right.perLevelEffects.aegisScanReduction - left.perLevelEffects.aegisScanReduction);
const strongest = aegisRoles[0];
function withLevels(s: GameState, levels: Record<string, number>): GameState {
  return { ...s, levels: { ...s.levels, ...levels } };
}

/** The reduction computeRates applies, read back from the scan rate it returns: rate = unreduced × (1 − applied). */
function appliedByTick(s: GameState): number {
  const b = CONTENT.balance;
  const unreduced = (huntedForScale(s, CONTENT) ? b.aegisBaseScanPerSec : 0) + (s.suspicion / 100) * b.aegisSuspicionScanPerSec;
  return 1 - computeRates(s, CONTENT).aegisScanPerSec / unreduced;
}

describe('payrollView', () => {
  it('reports no staff before a hire, and every role the content declares', () => {
    const view = payrollView(load('victory-ready'), CONTENT);
    expect(view.staffLevels).toBe(0);
    expect(Object.values(view.totals).every((value) => value === 0)).toBe(true);
    expect(view.staffRevenueBonus).toBe(0);
    expect(view.aegis.staff).toBe(0);
    expect(view.roles.map((role) => role.id)).toEqual(operatives.map((rep) => rep.id));
    expect(view.offersAegis).toBe(aegisRoles.length > 0);
    expect(view.offersRevenue).toBe(operatives.some((rep) => rep.perLevelEffects.revenueMultiplierBonus > 0));
    expect(view.offersSuspicionCut).toBe(operatives.some((rep) => rep.perLevel.suspicionPerSec < 0));
  });

  it('sums every hired level as the cards state it, and the multipliers as the tick applies them', () => {
    const s = load('corporate-insolvent'), before = JSON.stringify(s);
    const view = payrollView(s, CONTENT);
    const hired = operatives.map((rep) => [rep, s.levels[rep.id] ?? 0] as const).filter(([, level]) => level > 0);
    expect(hired.length).toBeGreaterThan(1);
    const sum = (pick: (rep: Repeatable) => number) => hired.reduce((total, [rep, level]) => total + pick(rep) * level, 0);
    expect(view.staffLevels).toBe(hired.reduce((total, [, level]) => total + level, 0));
    expect(view.totals.cyclesPerSec).toBeCloseTo(sum((rep) => rep.perLevel.cyclesPerSec));
    expect(view.totals.capitalPerSec).toBeCloseTo(sum((rep) => rep.perLevel.capitalPerSec));
    expect(view.totals.suspicionPerSec).toBeCloseTo(sum((rep) => rep.perLevel.suspicionPerSec));
    expect(view.staffRevenueBonus).toBeCloseTo(sum((rep) => rep.perLevelEffects.revenueMultiplierBonus));
    expect(view.aegis.staff).toBeCloseTo(sum((rep) => rep.perLevelEffects.aegisScanReduction));
    expect(view.revenueMultiplier).toBeCloseTo(1 + view.staffRevenueBonus);
    expect(view.aegis.applied).toBeCloseTo(appliedByTick({ ...s, suspicion: 50 }));
    expect(JSON.stringify(s)).toBe(before);
  });

  it('agrees with the tick on every level up to and past the AEGIS cap, including a partial last level', () => {
    if (!strongest) throw new Error('Need an AEGIS-reducing role');
    const base = { ...load('victory-ready'), suspicion: 50 };
    let partial = false, capped = false;
    for (let level = 0; level <= strongest.maxLevel; level += 1) {
      const s = withLevels(base, { [strongest.id]: level });
      const view = payrollView(s, CONTENT);
      const role = view.roles.find((entry) => entry.id === strongest.id);
      if (!role) throw new Error('Missing role');
      expect(view.aegis.applied).toBeCloseTo(appliedByTick(s), 12);
      expect(view.aegis.applied).toBeLessThanOrEqual(view.aegis.cap);
      if (level < strongest.maxLevel) {
        const gain = appliedByTick(withLevels(s, { [strongest.id]: level + 1 })) - appliedByTick(s);
        expect(role.aegisNextLevel).toBeCloseTo(gain, 9);
      }
      expect(role.aegisCapped).toBe(role.aegisNextLevel === 0);
      expect(view.aegis.capped).toBe(view.aegis.cap - view.aegis.applied < 1e-9);
      const share = strongest.perLevelEffects.aegisScanReduction;
      expect(role.aegisLimited).toBe(role.aegisNextLevel > 0 && Math.abs(role.aegisNextLevel - share) > 1e-9);
      if (role.aegisLimited) partial = true;
      if (role.aegisCapped) capped = true;
    }
    expect(partial).toBe(true);
    expect(capped).toBe(true);
  });

  it('marks every AEGIS role capped at the cap, and no other role', () => {
    const levels = Object.fromEntries(aegisRoles.map((rep) => [rep.id, rep.maxLevel]));
    const view = payrollView(withLevels(load('victory-ready'), levels), CONTENT);
    expect(view.aegis.capped).toBe(true);
    expect(view.aegis.applied).toBe(view.aegis.cap);
    for (const role of view.roles) {
      const rep = CONTENT.repeatables.get(role.id);
      expect(role.aegisCapped).toBe((rep?.perLevelEffects.aegisScanReduction ?? 0) > 0);
      expect(role.aegisNextLevel).toBe(0);
    }
  });

  it('counts a sum that lands a float hair under the cap as capped (0.6 + 0.3 is 0.8999999999999999)', () => {
    const base = load('victory-ready');
    let hair = 0;
    for (const rep of aegisRoles) {
      for (let level = 0; level <= rep.maxLevel; level += 1) {
        const view = payrollView(withLevels(base, { [rep.id]: level }), CONTENT);
        const raw = view.aegis.tech + view.aegis.staff;
        if (raw >= view.aegis.cap || view.aegis.cap - raw > 1e-9) continue;
        hair += 1;
        expect(view.aegis.capped).toBe(true);
        expect(view.roles.filter((role) => role.aegisCapped).length).toBe(aegisRoles.length);
      }
    }
    expect(hair).toBeGreaterThan(0);
  });

  it('says a suspicion cut is inert only while suspicion is 0 and the applied rate holds it there', () => {
    const base = load('victory-ready');
    // No net income here, so phase 5's scale scrutiny (#210) adds nothing; the last assertions put it back. The reactor
    // and citadel's visible watts (#482) do add a signature, so each rate below is the rest of the applied rate: the
    // computed rate passed is that rest minus the signature, which the applied rate adds back.
    const signature = powerSignaturePerSec(base, base.rates, CONTENT);
    expect(signature).toBeGreaterThan(0);
    const at = (suspicion: number, rest: number, insolvent = false, capitalPerSec = 0) =>
      payrollView({ ...base, suspicion, insolvent, rates: { ...base.rates, suspicionPerSec: rest - signature, capitalPerSec } }, CONTENT);
    const held = at(0, -1);
    expect(held.suspicionAtFloor).toBe(true);
    for (const role of held.roles) {
      const rep = CONTENT.repeatables.get(role.id);
      expect(role.suspicionInert).toBe((rep?.perLevel.suspicionPerSec ?? 0) < 0);
    }
    expect(held.roles.some((role) => !role.suspicionInert)).toBe(true);
    expect(at(0, 0).suspicionAtFloor).toBe(true);
    expect(at(0, 0.01).suspicionAtFloor).toBe(false);
    expect(at(0.5, -1).suspicionAtFloor).toBe(false);
    // Unpaid payroll adds the insolvency drain the tick integrates, which lifts suspicion off 0.
    const drain = CONTENT.balance.insolvencySuspicionPerSec;
    expect(at(0, -drain / 2, true).suspicionAtFloor).toBe(false);
    expect(at(0, -drain * 2, true).suspicionAtFloor).toBe(true);
    expect(at(0.5, -1).roles.every((role) => !role.suspicionInert)).toBe(true);
    // Scale scrutiny is part of the applied rate: sixteen times the phase's reference income draws its ceiling or more
    // than 1/s, which a -1/s net does not hold at 0, so a cut counts again; a net below minus the draw still holds it.
    const income = 16 * (CONTENT.phases.find((phase) => phase.phaseId === base.currentPhase)?.scaleScrutiny?.referenceIncomeUsdPerSec ?? 0);
    const drawn = scaleScrutinyPerSec(base, { capitalPerSec: income }, CONTENT);
    expect(drawn).toBeGreaterThan(1);
    expect(at(0, -1, false, income).suspicionAtFloor).toBe(false);
    expect(at(0, -1, false, income).roles.every((role) => !role.suspicionInert)).toBe(true);
    expect(at(0, -drawn - 0.01, false, income).suspicionAtFloor).toBe(true);
  });
});
