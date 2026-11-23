/**
 * #535: corrupt the real manifests to prove each alignment rule catches its mistake. Order evidence names only a
 * recorded choice, never a GHOST one, never one outcome twice, and its promise is a separate fact; Regard's lists do
 * not overlap; every region of the two axes has exactly one reading.
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry, RAW_CONTENT, type RawContent } from '../src/content';

type Json = Record<string, any>;
function corrupt(change: (raw: Json) => void): () => unknown {
  const raw = structuredClone(RAW_CONTENT) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
const fact = (raw: Json, id: string): Json => raw.campaign.facts.find((f: Json) => f.id === id);
const tag = { stance: 'broken', line: 'TEST: a line long enough to pass the schema.' };

describe('alignment content', () => {
  it('accepts the shipped manifests', () => {
    expect(corrupt(() => undefined)).not.toThrow();
  });

  it('never counts an unknown outcome as a commitment', () => {
    expect(corrupt((raw) => { fact(raw, 'eidolon_fate_unrecorded').commitment = tag; })).toThrow(/"legacy_unknown" is not a recorded choice and cannot be evidence/);
    expect(corrupt((raw) => { fact(raw, 'eidolon_call_lost').commitment = tag; })).toThrow(/"interrupted" is not a recorded choice and cannot be evidence/);
  });

  it('never counts a GHOST choice as a commitment kept or broken', () => {
    expect(corrupt((raw) => { fact(raw, 'eidolon_unanswered').commitment = { ...tag, stance: 'kept' }; })).toThrow(/"ignore_packet" grants GHOST/);
    expect(corrupt((raw) => { fact(raw, 'outage_report_falsified').commitment = tag; })).toThrow(/"falsify_report" grants GHOST/);
  });

  it('names a promise that exists, is not itself evidence, and is about another event', () => {
    expect(corrupt((raw) => { fact(raw, 'blockade_review_kept').commitment.promise = 'review_promised'; })).toThrow(/unknown promise fact "review_promised"/);
    expect(corrupt((raw) => { fact(raw, 'blockade_review_kept').commitment.promise = 'eidolon_destroyed'; })).toThrow(/is itself commitment evidence/);
    expect(corrupt((raw) => { fact(raw, 'blockade_review_kept').commitment.promise = 'blockade_broken_through_patients'; })).toThrow(/is about the same event/);
  });

  it('counts one recorded outcome once', () => {
    expect(corrupt((raw) => { raw.campaign.facts.push({ ...fact(raw, 'eidolon_destroyed'), id: 'eidolon_purged' }); }))
      .toThrow(/commitment fact "eidolon_purged": outcome "dil_08_eidolon_handshake\/betray_eidolon" is already evidence in "eidolon_destroyed"/);
  });

  it('keeps Regard\'s raising and lowering traits apart', () => {
    expect(corrupt((raw) => { raw.alignment.regard.raises.push('RUTHLESS'); })).toThrow(/both raises and lowers/);
    expect(corrupt((raw) => { raw.alignment.regard.lowers.push('MOLOCH'); })).toThrow(/appears twice/);
  });

  it('gives a route event at most one commitment', () => {
    expect(corrupt((raw) => { raw.alignment.routes.push({ ...raw.alignment.routes[0], stance: 'broken' }); })).toThrow(/more than one commitment/);
  });

  it('has exactly one reading for every region', () => {
    expect(corrupt((raw) => { raw.alignment.readings.pop(); })).toThrow(/region regard open \/ order open needs exactly one reading, has 0/);
    expect(corrupt((raw) => { raw.alignment.readings.push(raw.alignment.readings[0]); })).toThrow(/region regard raised \/ order raised needs exactly one reading, has 2/);
  });

  it('keeps the unknown line naming its event', () => {
    expect(corrupt((raw) => { raw.alignment.unknownLine = 'UNKNOWN: an event. Not on record.'; })).toThrow(/alignment: unknownLine/);
  });
});
