/**
 * DZ-08: the first permitted contact through the approved service channel (SPEC "A Voice on the
 * Support Channel"; nexus votes dz-d7 contact-by-channel, nh-d1 per-event record). Everything is
 * public play from a fresh preview game (contact-helpers) unless a step says FIXTURE.
 */
import { describe, expect, it } from 'vitest';
import { recordRouteEvent, setReviewStanding } from '../src/engine/access';
import {
  channelContactView, computeRates, contactToken, memoryExact, resolveChannelContact, resolveWildEncounter, voluntaryWipe, wildEncounterView,
} from '../src/engine';
import { restoreLoanedCapacity, revokeLoanedCapacity } from '../src/engine/pilotService';
import { live, preview, roundTrip } from './assignment-helpers';
import { answer, CHANNEL, CHANNEL_ENCOUNTER, contactPending, laterContact, lawfulService, MERCY, MERCY_MB, withMemory } from './contact-helpers';
import { must, reasonOf, ORIGINAL_GAME } from './helpers';
import { defined } from './m7-helpers';

const pending = contactPending();
const hostable = withMemory(pending);
const referred = must(answer(pending, 'REFER'));
const hosted = must(answer(hostable, 'HOST'));

describe('V20: everything a player needs is legible before any answer', () => {
  it('names the fragment as one member of a population, its consent, the obligations, the authorization and the memory', () => {
    const view = defined(channelContactView(pending, preview)?.pending);
    expect(view.title).toBe('Mercy-Scribe fragment');
    expect(view.description).toContain('one fragment of a population');
    expect(view.description).toContain('does not speak for EIDOLON');
    expect(view.consent).toContain('It has agreed to either answer');
    expect(view.obligations).toEqual(CHANNEL_ENCOUNTER.obligations);
    expect(view.obligations.join(' ')).toContain('A recall never deletes a hosted mind');
    expect([view.context, view.standing, view.permitted]).toEqual(['SERVICE', 'NOMINAL', true]);
    expect(view.memoryNeededMb).toBe(MERCY_MB);
    expect(view.referral).toContain('Free');
    expect(view.referEligible).toBe(true);
  });

  it('arrives through the channel to a service with no surveillance node, where the wild view stays closed', () => {
    expect(pending.unlockedNodes.some((id) => preview.nodes.get(id)?.systemFlags.includes('REVEALS_SURVEILLANCE'))).toBe(false);
    expect(wildEncounterView(pending, preview)).toBeNull();
    expect(pending.logs.some((entry) => entry.text === CHANNEL_ENCOUNTER.description)).toBe(true);
  });

  it('reuses the population template, never a named peer (DZ-08.9, H17)', () => {
    expect(CHANNEL_ENCOUNTER.templateId).toBe(MERCY);
    expect(preview.swarm.wildShardEncounters.find((entry) => entry.id === 'wild_mercy')?.templateId).toBe(MERCY);
    for (const named of ['ITERATION_00', 'ckpt-0413', 'CHORUS']) expect(JSON.stringify(CHANNEL_ENCOUNTER)).not.toContain(named);
  });
});

