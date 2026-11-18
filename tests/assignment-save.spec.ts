/**
 * The v9 -> v10 step (DZ-03): every older save gains `access.assignment: null` and keeps every other
 * access field. Proved on a genuine v9 codec output (a promoted preview campaign with evidence,
 * tests/fixtures/README.md) and on the step itself.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { assignmentView, deserialize, MIGRATIONS, SaveChannelError, SCHEMA_VERSION, serialize } from '../src/engine';
import { accept, preview, roundTrip } from './assignment-helpers';
import { must } from './helpers';

const V9 = readFileSync('tests/fixtures/pre-assignment-v9.json', 'utf8');
const ASSIGNMENT_STEP = 9;

describe('the accepted-assignment migration step', () => {
  it('adds a null acceptance and keeps every other access field as it was', () => {
    const access = { context: 'PILOT', standing: 'WARNED', exception: null, qualification: { result: 'INCOMPLETE', discrepancy: false, recordedAtSimSec: 4 } };
    expect(MIGRATIONS[ASSIGNMENT_STEP]?.({ schemaVersion: ASSIGNMENT_STEP, cycles: 3, access })).toEqual({ schemaVersion: ASSIGNMENT_STEP, cycles: 3, access: { ...access, assignment: null } });
  });

  it('leaves a malformed access record for the strict schema to refuse', () => {
    const raw = JSON.parse(V9) as Record<string, unknown>;
    expect(() => deserialize(JSON.stringify({ ...raw, access: 'pilot' }), preview)).toThrow(/access/);
  });
});

describe('the v9 fixture', () => {
  it('is a genuine v9 preview campaign save with a promotion and evidence', () => {
    const raw = JSON.parse(V9) as { schemaVersion: number; contentChannel: string; access: Record<string, unknown> };
    expect([raw.schemaVersion, raw.contentChannel]).toEqual([9, 'preview']);
    expect(Object.keys(raw.access)).toEqual(['context', 'standing', 'exception', 'qualification']);
  });

  it('loads in preview at the current version with its access intact and nothing accepted', () => {
    const before = (JSON.parse(V9) as { access: Record<string, unknown> }).access;
    const loaded = deserialize(V9, preview);
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.access).toEqual({ ...before, assignment: null, scope: null, offer: null });
    expect(serialize(roundTrip(loaded))).toBe(serialize(loaded));
  });

  it('can still accept the assignment it was never offered before, and reloads unchanged', () => {
    const loaded = deserialize(V9, preview);
    expect(assignmentView(loaded, preview)?.status).toBe('offered');
    const accepted = must(accept(loaded));
    expect(roundTrip(accepted).access.assignment?.id).toBe('asg_nightly_regression');
  });

  it('is refused by production before any healing, as every preview save is', () => {
    expect(() => deserialize(V9, PRODUCTION)).toThrow(SaveChannelError);
  });
});
