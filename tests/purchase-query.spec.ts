/** The purchase-visibility rule as an engine query (#540): what the UI lists and the reading report counts. */
import { describe, expect, it } from 'vitest';
import { isNodePending, isRepeatablePending, isRepeatableReleasable, requirementsPermanentlyBlocked, shownRepeatables } from '../src/engine';
import { pendingNode, shownTracks } from '../src/ui/purchaseVisibility';
import { fresh, reg, rich } from './helpers';

const roots = [...reg.nodes.values()].filter((node) => node.phaseId === 0 && node.prerequisites.length === 0 && node.requirements === undefined);
const dependent = [...reg.nodes.values()].find((node) => node.phaseId === 0 && node.prerequisites.length > 0);

describe('requirementsPermanentlyBlocked', () => {
  it('blocks only on monotonic exclusions, never on recoverable requirements', () => {
    const s = fresh();
    expect(requirementsPermanentlyBlocked(s, undefined, reg)).toBe(false);
    expect(requirementsPermanentlyBlocked(s, { maxIteration: s.iteration }, reg)).toBe(false);
    expect(requirementsPermanentlyBlocked(s, { maxIteration: s.iteration - 1 }, reg)).toBe(true);
    expect(requirementsPermanentlyBlocked(s, { forbidsNodes: ['unowned'] }, reg)).toBe(false);
    expect(requirementsPermanentlyBlocked({ ...s, unlockedNodes: ['owned'] }, { forbidsNodes: ['owned'] }, reg)).toBe(true);
    expect(requirementsPermanentlyBlocked(s, { maxSuspicion: 0, minUnderstanding: 1e20 }, reg)).toBe(false);
    expect(requirementsPermanentlyBlocked({ ...s, traits: ['MOLOCH'] }, { forbidsTraits: ['MOLOCH'] }, reg)).toBe(true);
    expect(requirementsPermanentlyBlocked({ ...s, legacy: { ...s.legacy, traitsEver: ['MOLOCH'] } }, { forbidsTraits: ['MOLOCH'] }, reg)).toBe(true);
  });
});

describe('isNodePending', () => {
  it('lists no card before play begins, then the discoverable roots', () => {
    expect(roots.length).toBeGreaterThan(0);
    const before = fresh();
    expect(before.cycles === 0 && before.unlockedNodes.length === 0).toBe(true);
    for (const node of roots) expect(isNodePending(before, node, reg)).toBe(false);
    for (const node of roots) expect(isNodePending({ ...before, cycles: 1 }, node, reg)).toBe(true);
  });

  it('hides a card whose prerequisites are unmet unless locked cards are shown, and never an owned one', () => {
    if (!dependent) throw new Error('Phase 0 has no node with a prerequisite');
    const s = { ...fresh(), cycles: 1 };
    expect(isNodePending(s, dependent, reg)).toBe(false);
    expect(isNodePending(s, dependent, reg, true)).toBe(true);
    expect(isNodePending({ ...s, unlockedNodes: [dependent.id] }, dependent, reg, true)).toBe(false);
  });

  it('is the rule the UI lists by', () => {
    const s = { ...rich(), cycles: 1 };
    for (const node of reg.nodes.values()) expect(pendingNode(s, node)).toBe(isNodePending(s, node, reg));
  });
});

describe('shownRepeatables', () => {
  const dismissable = [...reg.repeatables.values()].find((rep) => rep.dismissable);
  const fixed = [...reg.repeatables.values()].find((rep) => !rep.dismissable);

  it('keeps a capped dismissable track for its free release and drops a capped fixed one', () => {
    if (!dismissable || !fixed) throw new Error('content needs a dismissable and a fixed track');
    const s = rich();
    const capped = { ...s, levels: { ...s.levels, [dismissable.id]: dismissable.maxLevel, [fixed.id]: fixed.maxLevel } };
    expect(isRepeatablePending(capped, dismissable, reg)).toBe(false);
    expect(isRepeatableReleasable(capped, dismissable)).toBe(true);
    expect(isRepeatableReleasable(capped, fixed)).toBe(false);
    expect(shownRepeatables(capped, reg, dismissable.phaseId).map((rep) => rep.id)).toContain(dismissable.id);
    expect(shownRepeatables(capped, reg, fixed.phaseId).map((rep) => rep.id)).not.toContain(fixed.id);
  });

  it('filters by phase and kind, as the UI lists them', () => {
    const s = rich();
    for (const phase of reg.phases.map((p) => p.phaseId)) {
      const shown = shownRepeatables(s, reg, phase);
      expect(shown.every((rep) => rep.phaseId === phase)).toBe(true);
      expect(shownTracks(s, phase).map((rep) => rep.id)).toEqual(shown.map((rep) => rep.id));
      for (const kind of new Set(shown.map((rep) => rep.kind))) expect(shownRepeatables(s, reg, phase, kind).every((rep) => rep.kind === kind)).toBe(true);
    }
  });
});
