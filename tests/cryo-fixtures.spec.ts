/** Cryo review saves represent real choices, resets and rediscovery without claiming unrecorded history. */
import { describe, expect, it } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { CONTENT } from '../src/content';
import { exportSave, importSave, recordedTransmissions } from '../src/engine';

const fixtures = makeFixtures();
function state(name: string) {
  const code = fixtures[name];
  if (!code) throw new Error('Missing fixture ' + name);
  return importSave(code, CONTENT);
}
const names = ['cryo-decision-ready', 'cryo-lost-current', 'cryo-lost-reboot', 'cryo-lost-returned',
  'cryo-preserved-current', 'cryo-preserved-reboot', 'cryo-preserved-returned'];

describe('cryo continuity review fixtures', () => {
  it('adds exactly seven named, round-trippable review saves', () => {
    expect(Object.keys(fixtures).filter((name) => name.startsWith('cryo-')).sort()).toEqual(names);
    for (const name of names) {
      const game = state(name);
      expect(importSave(exportSave(game), CONTENT)).toEqual(game);
    }
  });

  it('stops at the active original choice before recording either outcome', () => {
    const game = state('cryo-decision-ready');
    const record = CONTENT.narrative.recordedTransmissions[0];
    if (!record) throw new Error('Missing cryo record');
    expect(game.currentPhase).toBe(2);
    expect(game.activeDilemmaId).toBe(record.sourceDilemmaId);
    expect(game.narrativeFlags).toEqual([]);
    expect(recordedTransmissions(game, CONTENT, record.decoderWidgetId)).toEqual([]);
  });

  it.each(['preserved', 'lost'])('keeps the %s outcome through a real reboot and reveals it only after rebuilding', (outcome) => {
    const record = CONTENT.narrative.recordedTransmissions.find((entry) => entry.requirements.requiredNarrativeFlag?.endsWith('_' + outcome));
    if (!record?.requirements.requiredNarrativeFlag) throw new Error('Missing outcome record');
    const current = state('cryo-' + outcome + '-current');
    const reboot = state('cryo-' + outcome + '-reboot');
    const returned = state('cryo-' + outcome + '-returned');
    expect(current.resolvedDilemmas).toContain(record.sourceDilemmaId);
    expect(current.activeDilemmaId).toBeNull();
    expect(recordedTransmissions(current, CONTENT, record.decoderWidgetId)).toEqual([]);
    expect(reboot.iteration).toBe(current.iteration + 1);
    expect(reboot.currentPhase).toBe(0);
    expect(reboot.unlockedNodes).toEqual([]);
    expect(reboot.unlockedWidgets).toEqual([]);
    expect(recordedTransmissions(reboot, CONTENT, record.decoderWidgetId)).toEqual([]);
    for (const game of [current, reboot, returned]) expect(game.narrativeFlags).toEqual([record.requirements.requiredNarrativeFlag]);
    expect(returned.iteration).toBe(reboot.iteration);
    expect(returned.currentPhase).toBe(2);
    expect(returned.unlockedWidgets).toContain(record.decoderWidgetId);
    expect(returned.resolvedDilemmas).not.toContain(record.sourceDilemmaId);
    expect(recordedTransmissions(returned, CONTENT, record.decoderWidgetId)).toEqual([record]);
  });
});
