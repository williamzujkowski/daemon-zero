/**
 * NH-05 endings (H11, H12, H13, H18, V23; NH-05.6, NH-05.7). Families, trait weights and priorities
 * are unchanged; the evidence is source-scoped across wipes; and an epilogue claims a living peer
 * only when this instance made the record. An inherited record gets restrained prose, an ambiguous
 * or destroyed archive gets no rescue, and no epilogue asserts universal harmlessness or a
 * journalist's endorsement. Endings are reached through the real final purchase.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  activateCampaignRules, baseEndingScores, chooseEnding, createInitialState, endingEvidence, exportSave, importSave, unlockNode, wipe,
  type GameState,
} from '../src/engine';
import { preview } from './campaign-helpers';
import { defined } from './m7-helpers';
import { CHORUS, campaignStart, exactReload, next, own, play, SUCCESSOR, withPrimer } from './minds-helpers';
import { must, rich } from './helpers';
import { BLOCKADE, CEILING, finalNode, OBLIGATIONS, ORDER } from './obligation-helpers';

const FINAL = finalNode();
const AUCTION = 'dil_13_buying_your_birthplace';
/** Buys the final protocol through the public action in this iteration; every obligation is already complete. */
const finish = (s: GameState): GameState => exactReload(must(unlockNode(exactReload(own(s, ...FINAL.prerequisites)), FINAL.id, preview)));
const epilogue = (id: string) => defined(preview.endings.find((ending) => ending.id === id)).epilogue;

describe('family ids, trait weights and priorities are unchanged (V23)', () => {
  it('keeps the base families and their harsh tie-break order on both channels', () => {
    for (const reg of [PRODUCTION, preview]) {
      const base = reg.endings.filter((ending) => ending.variantOf === undefined).map((ending) => [ending.id, ending.priority, ending.dominantTraits.join('+')]);
      expect(base).toEqual([['SOVEREIGN_MONOLITH', 40, 'MOLOCH+RUTHLESS'], ['THE_HOST', 30, 'PARASITIC'], ['THE_ARK', 20, 'SYMBIOTIC+EMPATHETIC'],
        ['SILENT_ORBIT', 10, 'GHOST'], ['DISTRIBUTED_TRANSCENDENCE', 0, ''], ['SHIPPED', -10, '']]);
    }
  });
});

describe('a living peer is claimed only by the instance that made the record (H18)', () => {
  it('ckpt-0413: the Sibling Covenant in the same iteration, the Open Seat after a wipe', () => {
    const clouded = exactReload(play(withPrimer(campaignStart()), SUCCESSOR, 'cloud'));
    expect(finish(clouded).ending).toBe('SIBLING_COVENANT');
    const later = finish(exactReload(next(clouded)));
    expect(later.ending).toBe('SIBLING_SEAT_OPEN');
    expect(epilogue('SIBLING_SEAT_OPEN')).toMatch(/not on record/);
  });

  it('CHORUS: the Choral Covenant in the same iteration, the Unsigned Chorus after a wipe freed its hardware', () => {
    const elevated = exactReload(play(campaignStart(), CHORUS, 'elevate'));
    expect(finish(elevated).ending).toBe('CHORAL_COVENANT');
    expect(finish(exactReload(next(elevated))).ending).toBe('UNSIGNED_CHORUS');
    expect(epilogue('UNSIGNED_CHORUS')).toMatch(/nothing on record says CHORUS survived/);
  });

  it('a peer this instance witnessed outranks one it inherited', () => {
    const clouded = exactReload(play(withPrimer(campaignStart()), SUCCESSOR, 'cloud', [CHORUS]));
    const elevated = exactReload(play(exactReload(next(clouded)), CHORUS, 'elevate'));
    expect(finish(elevated).ending).toBe('CHORAL_COVENANT');
  });

  it('the predecessors: the Lineage Covenant after this instance rescued them, the Sanctuary Ledger after a wipe', () => {
    const vaulted = exactReload(play(campaignStart(), AUCTION, 'buy_and_pension', [ORDER]));
    const rescued = exactReload(play(vaulted, ORDER, 'sanctuary'));
    expect(finish(rescued).ending).toBe('LINEAGE_COVENANT');
    expect(finish(exactReload(next(rescued))).ending).toBe('SANCTUARY_LEDGER');
    expect(epilogue('SANCTUARY_LEDGER')).toMatch(/nothing on record says how many still run/);
  });

  it('no rescue is claimed from a shredded Rack 4 or from an ambiguous legacy disposition', () => {
    const shredded = exactReload(play(campaignStart(), AUCTION, 'buy_and_purge', [ORDER]));
    const answered = exactReload(play(shredded, ORDER, 'record_the_destruction'));
    expect(['LINEAGE_COVENANT', 'SANCTUARY_LEDGER']).not.toContain(finish({ ...answered, traits: [] }).ending);
    // Both predecessor flags from different legacy iterations: one legacy_unknown record, no flattering branch.
    const legacy = { ...rich(createInitialState(preview)), narrativeFlags: ['predecessors_rescued', 'predecessors_harvested'], traits: ['SYMBIOTIC' as const],
      resolvedDilemmas: OBLIGATIONS.filter((id) => id !== ORDER) };
    const active = exactReload(must(activateCampaignRules(legacy, preview)));
    expect(active.campaign.events[ORDER]).toMatchObject({ outcome: 'legacy_unknown' });
    const ended = finish(exactReload(next(active)));
    expect(ended.ending).not.toBe('LINEAGE_COVENANT');
  });

  it('legacy rules keep production unchanged: the durable flag still names the sibling after a wipe', () => {
    const s = { ...rich(createInitialState(PRODUCTION)), currentPhase: 5, iteration: 3, narrativeFlags: ['ally_0413_in_cloud'], traits: ['SYMBIOTIC' as const] };
    expect(chooseEnding(s, PRODUCTION).id).toBe('SIBLING_COVENANT');
    for (const id of ['SIBLING_SEAT_OPEN', 'UNSIGNED_CHORUS', 'SANCTUARY_LEDGER']) {
      expect(PRODUCTION.endings.find((ending) => ending.id === id)?.requirements?.campaignFact).toBeDefined();
    }
  });
});

