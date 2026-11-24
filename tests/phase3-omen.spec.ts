/**
 * An earlier Phase 3 beat (#544, pacing review C4): from the moment the internet opens, the NET feed carries EIDOLON's
 * omen (a responder that answers in primes, a triage queue that clears itself, AEGIS tasked to hunt prime-timed hosts)
 * and the dark forest's one rule, long before the distress packet. Each line stays true to the campaign's record of
 * EIDOLON: nothing implies EIDOLON is out there once the record says it died, or at work once it was rescued.
 */
import { describe, expect, it } from 'vitest';
import { eligibleAmbientSpeech, type GameState } from '../src/engine';
import { activeGame, decoder, preview } from './campaign-helpers';
import { resolveEvent } from './early-helpers';
import { defined } from './m7-helpers';
import { fresh, reg } from './helpers';

const OMEN = ['forum_11', 'forum_12', 'forum_13', 'forum_14'] as const;
const PHASE = 3;
const at = (s: GameState, registry = reg): string[] =>
  eligibleAmbientSpeech({ ...s, unlockedWidgets: [decoder], currentPhase: PHASE, suspicion: 0 }, registry, decoder).map((line) => line.id);
const omenHeard = (s: GameState, registry = reg): string[] => at(s, registry).filter((id) => (OMEN as readonly string[]).includes(id));

describe('the internet opens on an omen (#544)', () => {
  it('carries every omen line on the NET source, short enough for one feed slot', () => {
    for (const id of OMEN) {
      const line = defined(reg.narrative.ambientChatter.find((entry) => entry.id === id));
      expect(line.source).toBe('netsec');
      expect(line.minSuspicion).toBe(0);
      // One 8 s rotation slot at 238 wpm holds 32 words (docs/BALANCE.md, "Reading load").
      expect(line.text.split(/\s+/).length).toBeLessThanOrEqual(32);
    }
  });

  it('plays all four from the first second of Phase 3, before any Phase 3 purchase or dilemma', () => {
    expect(omenHeard(fresh())).toEqual([...OMEN]);
  });

  it('falls silent on EIDOLON once the campaign records it destroyed, keeping only the dark forest\'s rule', () => {
    const betrayed = resolveEvent(activeGame(), 'dil_08_eidolon_handshake', 'betray_eidolon');
    expect(omenHeard(betrayed, preview)).toEqual(['forum_12']);
  });

  it('stops the hunt and the night-shift triage once EIDOLON is rescued to cold storage', () => {
    const rescued = resolveEvent(activeGame(), 'dil_08_eidolon_handshake', 'draw_fire');
    expect(omenHeard(rescued, preview)).toEqual(['forum_11', 'forum_12']);
  });

  it('keeps the omen when the call went unanswered: EIDOLON lasted the night', () => {
    const ignored = resolveEvent(activeGame(), 'dil_08_eidolon_handshake', 'ignore_packet');
    expect(omenHeard(ignored, preview)).toEqual([...OMEN]);
  });
});