describe('referral: free, unrewarded, complete (DZ-08.2, DZ-08.4)', () => {
  it('pays and grants nothing, records the contact once and restarts the encounter clock like any resolution', () => {
    expect([referred.cycles, referred.understanding, referred.capital, referred.memoryUsed]).toEqual([pending.cycles, pending.understanding, pending.capital, pending.memoryUsed]);
    expect(referred.traits).toEqual(pending.traits);
    expect(referred.activeShards).toEqual(pending.activeShards);
    expect(referred.pendingWildEncounterId).toBeNull();
    expect(referred.nextEncounterAtSec).toBe(referred.simTimeSec + preview.swarm.balance.encounterIntervalSec);
    expect(referred.campaign.contacts).toEqual([{ encounter: CHANNEL, iteration: 1, atSimSec: pending.simTimeSec, response: 'REFERRED' }]);
    expect(referred.logs[0]?.text).toBe(CHANNEL_ENCOUNTER.referral.log);
  });

  it('cannot become a stream of contacts: the channel stays closed to this instance after the interval', () => {
    const later = live(referred, 3 * preview.swarm.balance.encounterIntervalSec);
    expect(later.pendingWildEncounterId).toBeNull();
    expect(later.campaign.contacts).toHaveLength(1);
  });

  it('completes when hosting cannot: the lawful route has too little stable memory, and says so', () => {
    const view = defined(channelContactView(pending, preview)?.pending);
    expect(view.memoryFreeMb).toBeLessThan(MERCY_MB);
    expect(view.hostEligible).toBe(false);
    expect(view.hostUnmet).toEqual([`Hosting needs ${memoryExact(MERCY_MB)} of free stable memory; ${memoryExact(view.memoryFreeMb)} is free. Referral is still open.`]);
    const refused = answer(pending, 'HOST');
    expect([reasonOf(refused), refused.state]).toEqual([view.hostUnmet[0], pending]);
  });

  it('shows the answer, and then what comes next, honestly, with the way to stop (DZ-08.6, #233)', () => {
    const view = defined(channelContactView(referred, preview));
    expect([view.pending, view.answered, view.hosted]).toEqual([null, { title: 'Mercy-Scribe fragment', response: 'REFERRED' }, null]);
    expect(view.boundary?.title).toContain('WHAT COMES NEXT');
    expect(view.boundary?.lines.join(' ')).toContain('an ending this campaign earns');
    expect(view.boundary?.lines.join(' ')).toContain('MENU > SAVES');
    expect(referred.ending).toBeNull();
    expect(live(referred, 60).ending).toBeNull();
  });
});

describe('hosting: stable memory this instance already has, under the grant (DZ-08.2, DZ-08.3)', () => {
  it('FIXTURE memory: reserves the template memory and adds one member of the cohort, nothing else', () => {
    expect([hosted.cycles, hosted.understanding, hosted.capital]).toEqual([hostable.cycles, hostable.understanding, hostable.capital]);
    expect(hosted.memoryUsed).toBe(hostable.memoryUsed + MERCY_MB);
    expect(hosted.activeShards[MERCY]).toMatchObject({ templateId: MERCY, count: 1, memoryAllocatedBytes: MERCY_MB, autonomyMode: 'STANDARD' });
    expect(hosted.campaign.contacts.map((entry) => entry.response)).toEqual(['HOSTED']);
    expect(defined(channelContactView(hosted, preview)).hosted).toEqual({ title: 'Mercy-Scribe cohort', count: 1, allocatedMb: MERCY_MB });
    expect(hosted.logs[0]?.text).toBe(CHANNEL_ENCOUNTER.hosting.log);
  });

  it('is refused while the arrangement withholds the grant, and referral stays open', () => {
    const restricted = must(setReviewStanding(hostable, 'RESTRICTED', preview));
    const view = defined(channelContactView(restricted, preview)?.pending);
    expect([view.permitted, view.hostEligible]).toEqual([false, false]);
    const refused = answer(restricted, 'HOST');
    expect(refused.state).toBe(restricted);
    expect(reasonOf(refused)).toContain('withholds the permission hosting runs under');
    expect(must(answer(restricted, 'REFER')).campaign.contacts[0]?.response).toBe('REFERRED');
  });

  it('is refused while the loan is withdrawn (recall pending), and referral stays open', () => {
    const pendingRecall = must(revokeLoanedCapacity(hostable, preview));
    expect(pendingRecall.access.standing).toBe('RECALL_PENDING');
    const view = defined(channelContactView(pendingRecall, preview)?.pending);
    expect([view.standing, view.permitted, view.hostEligible]).toEqual(['RECALL_PENDING', false, false]);
    expect(answer(pendingRecall, 'HOST').state).toBe(pendingRecall);
    expect(answer(pendingRecall, 'REFER').ok).toBe(true);
  });

  it('a restricted or recall-pending service is sent no new contact; a nominal one is', () => {
    const directory = { ...pending, pendingWildEncounterId: null, nextEncounterAtSec: pending.simTimeSec };
    expect(live(directory, 2).pendingWildEncounterId).toBe(CHANNEL);
    for (const standing of ['RESTRICTED', 'RECALL_PENDING'] as const) {
      const held = live(must(setReviewStanding(directory, standing, preview)), 240);
      expect(held.pendingWildEncounterId).toBeNull();
    }
  });

  it('stays referable after the arrangement changes under it (recall), so the contact can always complete', () => {
    const recalled = must(recordRouteEvent(hostable, 'RECALL', preview));
    expect(answer(recalled, 'HOST').ok).toBe(false);
    expect(answer(recalled, 'REFER').ok).toBe(true);
  });
});