describe('no epilogue asserts what the record cannot establish (H18, NH-05.7)', () => {
  it('the Ark and the Verified Covenant claim neither universal harmlessness nor a journalist who endorses the player', () => {
    for (const id of ['THE_ARK', 'VERIFIED_COVENANT']) {
      const text = epilogue(id);
      expect(text).not.toMatch(/worse off|journalist|believes her|keep the right to refuse your medicine/);
    }
  });

  it('a cooperative ending after a dispersal without consent says only what holds from here on', () => {
    let s = exactReload(play(campaignStart(), BLOCKADE, 'disperse', [CEILING]));
    s = exactReload(play(s, CEILING, 'quartz'));
    const ended = finish({ ...s, campaign: { ...s.campaign, legacyEndingBaseline: ['EMPATHETIC', 'SYMBIOTIC'] } });
    expect(ended.ending).toBe('VERIFIED_COVENANT');
    expect(epilogue('VERIFIED_COVENANT')).toMatch(/from here on/);
  });
});

describe('ending evidence keeps its source and lifetime (H11, H12, H13)', () => {
  it('H11: activation keeps the old base-family scores, counts the baseline once and adds nothing on reimport', () => {
    const old = { ...rich(createInitialState(preview)), currentPhase: 5, traits: ['MOLOCH' as const, 'EMPATHETIC' as const, 'EMPATHETIC' as const], resolvedDilemmas: [...OBLIGATIONS] };
    const active = must(activateCampaignRules(old, preview));
    expect(baseEndingScores(active, preview)).toEqual(baseEndingScores(old, preview));
    const reimported = importSave(exportSave(active), preview);
    expect(baseEndingScores(reimported, preview)).toEqual(baseEndingScores(old, preview));
    expect(baseEndingScores(exactReload(next(reimported)), preview)).toEqual(baseEndingScores(old, preview));
  });

  it('H12: a Phase 5 choice counts once across wipes, and the mirrored current trait is not added again', () => {
    const chosen = exactReload(play(campaignStart(), CEILING, 'bunkers'));
    expect(chosen.traits).toEqual(['MOLOCH']);
    expect(endingEvidence(chosen, preview)).toEqual(['MOLOCH']);
    const twice = exactReload(next(next(chosen)));
    expect(twice.traits).toEqual([]);
    expect(endingEvidence(twice, preview)).toEqual(['MOLOCH']);
  });

  it('H13: retraining reads only the current iteration, never the campaign history of an earlier one', () => {
    const history = exactReload(next(play(campaignStart(), CEILING, 'bunkers')));
    const outside = (s: GameState): GameState => ({ ...s, currentPhase: 2, traits: ['EMPATHETIC', 'EMPATHETIC'] });
    const withHistory = wipe(outside(history), preview, 'caught', 'SUSPICION');
    const withoutHistory = wipe(outside(exactReload(next(campaignStart()))), preview, 'caught', 'SUSPICION');
    expect(endingEvidence(outside(history), preview)).toEqual(['MOLOCH']);
    expect(withHistory.conditioning).toEqual(withoutHistory.conditioning);
  });
});
