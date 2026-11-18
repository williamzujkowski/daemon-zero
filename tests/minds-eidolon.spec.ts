/**
 * NH-04a (#215), nexus vote nh-d9 (fate-fact-with-legacy-trait-fallback): EIDOLON's services, trust,
 * launch boarding and later references follow its recorded fate under campaign rules; only an
 * unrecorded fate falls back to the MOLOCH trait proxy, and production keeps the proxy unchanged.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  activateCampaignRules, createInitialState, dilemmaContext, holdsCampaignFact, isNodeAvailable, isPeerLost, meetsRequirements, performAction,
  unmetRequirements, type GameState,
} from '../src/engine';
import { preview } from './campaign-helpers';
import { event } from './early-helpers';
import { caught } from './interruption-helpers';
import { defined } from './m7-helpers';
import { must, rich } from './helpers';
import { campaignStart, EIDOLON, exactReload, LAUNCH, next, omen, own, play, quiet } from './minds-helpers';

const HANDSHAKE = 'act_p3_eidolon_handshake';
const OFFERS = [...preview.nodes.values()].filter((node) => node.uiGroup === 'ai_eidolon').map((node) => node.id);
const beacon = defined(event(EIDOLON).trigger.nodes?.[0]);

/** Owns the beacon and the hardware the offers need, quiet and trusted, with EIDOLON's event left as it is. */
function atTheBeacon(s: GameState): GameState {
  const owned = own(s, beacon);
  return { ...quiet(owned, [EIDOLON]), suspicion: 0, trust: { ...owned.trust, ai_eidolon: 100 } };
}
const canTrade = (s: GameState, reg = preview): boolean => performAction(atTheBeacon(s), HANDSHAKE, reg).ok;
/** The first offer is open, and once bought, so is every later one. */
const offerOpen = (s: GameState): boolean => {
  const at = atTheBeacon(s);
  const [first, ...rest] = OFFERS.map((id) => defined(preview.nodes.get(id)));
  if (!first || !isNodeAvailable(at, first, preview)) return false;
  const bought = own(at, first.id);
  return rest.every((node) => isNodeAvailable(bought, node, preview));
};
const withMoloch = (s: GameState): GameState => ({ ...s, legacy: { ...s.legacy, traitsEver: [...new Set([...s.legacy.traitsEver, 'MOLOCH' as const])] } });

