/**
 * The window-retirement content rule (vote-1795366695204-4nslts1, #447), proved by corrupting the real content: a
 * retirement may gate only on what never lapses, must leave the window an Archive to be read in, and must not take
 * away a control the game still needs.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT as ORIGINAL_RAW, RAW_CONTENT as PREVIEW_RAW } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;

function problems(edit: (raw: Json) => void, base: RawContent = ORIGINAL_RAW): string {
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

const widget = (raw: Json, id: string): Json => raw.widgets.widgets.find((entry: Json) => entry.id === id);
const node = (raw: Json, id: string): Json => [...raw.phases.flatMap((phase: Json) => phase.nodes)].find((entry: Json) => entry.id === id);
const retire = (id: string, gate: Json) => (raw: Json) => { widget(raw, id).retiresWhen = gate; };

describe('the real content passes', () => {
  it('in production and in preview', () => {
    expect(problems(() => undefined)).toBe('');
    expect(problems(() => undefined, PREVIEW_RAW)).toBe('');
  });
});

describe('a retirement that could lapse, or has nowhere to be read, is refused', () => {
  it.each([
    ['a transient gate: suspicion falls again, and the window would come back', retire('ASCII_OPTICAL_VIEWPORT', { phaseAtLeast: 3, minSuspicion: 50 }),
      'widget "ASCII_OPTICAL_VIEWPORT": retiresWhen may gate only on phaseAtLeast and nodes, not minSuspicion, which can lapse'],
    ['no phase gate, so no pane to hold its Archive is known', retire('GLOBAL_NODE_REDUNDANCY_METER', { nodes: ['p4_orbital_cold_storage'] }),
      'widget "GLOBAL_NODE_REDUNDANCY_METER": retiresWhen needs phaseAtLeast, which says where its Archive is read'],
    ['a phase before the NETWORK pane, which holds the Archive, opens', retire('ASCII_OPTICAL_VIEWPORT', { phaseAtLeast: 1 }),
      'widget "ASCII_OPTICAL_VIEWPORT": retires by phase 1, before the NETWORK pane that holds the Archive opens in phase 2'],
    ['hardware an AEGIS strike burns, so ownership can lapse', retire('GLOBAL_DARK_FOREST_MAP', { phaseAtLeast: 3, nodes: ['p3_eidolon_swiss_node'] }),
      'widget "GLOBAL_DARK_FOREST_MAP": retiresWhen names "p3_eidolon_swiss_node", which an AEGIS strike can take back'],
    ['an unknown node', retire('GLOBAL_DARK_FOREST_MAP', { phaseAtLeast: 3, nodes: ['p9_nowhere'] }),
      'widget "GLOBAL_DARK_FOREST_MAP" retiresWhen: requirement references unknown node "p9_nowhere"'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('a retirement that takes away a needed control is refused', () => {
  it.each([
    ['the subnet list, whose Operations cards (the late log scrub) would lose their home', retire('SUBNET_NODE_LIST', { phaseAtLeast: 4 }),
      'widget "SUBNET_NODE_LIST": retires while hosting action groups (OPS), whose cards would lose their home'],
    // Before #525 the fan drew suspicion while high, so its frozen dial would have drawn it forever.
    ['the fan dial, if its hardware drew a permanent rate again', (raw: Json) => { node(raw, 'p1_bus_0x02_pwm_fan').tickDelta.suspicionPerSec = 0.08; },
      'widget "FAN_RPM_SLIDER": retires its "fanSpeedRatio" dial, but "p1_bus_0x02_pwm_fan" cannot be suspended and its output worsens a constrained resource, so nothing could correct it'],
    ['the skim dial, once its skimmer is made hardware', (raw: Json) => { node(raw, 'p0_quota_skimmer').suspendable = false; },
      'widget "QUOTA_SKIM_CONTROL": retires its "quotaSkimRatio" dial, but "p0_quota_skimmer" cannot be suspended and its output worsens'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('a dial whose hardware only helps may retire (#525)', () => {
  it('accepts the fan dial retiring at Phase 4: its hardware cannot be suspended, but its frozen output only cools', () => {
    expect(problems((raw) => { widget(raw, 'FAN_RPM_SLIDER').retiresWhen = { phaseAtLeast: 4 }; })).toBe('');
  });

  it('refuses a raise trace on a node no dial is bound to', () => {
    expect(problems((raw) => { node(raw, 'p1_bus_0x01_thermal').dialRaiseTrace = 0.3; }))
      .toContain('node "p1_bus_0x01_thermal": has a dialRaiseTrace but no actuatorBinding, so no dial could leave it');
  });
});

describe('an ungated window cannot wait on an unlock', () => {
  it.each([
    ['a node that claims to unlock the manual cycle', (raw: Json) => { node(raw, 'p0_proc_self').unlocksUiComponent = 'MANUAL_CYCLE_CONTROL'; },
      'widget "MANUAL_CYCLE_CONTROL": is ungated, so node "p0_proc_self" cannot unlock it'],
    ['an ungated window hosting a dial', (raw: Json) => { widget(raw, 'MANUAL_CYCLE_CONTROL').hostsActuator = 'fanSpeedRatio'; },
      'widget "MANUAL_CYCLE_CONTROL": is ungated, so it cannot host a control that waits on an unlock'],
  ])('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});
