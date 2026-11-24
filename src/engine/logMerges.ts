/**
 * The merge keys of the engine's repeatable lines (#541, util.ts `LogMerge`). Keys are built from the content's own
 * ids at run time, so a new hire or a new wild mind merges without an engine change.
 */
import type { LogMerge } from './util';

/** A hire on one track: each further hire on it is counted on one line. */
export const hireMerge = (repeatableId: string): LogMerge => ({ key: 'hire:' + repeatableId, tally: true });

/** A level let go on one track, counted the same way. */
export const releaseMerge = (repeatableId: string): LogMerge => ({ key: 'release:' + repeatableId, tally: true });

const encounterKey = (encounterId: string): string => 'encounter:' + encounterId;

/** A mind's request for a host: left open for the outcome that answers it. */
export const requestMerge = (encounterId: string): LogMerge => ({ key: encounterKey(encounterId), tally: false });

/** The outcome of a request (consumed, harnessed, referred, hosted or lapsed): joined to it, then counted if repeated. */
export const outcomeMerge = (encounter: { id: string; description: string }): LogMerge =>
  ({ key: encounterKey(encounter.id), tally: true, answers: encounter.description });
