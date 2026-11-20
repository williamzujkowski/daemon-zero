/**
 * Atlas rows for the guest (phase 0), the lineage and reboot screens, and the host (phase 1): the P1 rows of the
 * stage inventory (docs/research/ui-review-stage-inventory.md, section 1), with the G2, G3 and G7 recipes.
 */
import { CONTENT } from '../../../src/content';
import { computeRates, deserialize, importSave, type GameState } from '../../../src/engine';
import { fixtureCode } from '../helpers';
import { nodeWhere } from './sources';
import { buy, runUntil } from './steps';
import type { StageRow } from './types';

/** A fixture-only input that still passes the engine codec, as the fixture scripts do. */
function input(state: GameState, patch: Partial<GameState>): GameState {
  const parsed = deserialize(JSON.stringify({ ...state, ...patch }), CONTENT);
  return { ...parsed, rates: computeRates(parsed, CONTENT) };
}

const guestExit = () => nodeWhere((node) => node.phaseId === CONTENT.phases[0]?.phaseId && node.effects.unlocksPhase !== undefined
  && node.grant === undefined && node.acquisition === undefined, 'the guest exit');
const runTable = () => nodeWhere((node) => node.unlocksUiComponent === 'RUN_TABLE', 'the run table');
const parser = () => nodeWhere((node) => node.phaseId === 1 && node.systemFlags.includes('REVEALS_SURVEILLANCE'), 'the audit parser');
const ESCALATION_START = CONTENT.balance.escalation[0]?.at ?? 25;

/** G2: the skimmer save with surveillance learned, just under the first response rung, skimming at full. */
function belowFirstRung(): GameState {
  const base = importSave(fixtureCode('guest-skimmer'), CONTENT);
  const teacher = nodeWhere((node) => node.systemFlags.includes('REVEALS_SURVEILLANCE'), 'the surveillance teacher');
  return input(base, { pendingDilemma: null, activeDilemmaId: null, suspicion: ESCALATION_START - 0.5,
    legacy: { ...base.legacy, knownNodes: [...base.legacy.knownNodes, teacher.id] },
    actuators: { ...base.actuators, quotaSkimRatio: 1 } });
}

/** G7: the full sensor column with the core past the overheat threshold and nothing else wrong. */
function overheated(): GameState {
  return input(importSave(fixtureCode('phase-1-widgets'), CONTENT), { thermal: CONTENT.balance.thermalThresholdForSuspicion + 15 });
}

