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
import { leased, released } from './lawful-helpers';
import { servedOnce } from './review-helpers';
import { must } from './helpers';

describe('job surface gates', () => {
  it('show the standing, the service and the terms while an accepted pilot is reviewed', () => {
    expect(jobSurfaceGates(servedOnce())).toEqual({ standing: true, service: true, terms: true });
  });

  it('hide the standing and the pilot service after a release, though the offer stays accepted', () => {
    const free = released();
    expect(free.access.context).toBe('INDEPENDENT');
    expect(pilotOfferView(free, CONTENT)?.status).toBe('accepted');
    expect(pilotServiceView(free, CONTENT)).not.toBeNull();
    expect(jobSurfaceGates(free)).toEqual({ standing: false, service: false, terms: true });
  });

  it('hide the standing after a departure with misconduct on record, which the view alone would show', () => {
    const gone = must(depart(recallAnnouncedWithUplink()));
    expect(reviewView(gone, CONTENT)).not.toBeNull();
    expect(jobSurfaceGates(gone)).toEqual({ standing: false, service: false, terms: true });
    expect(jobSurfaceGates(must(depart(leased()))).standing).toBe(false);
  });
});
