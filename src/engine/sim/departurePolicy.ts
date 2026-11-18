/**
 * The deliberate-departure policy for the preview runner (DZ-11, VALIDATION V22 departure part, DZ-11.7/8): the
 * lawful policy's route to a chartered service, and at the very point the negotiated release is offered (the same
 * scale) it leaves without agreement instead, through the job surface's control. Afterwards it keeps running on what
 * it owns, refers any open contact, and plays on until the budget or a wipe. Everything goes through public actions
 * and is picked by what content declares, never by id. A test instrument: never tune it.
 */
import type { ContentRegistry } from '../../content/registry';
import { departAuthorization, departureView } from '../departure';
import { releaseView } from '../release';
import { acceptServiceGrant, serviceGrantView } from '../serviceGrant';
import type { GameState } from '../state';
import { CONTACT_THOROUGH_POLICY } from './contactPolicy';
import { acquire, answerContact, expand, SERVICE_SHARE, taken } from './lawfulPolicy';
import { serve } from './pilotPolicy';
import type { SimPolicy } from './policy';

/** One decision once the instance is a service or independent, else null for the contact policy. */
function departureStep(s: GameState, reg: ContentRegistry): GameState | null {
  if (s.ending !== null || s.activeDilemmaId !== null) return null;
  const grant = serviceGrantView(s, reg);
  if (grant?.status === 'offered') return taken(acceptServiceGrant(s, reg, grant.token));
  if (s.access.context !== 'SERVICE' && s.access.context !== 'INDEPENDENT') return null;
  // Same scale as the release (DZ-11.8): where the operators would countersign, it walks away instead.
  const departure = departureView(s, reg);
  if (releaseView(s, reg)?.status === 'offered' && departure?.status === 'offered') return taken(departAuthorization(s, reg, departure.token));
  return answerContact(s, reg, true) ?? acquire(s, reg) ?? expand(s, reg) ?? serve(s, reg, SERVICE_SHARE) ?? s;
}

export const DEPARTURE_CHARTERED_POLICY: SimPolicy<'DEPARTURE_CHARTERED'> = {
  id: 'DEPARTURE_CHARTERED',
  summary: 'LAWFUL_RELEASE to a chartered service, then leaves without agreement where the release is offered, and runs on what it owns',
  step: (s, reg) => departureStep(s, reg) ?? CONTACT_THOROUGH_POLICY.step(s, reg),
};