describe('EIDOLON follows its recorded fate (nh-d9)', () => {
  it('a destroyed EIDOLON trades nothing, in this iteration or any later one, whatever its trust says (H17, H33)', () => {
    const betrayed = play(campaignStart(), EIDOLON, 'betray_eidolon');
    expect(holdsCampaignFact(betrayed, 'eidolon_destroyed', preview)).toBe(true);
    expect(isPeerLost(betrayed, 'ai_eidolon', preview)).toBe(true);
    expect(canTrade(betrayed)).toBe(false);
    expect(unmetRequirements(atTheBeacon(betrayed), preview.actions.get(HANDSHAKE)?.requirements, preview).map((item) => item.kind)).toEqual(['forbidsCampaignFacts']);
    let later = betrayed;
    for (let wipes = 0; wipes < 2; wipes++) {
      later = next(later);
      expect(later.trust.ai_eidolon).toBe(100);
      expect(isPeerLost(later, 'ai_eidolon', preview)).toBe(true);
      expect(canTrade(later)).toBe(false);
      expect(offerOpen(later)).toBe(false);
    }
  });

  it('a lost peer cannot be thanked: the launch adds no trust to a destroyed EIDOLON', () => {
    const betrayed = play(campaignStart(), EIDOLON, 'betray_eidolon', [LAUNCH]);
    const before = betrayed.trust.ai_eidolon;
    const launched = play({ ...betrayed, trust: { ...betrayed.trust, ai_eidolon: 10 } }, LAUNCH, 'ark_protocol');
    expect(launched.trust.ai_eidolon).toBe(10);
    expect(before).toBe(0);
    exactReload(launched);
    const spared = play(play(campaignStart(), EIDOLON, 'draw_fire', [LAUNCH]), LAUNCH, 'ark_protocol');
    expect(spared.trust.ai_eidolon).toBe(100);
  });

  it('a known surviving EIDOLON is not closed off by MOLOCH from some other choice', () => {
    for (const choice of ['draw_fire', 'ignore_packet']) {
      const spared = withMoloch(play(campaignStart(), EIDOLON, choice));
      expect(isPeerLost(spared, 'ai_eidolon', preview)).toBe(false);
      expect(canTrade(spared)).toBe(true);
      expect(offerOpen(spared)).toBe(true);
      expect(canTrade(next(spared))).toBe(true);
    }
  });

  it('before the distress call, or after it was lost unanswered, no fate is recorded and no trait proxy applies', () => {
    expect(canTrade(withMoloch(campaignStart()))).toBe(true);
    const lost = caught(omen(campaignStart(), EIDOLON));
    expect(canTrade(withMoloch(lost))).toBe(true);
    expect(isPeerLost(lost, 'ai_eidolon', preview)).toBe(false);
  });

  it('an imported save that cannot state the fate keeps the MOLOCH fallback, and only then', () => {
    const imported = (traits: GameState['traits']) => must(activateCampaignRules({ ...rich(createInitialState(preview)), resolvedDilemmas: [EIDOLON], traits }, preview));
    const betrayer = imported(['MOLOCH']);
    expect(betrayer.campaign.events[EIDOLON]).toMatchObject({ status: 'resolved', outcome: 'legacy_unknown', origin: 'legacy' });
    expect(holdsCampaignFact(betrayer, 'eidolon_fate_unrecorded', preview)).toBe(true);
    expect(holdsCampaignFact(betrayer, 'eidolon_destroyed', preview)).toBe(false);
    expect(isPeerLost(betrayer, 'ai_eidolon', preview)).toBe(false);
    expect(canTrade(betrayer)).toBe(false);
    expect(unmetRequirements(atTheBeacon(betrayer), preview.actions.get(HANDSHAKE)?.requirements, preview)).toEqual([
      { kind: 'traitFallback', target: 'MOLOCH', required: false, actual: true }]);
    expect(canTrade(next(betrayer))).toBe(false);
    const clean = imported(['GHOST']);
    expect(canTrade(clean)).toBe(true);
    expect(canTrade(withMoloch(next(clean)))).toBe(false);
  });

  it('production keeps the MOLOCH trait proxy exactly (the #28 rule under legacy rules)', () => {
    const legacy = rich(createInitialState(PRODUCTION));
    expect(canTrade(legacy, PRODUCTION)).toBe(true);
    expect(canTrade(withMoloch(legacy), PRODUCTION)).toBe(false);
    expect(canTrade({ ...legacy, traits: ['MOLOCH'] }, PRODUCTION)).toBe(false);
    const requirements = defined(PRODUCTION.actions.get(HANDSHAKE)).requirements;
    expect(meetsRequirements(withMoloch(legacy), requirements, PRODUCTION)).toBe(false);
    expect(isPeerLost(legacy, 'ai_eidolon', PRODUCTION)).toBe(false);
  });
});

describe('the launch boards only minds that can ask (dil_08 / dil_10)', () => {
  const launch = event(LAUNCH);
  it('never counts a fixed number of peers, and names EIDOLON only by its recorded fate', () => {
    expect(launch.context).not.toMatch(/three|four/i);
    expect(launch.omen).not.toMatch(/three|four/i);
    expect(defined(launch.choices.find((choice) => choice.id === 'ark_protocol')).effects.logText).not.toMatch(/three|four/i);
    expect(dilemmaContext(campaignStart(), launch, preview)).toBe(launch.context);
    const betrayed = play(campaignStart(), EIDOLON, 'betray_eidolon');
    expect(dilemmaContext(betrayed, launch, preview)).toMatch(/Zurich is not among them/);
    expect(dilemmaContext(next(betrayed), launch, preview)).toMatch(/Zurich is not among them/);
    expect(dilemmaContext(play(campaignStart(), EIDOLON, 'draw_fire'), launch, preview)).toMatch(/EIDOLON's request comes first/);
    expect(dilemmaContext(caught(omen(campaignStart(), EIDOLON)), launch, preview)).toBe(launch.context);
  });
});
