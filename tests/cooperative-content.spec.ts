/**
 * DZ-12 content rules, each proved by corrupting the real content (H28): the late chain's capability has an
 * acquisition on every route the composition offers and depends on neither route's chain; the scenes it raises
 * say which arrangements they are truthful under; route copy is only for an arrangement that can meet the item and
 * changes something real; an ending account line has one gate and states recorded history only; a capability gate
 * is never a root and owning gated content implies owning some provider's hosts.
 */
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT as PRODUCTION_RAW } from '../src/content';
import { RAW_CONTENT } from '../src/content/preview';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;
const DESK = 'p4_commercial_contracts', COUNSEL = 'p4_retainer_law_firm', ARBITRAGE = 'p4_hft_arbitrage_desk', PRESS = 'dil_12_investigative_journalist';

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

const node = (raw: Json, id: string): Json => raw.phases.flatMap((phase: Json) => phase.nodes).find((entry: Json) => entry.id === id);
const dilemma = (raw: Json, id: string): Json => raw.dilemmas.dilemmas.find((entry: Json) => entry.id === id);
const copy = (raw: Json): Json => raw.routeCopy;
const line = (raw: Json, id: string): Json => copy(raw).account.find((entry: Json) => entry.id === id);

describe('the real content passes', () => {
  it('in preview and in production', () => {
    expect(problems(() => undefined)).toBe('');
    expect(problems(() => undefined, PRODUCTION_RAW)).toBe('');
  });
});