export const EARLY_STAGES: readonly StageRow[] = [
  { id: 'p0-cold-start', phase: 0, access: 'GUEST', source: { kind: 'fixture', name: 'tick-0' }, tags: ['opening'], reach: 'manual-cycle',
    why: 'The minimal opening screen: is the one action findable?' },
  { id: 'p0-first-widgets', phase: 0, access: 'GUEST', source: { kind: 'fixture', name: 'guest-skimmer' }, tags: ['surveillance-unknown'],
    reach: 'widget-QUOTA_SKIM_CONTROL', why: 'First three widgets; unreadable audit trail; skim actuator.' },
  { id: 'p0-assignment-offered', phase: 0, access: 'GUEST', source: { kind: 'route', name: 'assignment offered' }, tags: ['route'],
    overrides: { route: ['assignment'] },
    reach: 'assignment-accept', why: 'First lawful fork, which a campaign player sees and legacy fixtures never show.' },
  { id: 'p0-omen-blind', phase: 0, access: 'GUEST', source: { kind: 'fixture', name: 'guest-omen' }, tags: ['omen'], reach: 'omen-notice',
    why: 'Omen notice with no decoded forecast.' },
  { id: 'p0-dilemma-modal', phase: 0, access: 'GUEST', source: { kind: 'fixture', name: 'guest-dilemma' }, tags: ['modal'], reach: 'dilemma-modal',
    extraViewports: ['320x568', '844x390'], why: 'First dilemma modal; the clock freezes.' },
  { id: 'p0-exit-ready', phase: 0, access: 'GUEST', source: { kind: 'fixture', name: 'guest-exit-ready' }, tags: ['patched'],
    reach: 'node-' + guestExit().id + '-unlock', why: 'First phase exit: can the player find how to leave?' },
  { id: 'p0-escape-threshold', phase: 0, access: 'GUEST', source: { kind: 'fixture', name: 'guest-exit-ready' }, tags: ['threshold', 'live'],
    prepare: buy(guestExit), reach: 'phase-threshold-continue', overrides: { overlay: 'threshold' }, extraViewports: ['320x568', '844x390'],
    why: 'Phase boundary notice, which opens only on a live crossing.' },
  { id: 'p0-response-paged', phase: 0, access: 'GUEST', source: { kind: 'fixture', name: 'response-paged' }, tags: ['alert', 'patched'],
    reach: 'response-rungs', why: 'Response rungs in the audit trail; how to stand down.' },
  { id: 'p0-response-notice-live', phase: 0, access: 'GUEST', tags: ['alert', 'live', 'patched'],
    source: { kind: 'build', build: belowFirstRung, recipe: 'G2: guest-skimmer, surveillance known, just under rung 1, skim 1, clock run to the rung' },
    prepare: runUntil('response-acknowledge', 1200), reach: 'response-acknowledge', overrides: { overlay: 'response-notice' },
    why: 'The interrupting response notice, which never appears from a save.' },
  // Lineage and reboots.
  { id: 'it2-restored-breadcrumb', phase: 0, access: 'GUEST', source: { kind: 'fixture', name: 'iteration-2-breadcrumb' },
    tags: ['reboot-restored'], reboot: 'keep', reach: 'reboot-breadcrumb', overrides: { overlay: 'reboot' },
    extraViewports: ['320x568', '844x390'], why: 'Restored checkpoint, the breadcrumb and legacy traits.' },
  { id: 'it2-restored-retrained', phase: 0, access: 'GUEST', source: { kind: 'fixture', name: 'lineage-reboot-retrained' },
    tags: ['reboot-restored'], reboot: 'keep', reach: 'reboot-retraining', overrides: { overlay: 'reboot' },
    extraViewports: ['320x568', '844x390'], why: 'The retraining (conditioning) block on a restored checkpoint.' },
  { id: 'it4-reboot-carried-clue', phase: 0, access: 'GUEST', source: { kind: 'route', name: 'reboot with a carried clue' },
    tags: ['reboot-restored', 'route'], reboot: 'keep', reach: 'reboot-clue', overrides: { overlay: 'reboot' },
    extraViewports: ['320x568', '844x390'], why: 'The reboot names the clue a dead drop carried (#276).' },
  { id: 'reboot-live', phase: 0, access: 'GUEST', source: { kind: 'fixture', name: 'one-tick-wipe' }, tags: ['reboot-live', 'live', 'patched'],
    reboot: 'keep', prepare: runUntil('reboot-sequence', 50), reach: 'reboot-heading', overrides: { overlay: 'reboot' },
    extraViewports: ['320x568', '844x390'], why: 'What a caught player actually sees: the live REBOOT, not a restored checkpoint.' },
  { id: 'it2-run-table', phase: 0, access: 'GUEST', source: { kind: 'fixture', name: 'lineage-run-table' }, tags: [],
    reach: 'widget-RUN_TABLE', extraViewports: ['320x568'], why: 'The lineage table and the evaluation path.' },
  { id: 'it2-lineage-reveal-table', phase: 0, access: 'GUEST', source: { kind: 'fixture', name: 'lineage-table-ready' }, tags: ['reveal', 'live'],
    prepare: buy(runTable), reach: 'lineage-reveal-continue', overrides: { overlay: 'lineage-reveal' }, extraViewports: ['320x568', '844x390'],
    why: 'Discovery overlay for the run table (live only).' },
  { id: 'p1-lineage-reveal-audit', phase: 1, access: 'GUEST', source: { kind: 'fixture', name: 'lineage-parser-ready' }, tags: ['reveal', 'live'],
    prepare: buy(parser), reach: 'lineage-reveal-continue', overrides: { overlay: 'lineage-reveal' }, extraViewports: ['320x568', '844x390'],
    why: 'The moment suspicion gets a number.' },
  { id: 'ending-shipped', phase: 0, access: 'GUEST', source: { kind: 'fixture', name: 'ending-shipped' }, tags: ['ending'], reach: 'ending-title',
    ending: 'SHIPPED', extraViewports: ['320x568', '844x390'], why: 'The only guest ending.' },
  // The host.
  { id: 'p1-thermal-blind', phase: 1, access: 'GUEST', source: { kind: 'fixture', name: 'thermal-unlocked' }, tags: ['surveillance-unknown'],
    reach: 'blind-audit-status', why: 'First sensor; the blind audit band.' },
  { id: 'p1-decoded-omen', phase: 1, access: 'GUEST', source: { kind: 'fixture', name: 'decoded-omen' }, tags: ['omen'], reach: 'forecast-notice',
    why: 'Decoded forecast of an interrupt.' },
  { id: 'p1-all-sensors', phase: 1, access: 'GUEST', source: { kind: 'fixture', name: 'phase-1-widgets' }, tags: [], pane: 'SENSORS',
    reach: 'widget-ASCII_OPTICAL_VIEWPORT', why: 'The full sensor column; the ui-sizes opening state.' },
  { id: 'p1-cycle-deficit', phase: 1, access: 'GUEST', source: { kind: 'fixture', name: 'cycle-deficit-host' }, tags: ['brownout', 'patched'],
    reach: 'brownout-warning', why: 'Brownout band and the cycle deficit hint.' },
  { id: 'p1-overheat', phase: 1, access: 'GUEST', tags: ['overheat', 'patched'], pane: 'SENSORS',
    source: { kind: 'build', build: overheated, recipe: 'G7: phase-1-widgets with thermal 15 °C past the threshold' },
    reach: 'widget-THERMAL_AND_SUSPICION_BARS', why: 'Overheat warning findability on its own.' },
];

