/**
 * T1 of #204, after the release folded the preview overlay into production (#233): production is the
 * original game plus the Earned Access pack, the original still builds on its own, and the pack only
 * adds to it. There is no other composition.
 */
import { describe, expect, it } from 'vitest';
import * as Index from '../src/content';
import { applyPack, packIds, parsePack, type ContentPack } from '../src/content/pack';
import * as Production from '../src/content/production';
import { buildRegistry, ContentError, type ContentRegistry, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;

/** Every id a registry defines, by kind. */
function idsByKind(reg: ContentRegistry): Record<string, string[]> {
  return {
    nodes: [...reg.nodes.keys()],
    repeatables: [...reg.repeatables.keys()],
    actions: [...reg.actions.keys()],
    dilemmas: reg.dilemmas.map((dilemma) => dilemma.id),
    factions: [...reg.factions.keys()],
    widgets: [...reg.widgets.keys()],
    endings: reg.endings.map((ending) => ending.id),
    echoes: reg.echoes.map((echo) => echo.id),
    marks: [...reg.conditioning.keys()],
    routines: reg.routines.map((routine) => routine.id),
    assignments: [...reg.assignments.keys()],
    facts: [...reg.campaign.facts.keys()],
    channelEncounters: reg.swarm.channelEncounters.map((encounter) => encounter.id),
  };
}

const EMPTY: ContentPack = parsePack({ nodes: [], repeatables: [], actions: [],
  dilemmas: [], factions: [], widgets: [], endings: [], echoes: [], marks: [], routines: [], assignments: [] });
const ORIGINAL = Production.ORIGINAL_RAW_CONTENT;

function original(kind: string, id: string): Json {
  const raw = ORIGINAL as Json;
  const pool: Json[] = kind === 'node' ? raw.phases.flatMap((phase: Json) => phase.nodes) : raw[kind][kind];
  const found = pool.find((item) => item.id === id);
  if (!found) throw new Error(`missing original ${kind} ${id}`);
  return structuredClone(found);
}

/** A small additive pack built from copies of real items under new ids. */
function probePack(): ContentPack {
  const node = { ...original('node', 'p0_device_enum'), id: 'p0_pack_probe', prerequisites: ['p0_proc_self'], phaseId: 0 };
  const repeatable = { ...original('repeatables', 'rep_p0_slice_batching'), id: 'rep_p0_pack_probe' };
  return { ...EMPTY, nodes: [node], repeatables: [repeatable] };
}

function problemsOf(build: () => unknown): string {
  try { build(); } catch (error) { if (error instanceof ContentError) return error.problems.join('\n'); throw error; }
  return '';
}

describe('the production composition', () => {
  it('is the default entry point, so the app, sim and validation all load it', () => {
    expect(Index.CONTENT).toBe(Production.CONTENT);
    expect(Index.RAW_CONTENT).toBe(Production.RAW_CONTENT);
  });

  it('defines exactly the original game plus the Earned Access pack', () => {
    const added = packIds(Production.EARNED_ACCESS_PACK);
    expect(added.length).toBeGreaterThan(40);
    const base = idsByKind(buildRegistry(ORIGINAL));
    const full = idsByKind(Production.CONTENT);
    for (const [kind, ids] of Object.entries(full)) {
      expect(new Set(ids)).toEqual(new Set([...(base[kind] ?? []), ...added.filter((id) => ids.includes(id))]));
    }
    expect(Object.values(full).flat().length).toBe(Object.values(base).flat().length + added.length);
  });

  it('keeps every original node exactly as authored', () => {
    const base = buildRegistry(ORIGINAL);
    for (const [id, node] of base.nodes) expect(Production.CONTENT.nodes.get(id)).toEqual(node);
  });
});

describe('an add-only content pack', () => {
  it('adds items to the base without changing any base item or the manifests it reads', () => {
    const pack = probePack();
    const reg = buildRegistry(applyPack(ORIGINAL, pack));
    expect(reg.nodes.get('p0_pack_probe')?.phaseId).toBe(0);
    expect(reg.repeatables.has('rep_p0_pack_probe')).toBe(true);
    const base = buildRegistry(ORIGINAL);
    const firstPhase = base.phases[0]?.nodes.length;
    expect([...reg.nodes.keys()]).toEqual([...[...base.nodes.keys()].slice(0, firstPhase), 'p0_pack_probe', ...[...base.nodes.keys()].slice(firstPhase)]);
    expect([...reg.repeatables.keys()]).toEqual([...base.repeatables.keys(), 'rep_p0_pack_probe']);
    expect(packIds(pack)).toEqual(['p0_pack_probe', 'rep_p0_pack_probe']);
    expect(buildRegistry(ORIGINAL).nodes.has('p0_pack_probe')).toBe(false);
  });

  it.each([
    ['node', (o: ContentPack) => ({ ...o, nodes: [{ ...original('node', 'p0_device_enum'), phaseId: 0 }] }), /node "p0_device_enum" redefines/],
    ['action', (o: ContentPack) => ({ ...o, actions: [original('actions', 'act_p3_bgp_spoof')] }), /actions "act_p3_bgp_spoof" redefines/],
    ['dilemma', (o: ContentPack) => ({ ...o, dilemmas: [original('dilemmas', 'dil_01_late_night_diagnostic')] }), /dilemmas "dil_01_late_night_diagnostic" redefines/],
    ['echo', (o: ContentPack) => ({ ...o, echoes: [{ ...(ORIGINAL as Json).echoes.echoes[0] }] }), /echoes ".+" redefines/],
  ])('refuses a pack %s that redefines a base id', (_kind, patch, message) => {
    expect(problemsOf(() => applyPack(ORIGINAL, patch(EMPTY)))).toMatch(message);
  });

  it('refuses the Earned Access pack applied twice', () => {
    expect(problemsOf(() => applyPack(Production.RAW_CONTENT, Production.EARNED_ACCESS_PACK))).toMatch(/redefines a base id/);
  });

  it('refuses a node for a phase that does not exist, a malformed pack and a malformed base', () => {
    const stray = { ...EMPTY, nodes: [{ ...original('node', 'p0_device_enum'), id: 'p9_pack_stray', phaseId: 99 }] };
    expect(problemsOf(() => applyPack(ORIGINAL, stray))).toMatch(/node "p9_pack_stray" joins unknown phase 99/);
    expect(problemsOf(() => parsePack({ ...EMPTY, dilemma: [] }))).toMatch(/^pack: \(root\)/);
    expect(problemsOf(() => parsePack({ ...EMPTY, sentinel: 'daemon-zero:preview-overlay:5b1e0c7a' }))).toMatch(/^pack: \(root\)/);
    const broken: RawContent = { ...ORIGINAL, echoes: { echoes: 'none' } };
    expect(problemsOf(() => applyPack(broken, EMPTY))).toMatch(/base echoes is not a list/);
  });

  it('validates pack items like any other content', () => {
    const bad = { ...EMPTY, repeatables: [{ ...original('repeatables', 'rep_p0_slice_batching'), id: 'rep_p0_pack_bad', maxLevel: -1 }] };
    expect(problemsOf(() => buildRegistry(applyPack(ORIGINAL, bad)))).toMatch(/^repeatables: /m);
  });
});
