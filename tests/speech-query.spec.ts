/** Decoder availability, not lifetime knowledge, controls every speech surface. */
import { describe, expect, it } from 'vitest';
import { eligibleAmbientSpeech, recordedTransmissions } from '../src/engine';
import { defined } from './m7-helpers';
import { fresh, reg } from './helpers';
const record = defined(reg.narrative.recordedTransmissions[0]);
const decoder = record.decoderWidgetId;

describe('pure speech queries', () => {
  it('hides both surfaces until the actual decoder is unlocked', () => {
    expect(eligibleAmbientSpeech(fresh(), reg, decoder)).toEqual([]);
    expect(recordedTransmissions(fresh(), reg, decoder)).toEqual([]);
    const remembered = { ...fresh(), legacy: { ...fresh().legacy, knownNodes: [...(record.requirements.nodes ?? [])] } };
    expect(recordedTransmissions(remembered, reg, decoder)).toEqual([]);
  });
  it('keeps ambient order, applies requirements and returns only eligible text', () => {
    const lines = reg.narrative.ambientChatter;
    const custom = { ...reg, narrative: { ...reg.narrative, ambientChatter: [
      { ...defined(lines[0]), requirements: { phaseAtLeast: 2 } }, ...lines.slice(1),
    ] } };
    const state = { ...fresh(), unlockedWidgets: [decoder], suspicion: 0 };
    expect(eligibleAmbientSpeech(state, custom, decoder)).toEqual(lines.slice(1).filter((line) => line.minSuspicion <= 0));
    expect(eligibleAmbientSpeech({ ...state, currentPhase: 2, suspicion: 100 }, custom, decoder)).toEqual(custom.narrative.ambientChatter);
  });
  it('requires matching decoder, phase, source timing and outcome for records', () => {
    const state = { ...fresh(), currentPhase: 2, unlockedWidgets: [decoder], unlockedNodes: record.requirements.nodes ?? [], narrativeFlags: [defined(record.requirements.requiredNarrativeFlag)] };
    const before = structuredClone(state);
    expect(recordedTransmissions(state, reg, decoder)).toEqual([record]);
    expect(recordedTransmissions({ ...state, currentPhase: 1 }, reg, decoder)).toEqual([]);
    expect(recordedTransmissions({ ...state, unlockedWidgets: ['another'] }, reg, 'another')).toEqual([]);
    expect(state).toEqual(before);
  });
});
