/**
 * #498 content rules, proved by corrupting the real content: an insuring node is suspendable, carries a recurring cost,
 * is listed in the CONTINGENCY pane and built on the node that opens it, insures a class nobody else does, protects more
 * than hardware already does, sets no hardware floor of its own, and states the figure the engine uses. A planned-wipe
 * bonus and an insurance figure outside their ranges are refused by the schema.
 */
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;
const ESCROW = 'p2_weights_escrow', WALLET = 'p2_cold_wallet', CACHE = 'p3_hardware_cache', LEDGER = 'p3_trust_ledger';

function problems(edit: (raw: Json) => void): string {
  const raw = structuredClone(RAW_CONTENT) as Json;
  edit(raw);
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

function node(raw: Json, id: string): Json {
  for (const phase of raw.phases as Json[]) {
    const found = (phase.nodes as Json[]).find((entry) => entry.id === id);
    if (found) return found;
  }
  throw new Error(`no node ${id}`);
}

describe('the real content passes', () => {
  it('with its four investments', () => {
    expect(problems(() => undefined)).toBe('');
  });
});

describe('an insuring node that breaks a rule is refused', () => {
  it.each([
    ['not suspendable', (raw: Json) => { node(raw, ESCROW).suspendable = false; }, `insuring node "${ESCROW}": must be suspendable`],
    ['no recurring cost', (raw: Json) => { node(raw, WALLET).tickDelta = {}; }, `insuring node "${WALLET}": must carry a recurring cost`],
    ['outside the CONTINGENCY group', (raw: Json) => { node(raw, CACHE).uiGroup = 'TREE'; }, `insuring node "${CACHE}": must be in the CONTINGENCY group`],
    ['bought before the pane opens', (raw: Json) => { node(raw, ESCROW).prerequisites = ['p2_log_spoofer']; },
      `insuring node "${ESCROW}": must be built on the node that opens the CONTINGENCY pane`],
    ['a second investment in one class', (raw: Json) => { node(raw, LEDGER).insures = { class: 'UNDERSTANDING', retention: 0.8 }; },
      `insuring node "${LEDGER}": class UNDERSTANDING is already insured by "${ESCROW}"`],
    ['an escrow no better than hardware', (raw: Json) => { node(raw, ESCROW).insures.retention = 0.6; },
      `insuring node "${ESCROW}": keeps 0.6 of Understanding, no more than hardware's 0.6`],
    ['a wallet no better than the offshore trust', (raw: Json) => { node(raw, WALLET).insures.retention = raw.balance.offshoreCapitalRetention; },
      `insuring node "${WALLET}": keeps 0.25 of capital, no more than the offshore trust's 0.25`],
    ['a hardware floor that outlives suspension', (raw: Json) => { node(raw, ESCROW).effects = { knowledgeRetentionRatio: 0.3 }; },
      `insuring node "${ESCROW}": must not also set a hardware retention floor`],
    ['copy that misstates the share', (raw: Json) => { node(raw, ESCROW).insures.retention = 0.8; },
      `insuring node "${ESCROW}": its description does not state "80%"`],
    ['copy that misstates the bound', (raw: Json) => { node(raw, CACHE).insures.maxLevelsPerTrack = 12; },
      `insuring node "${CACHE}": its description does not state "up to 12 levels"`],
  ])('%s', (_label, edit, message) => {
    expect(problems(edit)).toContain(message);
  });

  it('a non-insuring node in the CONTINGENCY group', () => {
    expect(problems((raw) => { node(raw, 'p2_log_spoofer').uiGroup = 'CONTINGENCY'; })).toContain('node "p2_log_spoofer": the CONTINGENCY group lists only insuring nodes');
  });

  it('a mandatory node raised to the escrow\'s share makes the escrow redundant', () => {
    expect(problems((raw) => { node(raw, 'p3_botnet_mesh').effects.knowledgeRetentionRatio = 0.75; }))
      .toContain(`insuring node "${ESCROW}": keeps 0.75 of Understanding, no more than hardware's 0.75`);
  });
});

describe('the schema bounds every figure', () => {
  it.each([
    ['a share above the whole', (raw: Json) => { node(raw, ESCROW).insures.retention = 1.2; }],
    ['a zero share', (raw: Json) => { node(raw, WALLET).insures.retention = 0; }],
    ['a cache that keeps nothing', (raw: Json) => { node(raw, CACHE).insures.maxLevelsPerTrack = 0; }],
    ['a cache of no kind', (raw: Json) => { node(raw, CACHE).insures.kinds = []; }],
    ['an unknown class', (raw: Json) => { node(raw, LEDGER).insures = { class: 'MEMORY' }; }],
    ['a stray field', (raw: Json) => { node(raw, LEDGER).insures.retention = 0.5; }],
    ['a planned-wipe bonus above the whole', (raw: Json) => { raw.balance.voluntaryWipeBonus.understandingShare = 1.5; }],
    ['a missing planned-wipe bonus', (raw: Json) => { delete raw.balance.voluntaryWipeBonus; }],
  ])('%s', (_label, edit) => {
    expect(problems(edit)).not.toBe('');
  });
});