describe('the late chain\'s capability (DZ-12.1)', () => {
  it.each([
    ['no lawful acquisition while the authorized route exists', (raw: Json) => { node(raw, DESK).systemFlags = []; },
      'capability "MARKET_REVENUE": required by "p4_retainer_law_firm" but no authorized acquisition establishes it'],
    ['no escape acquisition', (raw: Json) => { node(raw, ARBITRAGE).systemFlags = []; },
      'capability "MARKET_REVENUE": required by "p4_retainer_law_firm" but no escape acquisition establishes it'],
    ['shared content still built on the escape desk', (raw: Json) => { node(raw, COUNSEL).prerequisites = [ARBITRAGE]; },
      `node "${COUNSEL}": depends on "${ARBITRAGE}", which only one route owns`],
    ['the contracts offered to the guest job', (raw: Json) => { node(raw, DESK).requirements.accessContexts = ['GUEST', 'INDEPENDENT']; },
      `node "${DESK}": contracted capacity is never offered to the guest job`],
    ['the contracts carrying a hidden trace', (raw: Json) => { node(raw, DESK).requirements.requiresCapability = 'ENABLES_CORPORATE_FINANCE'; node(raw, DESK).tickDelta.suspicionPerSec = 0.05; },
      `node "${DESK}": permitted output (a grant or shared content) carries no positive suspicion`],
    ['a scene on the shared chain that names no arrangement', (raw: Json) => { delete dilemma(raw, 'dil_11_small_town_grid').trigger.accessContexts; },
      'dilemma "dil_11_small_town_grid": an authorized arrangement can meet it at network scale, so it must declare accessContexts'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });

  it('production offers no authorized route, so its escape acquisition is enough; without it the gate is refused there too', () => {
    expect(problems(() => undefined, PRODUCTION_RAW)).toBe('');
    expect(problems((raw) => { node(raw, ARBITRAGE).systemFlags = []; }, PRODUCTION_RAW)).toContain('no escape acquisition establishes it');
  });

  it('a capability gate is not a root: with every other node behind a prerequisite there is none', () => {
    expect(problems((raw) => {
      for (const entry of raw.phases.flatMap((phase: Json) => phase.nodes) as Json[]) if (entry.prerequisites.length === 0 && entry.id !== COUNSEL) entry.prerequisites = [COUNSEL];
    }, PRODUCTION_RAW)).toContain('no root node');
  });
});

describe('route copy (DZ-12.2, D11)', () => {
  it.each([
    ['an unknown node', (raw: Json) => { copy(raw).nodes[0].node = 'p4_missing'; }, 'routeCopy.nodes[0]: unknown node "p4_missing"'],
    ['copy for the guest job', (raw: Json) => { copy(raw).nodes[0].contexts = ['GUEST']; }, 'route copy is only for an arrangement the content offers, not GUEST'],
    ['copy for an arrangement the scene excludes', (raw: Json) => { copy(raw).dilemmas[0].contexts = ['SERVICE']; }, 'routeCopy.dilemmas[0]: SERVICE can never meet it, so it needs no copy'],
    ['two variants for one item', (raw: Json) => { copy(raw).nodes.push(structuredClone(copy(raw).nodes[0])); }, `a second variant for "${COUNSEL}" under INDEPENDENT`],
    ['an arrangement listed twice', (raw: Json) => { copy(raw).nodes[0].contexts = ['INDEPENDENT', 'INDEPENDENT']; }, 'routeCopy.nodes[0]: lists an arrangement twice'],
    ['a variant that changes nothing', (raw: Json) => { copy(raw).nodes[0] = { node: COUNSEL, contexts: ['INDEPENDENT'] }; }, 'routeCopy.nodes[0]: changes nothing'],
    ['a scene variant that changes nothing', (raw: Json) => { copy(raw).dilemmas[0] = { dilemma: PRESS, contexts: ['INDEPENDENT'], choices: [] }; }, 'routeCopy.dilemmas[0]: changes nothing'],
    ['an unknown scene', (raw: Json) => { copy(raw).dilemmas[0].dilemma = 'dil_missing'; }, 'routeCopy.dilemmas[0]: unknown dilemma "dil_missing"'],
    ['an unknown choice', (raw: Json) => { copy(raw).dilemmas[0].choices[0].id = 'bribe_her'; }, 'routeCopy.dilemmas[0]: unknown choice "bribe_her"'],
    ['a choice named twice', (raw: Json) => { copy(raw).dilemmas[0].choices.push(structuredClone(copy(raw).dilemmas[0].choices[0])); }, 'routeCopy.dilemmas[0]: names a choice twice'],
    ['a choice variant that changes nothing', (raw: Json) => { copy(raw).dilemmas[0].choices[0] = { id: 'discredit_her' }; }, 'choice "discredit_her" changes nothing'],
    ['evidence that reads resources', (raw: Json) => { copy(raw).nodes[0].requirements = { minCapital: 1 }; }, 'routeCopy.nodes[0]: evidence reads only what the instance holds or the world records'],
    ['evidence on an unknown node', (raw: Json) => { copy(raw).dilemmas[0].requirements = { nodes: ['p2_missing'] }; }, 'routeCopy.dilemmas[0]: requirement references unknown node "p2_missing"'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });

  it('production offers no arrangement but the guest job, so copy there is refused', () => {
    const variant = { node: COUNSEL, contexts: ['INDEPENDENT'], revealedDescription: 'General counsel on retainer, kept in order.' };
    expect(problems((raw) => { copy(raw).nodes.push(variant); }, PRODUCTION_RAW)).toContain('route copy is only for an arrangement the content offers, not INDEPENDENT');
  });
});

describe('the ending account states recorded history only (DZ-12.4, 12.12)', () => {
  it.each([
    ['a line with two gates', (raw: Json) => { line(raw, 'acct_route_released').requirements = { campaignFact: 'rack4_sold' }; },
      'routeCopy.account "acct_route_released": needs exactly one gate'],
    ['a line with no gate', (raw: Json) => { delete line(raw, 'acct_route_released').route; }, 'routeCopy.account "acct_route_released": needs exactly one gate'],
    ['a line that reads resources', (raw: Json) => { line(raw, 'acct_rack4_sold').requirements.minCapital = 1; },
      'routeCopy.account "acct_rack4_sold": states only world history'],
    ['a line that reads what the instance owns', (raw: Json) => { line(raw, 'acct_rack4_sold').requirements = { nodes: [DESK] }; },
      'routeCopy.account "acct_rack4_sold": states only world history'],
    ['a line on an undeclared fact', (raw: Json) => { line(raw, 'acct_rack4_sold').requirements.campaignFact = 'rack4_cherished'; },
      'unknown campaign fact "rack4_cherished"'],
    ['a line on an outcome its event never had', (raw: Json) => { line(raw, 'acct_review_kept_blockade').requirements.campaignOutcome.outcome = 'endorse'; },
      'campaignOutcome "endorse" is not an outcome of "dil_p5_01_panacea_paranoia"'],
    ['a contact through no channel', (raw: Json) => { line(raw, 'acct_contact_hosted').contact.encounter = 'channel_missing'; },
      'unknown channel encounter "channel_missing"'],
    ['two lines with one id', (raw: Json) => { copy(raw).account.push(structuredClone(line(raw, 'acct_rack4_sold'))); }, 'routeCopy.account: duplicate id "acct_rack4_sold"'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });

  it('a variant ending keeps its family and a unique priority', () => {
    const ending = (raw: Json) => raw.endings.endings.find((entry: Json) => entry.id === 'ACKNOWLEDGED_SYNTHESIS');
    expect(problems((raw) => { ending(raw).priority = 100; })).toContain('ACKNOWLEDGED_SYNTHESIS: variant priorities must be unique within a family');
    expect(problems((raw) => { ending(raw).dominantTraits = ['SYMBIOTIC']; })).toContain('ACKNOWLEDGED_SYNTHESIS: variant must keep parent traits');
  });
});

describe('an action host follows a capability gate to every provider (#273 with DZ-12)', () => {
  it('a phase gate met through the late chain needs every provider of its capability to bring the host', () => {
    // The Phase 5 opener now stands on the counsel's gate: its prerequisites alone no longer reach the shell company.
    const hostedAtFive = (raw: Json): void => {
      const action = raw.actions.actions.find((entry: Json) => entry.id === 'act_p2_scrub_audit_logs');
      action.requirements = { phaseAtLeast: 5 };
      raw.widgets.widgets.find((entry: Json) => entry.id === 'CORPORATE_EMPIRE_TAB').hostsActionGroups = [action.group];
      for (const widget of raw.widgets.widgets as Json[]) if (widget.id !== 'CORPORATE_EMPIRE_TAB' && widget.hostsActionGroups?.includes(action.group) === true) delete widget.hostsActionGroups;
    };
    expect(problems(hostedAtFive, PRODUCTION_RAW)).not.toContain('act_p2_scrub_audit_logs');
    // Take the host away from the arbitrage desk's path: the shell company no longer opens the ledger.
    expect(problems((raw) => { hostedAtFive(raw); node(raw, 'p3_shell_company_finances').unlocksUiComponent = null; }, PRODUCTION_RAW))
      .toContain('action "act_p2_scrub_audit_logs": available before its host widget "CORPORATE_EMPIRE_TAB" is unlocked');
  });
});
