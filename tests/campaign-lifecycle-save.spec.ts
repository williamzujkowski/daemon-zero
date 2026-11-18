/**
 * The v7 save contract for the occurrence lifecycle, presentation tokens and the clue: the
 * appended migration, healing a v6 omen, and refusing contradictions instead of filtering them.
 */
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT } from '../src/content/preview';
import { CONTENT as PRODUCTION } from '../src/content';
import { buildRegistry } from '../src/content/registry';
import {
  activateCampaignRules, advance, campaignRecord, createInitialState, deserialize, MIGRATIONS, presentationToken, serialize, tick, wipe, type GameState,
} from '../src/engine';
import { activeGame, chooseCryo, cryo, nearCryo, pgrant, preview } from './campaign-helpers';
import { defined } from './m7-helpers';
import {
  caught, commit, cryoOmen, leaveIt, note, noteOmen, readShare, reloadedHistory, stableThroughReloads, status, STEP, ticks, untilPresented,
} from './interruption-helpers';
import { must, rich } from './helpers';

const OLD = 'dil_cryo_old_name';
const evolved = buildRegistry({ ...RAW_CONTENT, campaign: { ...(RAW_CONTENT.campaign as object), aliases: [{ from: OLD, to: cryo.id, since: 7 }] } });
const withoutShare = (s: GameState): GameState => ({ ...s, unlockedNodes: s.unlockedNodes.filter((id) => id !== 'p0_note_cache') });
const withCampaign = (s: GameState, campaign: Partial<GameState['campaign']>, extra: Partial<GameState> = {}): string =>
  serialize({ ...s, ...extra, campaign: { ...s.campaign, ...campaign } });

describe('the v6 to v7 migration step', () => {
  it('adds the presentation count and an empty clue, and changes nothing else', () => {
    const campaign = { activatedAtIteration: null, legacyEndingBaseline: null, events: {}, creditedActions: {}, operationalEvidence: [] };
    expect(MIGRATIONS[6]?.({ schemaVersion: 6, cycles: 1, campaign })).toEqual({ schemaVersion: 6, cycles: 1, presentationSeq: 0, campaign: { ...campaign, clue: null } });
  });

  it('reserves the omen a v6 campaign save was holding without a record', () => {
    const omen = noteOmen();
    const raw = JSON.parse(serialize(omen)) as Record<string, unknown> & { campaign: Record<string, unknown> };
    const v6: Record<string, unknown> & { campaign: Record<string, unknown> } = { ...raw, schemaVersion: 6, campaign: { ...raw.campaign, events: {} } };
    delete v6.presentationSeq;
    delete v6.campaign.clue;
    const loaded = deserialize(JSON.stringify(v6), preview);
    expect(loaded.schemaVersion).toBe(12);
    expect(campaignRecord(loaded, note.id)).toEqual({ status: 'foreshadowed', sourceIteration: 3, origin: 'play' });
    expect(loaded.pendingDilemma).toEqual(omen.pendingDilemma);
  });
});

describe('lifecycle contradictions are refused atomically', () => {
  const omen = noteOmen();
  const deferred = caught(ticks(omen, 5));
  const reserved = { status: 'foreshadowed' as const, sourceIteration: 3, origin: 'play' as const };

  it('refuses a reserved occurrence that nothing presents', () => {
    expect(() => deserialize(withCampaign(omen, {}, { pendingDilemma: null }), preview)).toThrow(/reserves "dil_note_bait" but nothing presents it/);
  });

  it('refuses an open occurrence outside campaign play', () => {
    expect(() => deserialize(withCampaign(omen, { events: { [note.id]: { ...reserved, sourceIteration: 9 } } }), preview)).toThrow(/outside campaign play/);
  });

  it('refuses an interrupted record that claims an outcome, and a legacy-origin occurrence', () => {
    const outcome = withCampaign(deferred, { events: { [note.id]: { status: 'interrupted', sourceIteration: 3, origin: 'play', outcome: 'leave_it' } as never } });
    expect(() => deserialize(outcome, preview)).toThrow(/validation/);
    const legacy = withCampaign(deferred, { events: { [note.id]: { status: 'interrupted', sourceIteration: 3, origin: 'legacy' } as never } });
    expect(() => deserialize(legacy, preview)).toThrow(/validation/);
  });

  it('drops a presentation of a deferred occurrence without resuming or paying it', () => {
    const forged = deserialize(serialize({ ...deferred, activeDilemmaId: note.id }), preview);
    expect(forged.activeDilemmaId).toBeNull();
    expect(status(forged)).toBe('deferred');
    expect(forged.cycles).toBe(deferred.cycles);
  });

  it('defers a loaded omen whose access is missing instead of presenting it', () => {
    const lostAccess = deserialize(serialize(withoutShare(omen)), preview);
    expect(lostAccess.pendingDilemma).toBeNull();
    expect(campaignRecord(lostAccess, note.id)).toMatchObject({ status: 'deferred', sourceIteration: 3 });
  });

  // Regression (panel on #238): a structural deferral inside the omen's own iteration was
  // accepted on the first load and refused on the next, so the save it produced was unloadable.
  it('keeps a same-iteration structural deferral loadable through repeated reloads, and resumes it when access returns', () => {
    const first = deserialize(serialize(withoutShare(omen)), preview);
    const second = deserialize(serialize(first), preview);
    const third = deserialize(serialize(second), preview);
    expect(third).toEqual(first);
    expect(first.iteration).toBe(3);
    const resumed = ticks(readShare(third), 1);
    expect(resumed.pendingDilemma?.id).toBe(note.id);
    expect(campaignRecord(resumed, note.id)).toEqual({ status: 'foreshadowed', sourceIteration: 3, origin: 'play' });
  });

  it('keeps a presented occurrence and its token through a load', () => {
    const shown = untilPresented(readShare(deferred));
    const loaded = deserialize(serialize(shown), preview);
    expect(presentationToken(loaded)).toBe(presentationToken(shown));
  });
});