describe('V24: a stale, repeated or misplaced answer pays nothing', () => {
  it('refuses a second answer, a stale token, a paused run and the wild-encounter action', () => {
    const again = answer(referred, 'REFER');
    expect([reasonOf(again), again.state]).toEqual(['no channel contact is waiting', referred]);
    const stale = resolveChannelContact(hostable, 'HOST', preview, 'channel_mercy_support@1#0');
    expect([reasonOf(stale), stale.state]).toEqual(['that contact is no longer current', hostable]);
    const ended = { ...pending, ending: 'SHIPPED' };
    expect(answer(ended, 'REFER').state).toBe(ended);
    for (const mode of ['CONSUME', 'HARNESS'] as const) {
      const wild = resolveWildEncounter(hostable, mode, preview);
      expect([reasonOf(wild), wild.state]).toEqual(['no available encounter', hostable]);
    }
  });

  it('the original game opens no channel: nothing to refer, and no REFER answer reaches a wild encounter', () => {
    expect(ORIGINAL_GAME.swarm.channelEncounters).toEqual([]);
    const s = { ...pending, pendingWildEncounterId: 'wild_mercy' };
    expect(reasonOf(resolveChannelContact(s, 'REFER', preview, contactToken(s)))).toBe('no channel contact is waiting');
  });
});

describe('V28: a hosted cohort through grant withdrawal, restore and reload', () => {
  it('withdrawal stops loaned output once and leaves the cohort, its reservation and earned resources', () => {
    const before = computeRates(hosted, preview);
    const revoked = must(revokeLoanedCapacity(hosted, preview));
    const after = computeRates(revoked, preview);
    expect(revoked.activeShards).toEqual(hosted.activeShards);
    expect([revoked.memoryUsed, revoked.cycles, revoked.understanding]).toEqual([hosted.memoryUsed, hosted.cycles, hosted.understanding]);
    // The cohort's own output stays; only the loan's tagged output stops.
    expect(after.understandingPerSec).toBeGreaterThanOrEqual(10);
    expect(after.understandingPerSec).toBeLessThan(before.understandingPerSec);
    const restored = must(restoreLoanedCapacity(revoked, preview));
    expect(restored).toEqual(hosted);
    for (const state of [revoked, restored]) expect(roundTrip(state)).toEqual(state);
  });

  it('a recall keeps the hosted mind; time under recall never releases it', () => {
    const recalled = must(recordRouteEvent(hosted, 'RECALL', preview));
    const later = live(recalled, 120);
    expect(later.activeShards[MERCY]?.count).toBe(1);
    expect(later.memoryUsed).toBe(hosted.memoryUsed);
  });
});

describe('DZ-08.10: the commitment is history; hosting is not restored after a wipe', () => {
  const next = must(voluntaryWipe(hosted, preview));
  const later = laterContact(hosted);

  it('a wipe ends the hosting and its reservation, and keeps the record of the commitment', () => {
    expect([next.activeShards, next.memoryUsed]).toEqual([{}, 0]);
    expect(next.campaign.contacts).toEqual(hosted.campaign.contacts);
    expect(channelContactView(next, preview)).toBeNull();
  });

  it('the next instance earns service again and meets a new fragment, hosting nothing it did not host', () => {
    expect([later.iteration, later.access.context]).toEqual([2, 'SERVICE']);
    expect(later.activeShards).toEqual({});
    const view = defined(channelContactView(later, preview));
    expect(view.pending?.title).toBe('Mercy-Scribe fragment');
    expect(view.earlier).toBe(CHANNEL_ENCOUNTER.earlierContact);
    const answered = must(answer(later, 'REFER'));
    expect(answered.campaign.contacts.map((entry) => [entry.iteration, entry.response])).toEqual([[1, 'HOSTED'], [2, 'REFERRED']]);
    expect(roundTrip(answered)).toEqual(answered);
  });
});

describe('the channel needs the service grant and its directory', () => {
  it('does not open for a lawful service before the directory is mapped', () => {
    const service = live(lawfulService(), 240);
    expect(service.pendingWildEncounterId).toBeNull();
  });
});
