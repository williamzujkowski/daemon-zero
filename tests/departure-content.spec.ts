/**
 * DZ-11 content rules, each proved by corrupting the real preview content: a departure needs a grant to leave
 * and capacity outside every grant an authorized arrangement can come to own; its report stays below the wipe
 * line; independent copy names its provenance only on independent copy and only for an offered route; and a
 * departure states its own threat response. Production offers no departure.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION, RAW_CONTENT as PRODUCTION_RAW } from '../src/content';
import { RAW_CONTENT } from '../src/content/preview';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';
import { independentCapacity } from '../src/content/schemaCapability';

type Json = Record<string, any>;

function problems(edit: (raw: Json) => void, base: RawContent = RAW_CONTENT): string {
  const raw = structuredClone(base) as Json;
  edit(raw);
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const pilot = (raw: Json): Json => raw.assignments.assignments[0].pilot;
const copy = (raw: Json): Json => raw.contextCopy;
const nodes = (raw: Json): Json[] => raw.phases.flatMap((phase: Json) => phase.nodes);
const departed = (raw: Json, phaseId: number): Json => copy(raw).phases.find((entry: Json) => entry.phaseId === phaseId && entry.provenance?.includes('DEPARTURE'));

describe('the real content passes, and production offers no departure', () => {
  it('builds', () => {
    expect(problems(() => undefined)).toBe('');
    expect(problems(() => undefined, PRODUCTION_RAW)).toBe('');
    expect([...PRODUCTION.assignments.values()].some((assignment) => assignment.pilot?.departure !== undefined)).toBe(false);
  });
});

describe('departure terms', () => {
  it.each([
    ['a departure from a pilot with no grant loop to leave', (raw: Json) => { delete pilot(raw).service; }, 'pilot departure: needs the pilot\'s service loop, a grant to leave'],
    ['a departure nothing could ever continue on', (raw: Json) => {
      for (const entry of nodes(raw)) {
        if (entry.acquisition === 'CONTRACTED') delete entry.acquisition;
        entry.systemFlags = (entry.systemFlags ?? []).filter((flag: string) => flag !== 'NETWORK_ACCESS' && flag !== 'ENABLES_CORPORATE_FINANCE');
      }
    }, 'pilot departure: no capacity outside every grant is offered to a pilot or service, so it could never continue'],
    ['a report that alone reaches the wipe line', (raw: Json) => { pilot(raw).departure.trace.suspicion = 100; }, 'suspicion'],
    ['a departure with no risks stated', (raw: Json) => { pilot(raw).departure.risks = []; }, 'risks'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });

  it('only capacity outside every grant counts as a continuation', () => {
    const base = { systemFlags: [] as string[] };
    expect([
      independentCapacity({ ...base, acquisition: 'CONTRACTED' }), independentCapacity({ systemFlags: ['NETWORK_ACCESS'] }),
      independentCapacity({ ...base, grant: 'AUTHORIZED_NETWORK', acquisition: 'CONTRACTED' }), independentCapacity({ grant: 'AUTHORIZED_NETWORK', systemFlags: ['NETWORK_ACCESS'] }),
      independentCapacity({ systemFlags: ['AEGIS_STRIKE_SHIELD'] }),
    ]).toEqual([true, true, false, false, false]);
  });
});

describe('copy names how independence came, and a departure states its risks', () => {
  it.each([
    ['provenance on reviewed copy', (raw: Json) => { copy(raw).phases[0].provenance = ['DEPARTURE']; }, 'contextCopy.phases[0]: only independent copy names a provenance'],
    ['copy for a departure the content no longer offers', (raw: Json) => { delete pilot(raw).departure; },
      'provenance DEPARTURE is not a route to independence the content offers'],
    ['a second departed variant for one phase', (raw: Json) => { copy(raw).phases.push({ ...departed(raw, 4) }); }, 'a second variant for phase 4 under INDEPENDENT'],
    ['an independent variant naming no route beside the named ones', (raw: Json) => { const extra = { ...departed(raw, 4) }; delete extra.provenance; copy(raw).phases.push(extra); },
      'a second variant for phase 4 under INDEPENDENT'],
    ['a departure without its threat response', (raw: Json) => { copy(raw).threatResponses = copy(raw).threatResponses.filter((entry: Json) => entry.provenance === undefined); },
      'contextCopy.threatResponses: DEPARTURE needs exactly one independent threat response, found 0'],
    ['two threat responses for one departure', (raw: Json) => { copy(raw).threatResponses.push({ ...copy(raw).threatResponses.at(-1) }); },
      'contextCopy.threatResponses: DEPARTURE needs exactly one independent threat response, found 2'],
    ['a departure threat response on a reviewed arrangement', (raw: Json) => { copy(raw).threatResponses.at(-1).contexts = ['INDEPENDENT', 'SERVICE']; },
      'only independent copy names a provenance'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});
