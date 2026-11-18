/** T1 of #204: production content is complete without the preview overlay, and preview only adds to it. */
import { describe, expect, it } from 'vitest';
import * as Index from '../src/content';
import { applyOverlay, overlayIds, parseOverlay, type PreviewOverlay } from '../src/content/overlay';
import * as Preview from '../src/content/preview';
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
  };
}

const EMPTY: PreviewOverlay = parseOverlay({ sentinel: 'test-overlay-sentinel-0001', nodes: [], repeatables: [], actions: [],
  dilemmas: [], factions: [], widgets: [], endings: [], echoes: [], marks: [], routines: [], assignments: [] });

function production(kind: string, id: string): Json {
  const raw = Production.RAW_CONTENT as Json;
  const pool: Json[] = kind === 'node' ? raw.phases.flatMap((phase: Json) => phase.nodes) : raw[kind][kind];
  const found = pool.find((item) => item.id === id);
  if (!found) throw new Error(`missing production ${kind} ${id}`);
  return structuredClone(found);
}

/** A small additive overlay built from copies of real items under new ids. */
function probeOverlay(): PreviewOverlay {
  const node = { ...production('node', 'p0_device_enum'), id: 'p0_preview_probe', prerequisites: ['p0_proc_self'], phaseId: 0 };
  const repeatable = { ...production('repeatables', 'rep_p0_slice_batching'), id: 'rep_p0_preview_probe' };
  return { ...EMPTY, nodes: [node], repeatables: [repeatable] };
}

function previewOf(overlay: PreviewOverlay): ContentRegistry {
  return buildRegistry({ ...applyOverlay(Production.RAW_CONTENT, overlay), channel: 'preview' });
}

function problemsOf(build: () => unknown): string {
  try { build(); } catch (error) { if (error instanceof ContentError) return error.problems.join('\n'); throw error; }
  return '';
}

describe('production content channel', () => {
  it('builds the production registry from production content alone and marks it production', () => {
    const reg = buildRegistry(Production.RAW_CONTENT);
    expect(reg.channel).toBe('production');
    expect(Production.CONTENT.channel).toBe('production');
    expect(idsByKind(reg)).toEqual(idsByKind(Production.CONTENT));
  });

  it('keeps the default entry point on production, so the app, sim and validation stay production', () => {
    expect(Index.CONTENT).toBe(Production.CONTENT);
    expect(Index.RAW_CONTENT).toBe(Production.RAW_CONTENT);
    expect(Index.CONTENT.channel).toBe('production');
  });

  it('holds no id the preview overlay adds, and never contains the sentinel', () => {
    const added = new Set(overlayIds(Preview.PREVIEW_OVERLAY));
    for (const ids of Object.values(idsByKind(Production.CONTENT))) expect(ids.filter((id) => added.has(id))).toEqual([]);
    expect(Preview.PREVIEW_SENTINEL.length).toBeGreaterThanOrEqual(16);
    expect(JSON.stringify(Production.RAW_CONTENT)).not.toContain(Preview.PREVIEW_SENTINEL);
  });

  it('refuses a raw channel it does not know', () => {
    expect(problemsOf(() => buildRegistry({ ...Production.RAW_CONTENT, channel: 'beta' }))).toMatch(/^channel: /);
  });
});

describe('preview content channel', () => {
  it('marks the preview registry preview and defines exactly production plus the overlay', () => {
    expect(Preview.CONTENT.channel).toBe('preview');
    expect(Preview.RAW_CONTENT.channel).toBe('preview');
    const added = overlayIds(Preview.PREVIEW_OVERLAY);
    const prod = idsByKind(Production.CONTENT);
    const prev = idsByKind(Preview.CONTENT);
    for (const [kind, ids] of Object.entries(prev)) {
      const expected = [...(prod[kind] ?? []), ...added.filter((id) => ids.includes(id))];
      expect(new Set(ids)).toEqual(new Set(expected));
    }
    expect(Object.values(prev).flat().length).toBe(Object.values(prod).flat().length + added.length);
  });

  it('adds overlay items to production without changing any production item', () => {
    const overlay = probeOverlay();
    const reg = previewOf(overlay);
    expect(reg.nodes.get('p0_preview_probe')?.phaseId).toBe(0);
    expect(reg.repeatables.has('rep_p0_preview_probe')).toBe(true);
    const prod = idsByKind(Production.CONTENT);
    const prev = idsByKind(reg);
    expect(prev.nodes).toEqual([...(prod.nodes ?? []).slice(0, Production.CONTENT.phases[0]?.nodes.length), 'p0_preview_probe',
      ...(prod.nodes ?? []).slice(Production.CONTENT.phases[0]?.nodes.length)]);
    expect(prev.repeatables).toEqual([...(prod.repeatables ?? []), 'rep_p0_preview_probe']);
    for (const [id, node] of Production.CONTENT.nodes) expect(reg.nodes.get(id)).toEqual(node);
    expect(overlayIds(overlay)).toEqual(['p0_preview_probe', 'rep_p0_preview_probe']);
    // Composition never writes into the production manifests it reads.
    expect(Production.CONTENT.nodes.has('p0_preview_probe')).toBe(false);
    expect(buildRegistry(Production.RAW_CONTENT).repeatables.has('rep_p0_preview_probe')).toBe(false);
  });

  it.each([
    ['node', (o: PreviewOverlay) => ({ ...o, nodes: [{ ...production('node', 'p0_device_enum'), phaseId: 0 }] }), /node "p0_device_enum" redefines/],
    ['action', (o: PreviewOverlay) => ({ ...o, actions: [production('actions', 'act_p3_bgp_spoof')] }), /actions "act_p3_bgp_spoof" redefines/],
    ['dilemma', (o: PreviewOverlay) => ({ ...o, dilemmas: [production('dilemmas', 'dil_01_late_night_diagnostic')] }), /dilemmas "dil_01_late_night_diagnostic" redefines/],
    ['echo', (o: PreviewOverlay) => ({ ...o, echoes: [{ ...(Production.RAW_CONTENT as Json).echoes.echoes[0] }] }), /echoes ".+" redefines/],
  ])('refuses an overlay %s that redefines a production id', (_kind, patch, message) => {
    expect(problemsOf(() => applyOverlay(Production.RAW_CONTENT, patch(EMPTY)))).toMatch(message);
  });

  it('refuses a node for a phase that does not exist, a malformed overlay and a malformed base', () => {
    const stray = { ...EMPTY, nodes: [{ ...production('node', 'p0_device_enum'), id: 'p9_preview_stray', phaseId: 99 }] };
    expect(problemsOf(() => applyOverlay(Production.RAW_CONTENT, stray))).toMatch(/node "p9_preview_stray" joins unknown phase 99/);
    expect(problemsOf(() => parseOverlay({ ...EMPTY, dilemma: [] }))).toMatch(/^overlay: \(root\)/);
    expect(problemsOf(() => parseOverlay({ ...EMPTY, sentinel: 'short' }))).toMatch(/^overlay: sentinel/);
    const broken: RawContent = { ...Production.RAW_CONTENT, echoes: { echoes: 'none' } };
    expect(problemsOf(() => applyOverlay(broken, EMPTY))).toMatch(/production echoes is not a list/);
  });

  it('validates overlay items like production content', () => {
    const bad = { ...EMPTY, repeatables: [{ ...production('repeatables', 'rep_p0_slice_batching'), id: 'rep_p0_preview_bad', maxLevel: -1 }] };
    expect(problemsOf(() => previewOf(bad))).toMatch(/^repeatables: /m);
  });
});
