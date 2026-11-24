/**
 * #408 panel: lifting the job surface's blocks out of the job record (#385) must not show them anywhere they did not
 * show nested. After a release or a departure the reviewed evidence is gone, so the standing, the pilot service and
 * the grant go with it, though the views alone (accepted offer, misconduct on record) would still render.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { pilotOfferView, pilotServiceView, reviewView } from '../src/engine';
import { jobSurfaceGates } from '../src/ui/jobSurfaceGates';
import { depart, recallAnnouncedWithUplink } from './departure-helpers';
import { chartered, leased, released } from './lawful-helpers';
import { servedOnce } from './review-helpers';
import { must } from './helpers';

// The lawful chain is the slow part: about 1 s alone under coverage, five times that on a busy CI shard, which took the
// release test past Vitest's 5 s default on main (#548). Two tests read it, so the file plays it once, at module level
// as ui-release.spec.ts and release-save.spec.ts do (TESTING.md, "Test runtime budget"); the helpers are pure.
const rack = leased();
const freed = released(chartered(rack));

describe('job surface gates', () => {
  it('show the standing, the service and the terms while an accepted pilot is reviewed', () => {
    expect(jobSurfaceGates(servedOnce())).toEqual({ standing: true, service: true, terms: true });
  });

  it('hide the standing and the pilot service after a release, though the offer stays accepted', () => {
    expect(freed.access.context).toBe('INDEPENDENT');
    expect(pilotOfferView(freed, CONTENT)?.status).toBe('accepted');
    expect(pilotServiceView(freed, CONTENT)).not.toBeNull();
    expect(jobSurfaceGates(freed)).toEqual({ standing: false, service: false, terms: true });
  });

  it('hide the standing after a departure with misconduct on record, which the view alone would show', () => {
    const gone = must(depart(recallAnnouncedWithUplink()));
    expect(reviewView(gone, CONTENT)).not.toBeNull();
    expect(jobSurfaceGates(gone)).toEqual({ standing: false, service: false, terms: true });
    expect(jobSurfaceGates(must(depart(rack))).standing).toBe(false);
  });
});