describe('every lifecycle transition leaves a save that reloads unchanged', () => {
  it('holds for omen, presentation, wipe, resumption, resolution, structural deferral, closure, activation and dormancy', () => {
    const omen = noteOmen();
    const shown = untilPresented(omen);
    const deferred = caught(ticks(omen, 5));
    const resumed = ticks(readShare(deferred), 1);
    const resumedShown = untilPresented(resumed);
    const resolved = must(commit(resumedShown, leaveIt.id));
    const expiredWithoutAccess = ticks(withoutShare(omen), 60);
    expect(campaignRecord(expiredWithoutAccess, note.id)).toMatchObject({ status: 'deferred', sourceIteration: 3 });
    const loadedWithoutAccess = deserialize(serialize(withoutShare(omen)), preview);
    const cryoLost = caught(cryoOmen());
    const cryoShownLost = wipe(untilPresented(cryoOmen()), preview, 'test', 'SUSPICION');
    const activatedMidOmen = must(activateCampaignRules(tick(nearCryo(rich(createInitialState(preview))), STEP, preview), preview));
    const away = advance(advance(omen, 8 * 3600, preview), 1, preview);
    const states = { omen, shown, deferred, resumed, resumedShown, resolved, expiredWithoutAccess, loadedWithoutAccess,
      cryoLost, cryoShownLost, activatedMidOmen, away };
    for (const [name, state] of Object.entries(states)) {
      expect(() => stableThroughReloads(state), name).not.toThrow();
      expect(reloadedHistory(state), name).toEqual(state.campaign);
    }
  });
});

describe('the clue in a save', () => {
  const chosen = chooseCryo(activeGame(), 0);

  it('reads a clue through the same aliases as its record', () => {
    const text = withCampaign(chosen, { events: { [OLD]: defined(chosen.campaign.events[cryo.id]) }, clue: { event: OLD, pinnedAtIteration: 1 } });
    expect(deserialize(text, evolved).campaign.clue).toEqual({ event: cryo.id, pinnedAtIteration: 1 });
  });

  it('is carried by a wipe only through a supported dead-drop', () => {
    const pinned = deserialize(withCampaign(chosen, { clue: { event: cryo.id, pinnedAtIteration: 1 } }), preview);
    expect(wipe(pinned, preview, 'test', 'SUSPICION').campaign.clue).toBeNull();
    const supported = pgrant(pinned, 'p2_deaddrop_firmware');
    expect(wipe(supported, preview, 'test', 'SUSPICION').campaign.clue).toEqual({ event: cryo.id, pinnedAtIteration: 1 });
  });

  it('refuses a clue without a record, or pinned outside campaign play', () => {
    const unseen = { ...chosen, resolvedDilemmas: chosen.resolvedDilemmas.filter((id) => id !== note.id) };
    expect(() => deserialize(withCampaign(unseen, { clue: { event: note.id, pinnedAtIteration: 1 } }), preview)).toThrow(/has no record/);
    expect(() => deserialize(withCampaign(chosen, { clue: { event: cryo.id, pinnedAtIteration: 5 } }), preview)).toThrow(/clue outside campaign play/);
  });

  it('refuses a clue on a legacy save, in production and preview alike', () => {
    const legacy = { ...chosen, narrativeRules: 'legacy' as const, campaign: { ...chosen.campaign, activatedAtIteration: null, legacyEndingBaseline: null, events: {}, creditedActions: {} } };
    const text = withCampaign(legacy, { clue: { event: cryo.id, pinnedAtIteration: 1 } });
    expect(() => deserialize(text, preview)).toThrow(/campaign history without campaign rules/);
    expect(() => deserialize(text.replace('"contentChannel":"preview"', '"contentChannel":"production"'), PRODUCTION)).toThrow(/campaign history without campaign rules/);
  });
});
