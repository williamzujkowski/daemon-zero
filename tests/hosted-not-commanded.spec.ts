/**
 * #309 finding 2, through public play on the preview registry: a population fragment hosted through an
 * authorized channel is "hosted, not commanded" (the channel's obligations, read before the player hosts it),
 * and the ending account says it was hosted "on the terms it was offered". No cohort command (PRUNE, CLAMP,
 * ELEVATE) is offered on a cohort that holds a channel-hosted member, and the action refuses it unchanged.
 * A cohort nobody hosted through a channel keeps every command.
 */
import { describe, expect, it } from 'vitest';
import { executeShardCommand, shardCommandView, shardEntryView, type GameState, type ShardCommand } from '../src/engine';
import { preview, roundTrip } from './assignment-helpers';
import { answer, CHANNEL_ENCOUNTER, contactPending, MERCY, withMemory } from './contact-helpers';
import { must, reasonOf } from './helpers';
import { defined } from './m7-helpers';

const COMMANDS: readonly ShardCommand[] = ['PRUNE', 'CLAMP', 'ELEVATE'];
const NOT_COMMANDED = 'Hosted through an authorized channel on the terms it was offered: it is not commanded.';

const hosted = must(answer(withMemory(contactPending()), 'HOST'));
/**
 * FIXTURE: the hosted cohort at the drift elevation needs, with the resources and memory every command
 * costs, so no price or threshold decides a refusal, and a surveillance node, since cohort commands are the
 * decoded mind's tools (#313) and the lawful service holds none. Only those change.
 */
function matured(s: GameState): GameState {
  const cohort = defined(s.activeShards[MERCY]);
  return decoded({ ...s, cycles: 1e9, understanding: 1e9, memoryCap: s.memoryCap + 1024,
    activeShards: { ...s.activeShards, [MERCY]: { ...cohort, drift: preview.swarm.balance.elevateMinDrift + 10 } } });
}
/** FIXTURE: the surveillance node added by hand, not unlocked, so it is added after a reload, never saved. */
function decoded(s: GameState): GameState {
  return { ...s, unlockedNodes: [...s.unlockedNodes, surveillance()] };
}

describe('#309: a channel-hosted fragment is hosted, not commanded', () => {
  it('the obligations the player read before hosting say so', () => {
    expect(CHANNEL_ENCOUNTER.obligations.join(' ')).toContain('It is hosted, not commanded.');
    expect(hosted.activeShards[MERCY]).toMatchObject({ autonomyMode: 'STANDARD', count: 1 });
  });

  it.each(COMMANDS)('%s is refused unchanged: no shackle, no MOLOCH, no reset, no elevation', (command) => {
    const s = matured(hosted);
    const refused = executeShardCommand(s, MERCY, command, preview);
    expect([refused.ok, reasonOf(refused), refused.state]).toEqual([false, NOT_COMMANDED, s]);
    expect(refused.state.traits).not.toContain('MOLOCH');
  });

  it.each(COMMANDS)('%s is not offered: the view gives the reason and is not eligible', (command) => {
    const view = shardCommandView(matured(hosted), MERCY, command, preview);
    expect(view.eligible).toBe(false);
    expect(view.unmet).toContain(NOT_COMMANDED);
  });

  it('the cohort entry carries no commands and says why', () => {
    const view = defined(shardEntryView(matured(hosted), MERCY, preview));
    expect([view.commands, view.terms]).toEqual([[], NOT_COMMANDED]);
  });

  it('the refusal survives a reload: the hosted cohort is read from the campaign record, not stored', () => {
    const { unlockedNodes } = hosted;
    const loaded = decoded(roundTrip({ ...matured(hosted), unlockedNodes }));
    expect(reasonOf(executeShardCommand(loaded, MERCY, 'CLAMP', preview))).toBe(NOT_COMMANDED);
  });

  it('a cohort of the same population no channel hosted still takes every command', () => {
    // FIXTURE: the same cohort without the channel record, as a wild Mercy-Scribe harnessed outside the route.
    const wild = { ...matured(hosted), campaign: { ...hosted.campaign, contacts: [] } };
    for (const command of COMMANDS) expect(executeShardCommand(wild, MERCY, command, preview).ok).toBe(true);
    expect(shardCommandView(wild, MERCY, 'CLAMP', preview).unmet).not.toContain(NOT_COMMANDED);
  });

  it('a referred contact holds no hosted member, so a cohort of that population is not affected', () => {
    // FIXTURE: the same cohort beside a referral, as a wild Mercy-Scribe harnessed by an instance that referred.
    const referred = { ...matured(hosted), campaign: { ...hosted.campaign, contacts: hosted.campaign.contacts.map((entry) => ({ ...entry, response: 'REFERRED' as const })) } };
    expect(executeShardCommand(referred, MERCY, 'CLAMP', preview).ok).toBe(true);
  });

  it('an earlier instance\'s hosting does not bind this instance\'s cohort', () => {
    // FIXTURE: the record dated to an earlier iteration; a wipe ended that hosting (DZ-08.10).
    const earlier = { ...matured(hosted), iteration: hosted.iteration + 1 };
    expect(executeShardCommand(earlier, MERCY, 'CLAMP', preview).ok).toBe(true);
  });
});

/** A node that reveals surveillance, so the swarm view (surveillance-gated) can be read. */
function surveillance(): string {
  return defined([...preview.nodes.values()].find((node) => node.systemFlags.includes('REVEALS_SURVEILLANCE'))).id;
}
