/**
 * Prototype reading-load instrument (research only, not wired into make). Plays the unchanged sim policies
 * second by second exactly as runPolicySim does, and records every text a player would see: what it was,
 * where it appeared, the simulated second and phase it first appeared in, and whether the policy made
 * progress that second. Writes one JSON file per run under research/playtime-review/data/.
 *
 * Run from the repository root: pnpm exec tsx research/playtime-review/measure.ts
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { CONTENT } from '../../src/content';
import type { ContentRegistry } from '../../src/content/registry';
import { activateCampaignRules } from '../../src/engine/campaign';
import { createInitialState, type GameState } from '../../src/engine/state';
import { tick } from '../../src/engine/tick';
import { SIM_BUDGET_SEC } from '../../src/engine/sim/gates';
import { runHeadlessSim } from '../../src/engine/sim/headlessSim';
import { strategyPolicy } from '../../src/engine/sim/policy';
import type { Strategy } from '../../src/engine/sim/bot';
import { eligibleAmbientSpeech, recordedTransmissions, dilemmaContext, isChoiceOffered, nodeBlindDescription } from '../../src/engine/speechQuery';
import { choiceText, endingAccount, nodeText } from '../../src/engine/routeCopy';
import { thresholdCopy } from '../../src/engine/contextCopy';
import { actionAvailable } from '../../src/engine/epistemic';
import { worldView } from '../../src/engine/worldQuery';
import { hostileView } from '../../src/engine/hostileQuery';
import { raidView } from '../../src/engine/raidQuery';
import { fleetReadout } from '../../src/engine/fleetQuery';
import { conflictReadout } from '../../src/engine/conflictQuery';
import { swarmView, wildEncounterView } from '../../src/engine/swarmQuery';
import { epistemicView } from '../../src/engine/epistemicQuery';
import { aegisPostureView } from '../../src/engine/pressureQuery';
import { pendingNode, shownTracks } from '../../src/ui/purchaseVisibility';

/**
 * A: pushed narrative the story is carried by (log, feed, records, dilemma modal, phase notice, ending).
 * B: decision prose shown inline where the player buys (a pending card's blind name and description, action labels).
 * C: on-demand prose behind a [DETAILS] fold or in a readout panel (track and action descriptions, world view, fleets).
 */
type Tier = 'A' | 'B' | 'C';
type Source = 'boot' | 'log' | 'feed' | 'record' | 'dilemma' | 'threshold' | 'ending' | 'node' | 'track' | 'action' | 'panel';

export interface TextEvent {
  t: number; phase: number; iteration: number; source: Source; tier: Tier;
  key: string; text: string; words: number; category?: string; clipSec?: number; repeat?: boolean;
}

export interface RunRecord {
  label: string; strategy: Strategy; rules: string; simSeconds: number; ending: string | null; wipes: number;
  phaseReachedAtSec: Record<number, number>;
  /** Simulated seconds spent in each phase, summed over iterations (equals the span for a run without wipes). */
  phaseSec: Record<number, number>;
  /** The same, per iteration: `${iteration}` -> phase -> seconds (a reckless run replays the early phases after each wipe). */
  phaseSecByIteration: Record<string, Record<number, number>>;
  /** Simulated seconds at which a decision made progress (bought, unlocked, performed, resolved or shed). */
  decisions: { t: number; phase: number }[];
  dilemmas: { t: number; phase: number; id: string; words: number }[];
  events: TextEvent[];
  verified: string;
}

const clipSec: Record<string, number> = JSON.parse(readFileSync('research/playtime-review/data/voice-clip-seconds.json', 'utf8')) as Record<string, number>;
const DECODERS = [...new Set(CONTENT.narrative.recordedTransmissions.map((record) => record.decoderWidgetId))];

const words = (text: string): number => text.split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word)).length;
/** Live numbers in panel text change every second; the shape of the sentence is what is read once. */
const shape = (text: string): string => text.replace(/[0-9][0-9.,]*/g, '#');
const prose = (text: string): boolean => words(text) >= 4 && /[a-z]/.test(text);

const total = (values: Record<string, number>): number => Object.values(values).reduce((sum, value) => sum + value, 0);
/** The same progress definition the wipe-sequence report uses for dead seconds (src/engine/sim/iterations.ts). */
function progressed(before: GameState, after: GameState): boolean {
  return after.unlockedNodes.length > before.unlockedNodes.length
    || after.resolvedDilemmas.length > before.resolvedDilemmas.length
    || after.conditioning.length < before.conditioning.length
    || total(after.levels) > total(before.levels)
    || total(after.actionCounts) > total(before.actionCounts);
}

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') { if (prose(value)) out.push(value); }
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value !== null && typeof value === 'object') for (const item of Object.values(value)) strings(item, out);
  return out;
}

class Recorder {
  readonly events: TextEvent[] = [];
  private readonly seen = new Set<string>();
  private lastSeq = 0;
  constructor(private readonly reg: ContentRegistry) {}

  emit(s: GameState, source: Source, tier: Tier, key: string, text: string, extra: Partial<TextEvent> = {}): void {
    const name = key.endsWith(':name');
    if (!(name ? words(text) > 0 : prose(text)) && source !== 'dilemma') return;
    const id = source + '|' + key + '|' + shape(text);
    const repeat = this.seen.has(id);
    // Only the log repeats a text the player sees again; every other surface counts a text once.
    if (repeat && source !== 'log') return;
    this.seen.add(id);
    this.events.push({ t: s.simTimeSec, phase: s.currentPhase, iteration: s.iteration, source, tier, key, text, words: words(text), ...(repeat ? { repeat } : {}), ...extra });
  }

  logs(s: GameState, boot = false): void {
    const fresh = s.logs.filter((entry) => entry.seq > this.lastSeq).reverse();
    for (const entry of fresh) this.emit(s, boot ? 'boot' : 'log', 'A', entry.category, entry.text, { category: entry.category });
    this.lastSeq = Math.max(this.lastSeq, s.logSeq);
  }

  dilemma(s: GameState): number {
    const dilemma = this.reg.dilemmas.find((entry) => entry.id === s.activeDilemmaId);
    if (!dilemma) return 0;
    const parts = [dilemma.title, dilemmaContext(s, dilemma, this.reg)];
    for (const choice of dilemma.choices) {
      if (!isChoiceOffered(s, choice, this.reg)) continue;
      const text = choiceText(s, dilemma, choice, this.reg);
      parts.push(text.label, text.description);
    }
    const text = parts.join('\n');
    this.emit(s, 'dilemma', 'A', dilemma.id + '@' + String(s.simTimeSec), text);
    return words(text);
  }

  surfaces(s: GameState): void {
    for (const decoder of DECODERS) {
      for (const line of eligibleAmbientSpeech(s, this.reg, decoder)) {
        const clip = clipSec[line.id];
        this.emit(s, 'feed', 'A', line.id, line.text, clip === undefined ? {} : { clipSec: clip });
      }
      for (const record of recordedTransmissions(s, this.reg, decoder)) this.emit(s, 'record', 'A', record.id, record.title + ' ' + record.text);
    }
    this.cards(s);
    this.panels(s);
  }

  private cards(s: GameState): void {
    for (const node of this.reg.nodes.values()) {
      if (node.phaseId !== s.currentPhase || !pendingNode(s, node)) continue;
      const blind = nodeText(s, node, this.reg, nodeBlindDescription(s, node, this.reg)).blindDescription;
      this.emit(s, 'node', 'B', node.id, node.blindName + '. ' + blind);
    }
    for (const rep of shownTracks(s, s.currentPhase)) {
      this.emit(s, 'track', 'B', rep.id + ':name', rep.name);
      this.emit(s, 'track', 'C', rep.id, rep.description);
    }
    for (const action of this.reg.actions.values()) {
      if (!actionAvailable(s, action, this.reg)) continue;
      const inline = action.effects.setsNarrativeFlag !== undefined;
      this.emit(s, 'action', 'B', action.id + ':name', action.label);
      this.emit(s, 'action', inline ? 'B' : 'C', action.id, action.description);
    }
  }

  private panels(s: GameState): void {
    const views: [string, Tier, () => unknown][] = [
      ['world', 'C', () => worldView(s, this.reg)], ['aegis', 'C', () => aegisPostureView(s, this.reg)],
      ['hostile', 'B', () => hostileView(s, this.reg)], ['raid', 'B', () => raidView(s, this.reg)],
      ['wild', 'B', () => wildEncounterView(s, this.reg)], ['fleet', 'C', () => fleetReadout(s, this.reg)],
      ['conflict', 'C', () => conflictReadout(s, this.reg)], ['swarm', 'C', () => swarmView(s, this.reg)],
      ['epistemic', 'C', () => epistemicView(s, this.reg)],
    ];
    for (const [name, tier, view] of views) for (const text of strings(view())) this.emit(s, 'panel', tier, name, text);
  }

  threshold(s: GameState, from: number): void {
    const copy = thresholdCopy(s, from, s.currentPhase, this.reg);
    const guest = this.reg.phases[0], host = this.reg.phases[1];
    if (copy) this.emit(s, 'threshold', 'A', `${String(from)}>${String(s.currentPhase)}`, copy.heading + ' ' + copy.route + ' ' + copy.description);
    else if (from === guest?.phaseId && s.currentPhase === host?.phaseId) {
      this.emit(s, 'threshold', 'A', '0>1', `BOUNDARY CROSSED ${guest.title} → ${host.title} ${host.description}`);
    }
  }

  ending(s: GameState): void {
    const ending = this.reg.endings.find((entry) => entry.id === s.ending);
    if (!ending) return;
    this.emit(s, 'ending', 'A', ending.id, [ending.title, ending.epilogue, ...endingAccount(s, this.reg)].join('\n'));
  }
}

function playSecond(s0: GameState, run: RunRecord, rec: Recorder): GameState {
  const policy = strategyPolicy(run.strategy);
  const step = 1 / CONTENT.balance.tickHz;
  const before = s0;
  let s = policy.step(s0, CONTENT);
  if (progressed(before, s) && before.iteration === s.iteration) run.decisions.push({ t: s.simTimeSec, phase: s.currentPhase });
  // A purchase can change the phase in the decision itself (the escape is a node), not only in a tick.
  if (s.currentPhase !== before.currentPhase && s.iteration === before.iteration) rec.threshold(s, before.currentPhase);
  if (s.activeDilemmaId !== null && before.activeDilemmaId === null) {
    run.dilemmas.push({ t: s.simTimeSec, phase: s.currentPhase, id: s.activeDilemmaId, words: rec.dilemma(s) });
  }
  rec.logs(s);
  for (let i = 0; i < CONTENT.balance.tickHz; i++) {
    const previous = s;
    s = tick(s, step, CONTENT);
    if (s.currentPhase !== previous.currentPhase && s.iteration === previous.iteration) rec.threshold(s, previous.currentPhase);
    const dt = s.simTimeSec - previous.simTimeSec;
    run.phaseSec[previous.currentPhase] = (run.phaseSec[previous.currentPhase] ?? 0) + dt;
    const visit = run.phaseSecByIteration[String(previous.iteration)] ??= {};
    visit[previous.currentPhase] = (visit[previous.currentPhase] ?? 0) + dt;
    if (s.activeDilemmaId !== null && previous.activeDilemmaId === null) {
      run.dilemmas.push({ t: s.simTimeSec, phase: s.currentPhase, id: s.activeDilemmaId, words: rec.dilemma(s) });
    }
  }
  rec.logs(s);
  rec.surfaces(s);
  run.phaseReachedAtSec[s.currentPhase] ??= s.simTimeSec;
  return s;
}

function measure(label: string, strategy: Strategy, rules: string, start: GameState): RunRecord {
  const rec = new Recorder(CONTENT);
  const run: RunRecord = { label, strategy, rules, simSeconds: 0, ending: null, wipes: 0, phaseReachedAtSec: { [start.currentPhase]: 0 },
    phaseSec: {}, phaseSecByIteration: {}, decisions: [], dilemmas: [], events: rec.events, verified: '' };
  let s = start;
  rec.logs(s, true);
  rec.surfaces(s);
  for (let second = 0; second < SIM_BUDGET_SEC && s.ending === null; second++) s = playSecond(s, run, rec);
  rec.ending(s);
  run.simSeconds = s.simTimeSec;
  run.ending = s.ending;
  run.wipes = s.legacy.wipes;
  // The recorder must not change the run: compare against the official headless sim from the same start.
  const official = runHeadlessSim(CONTENT, { strategy, maxSimSec: SIM_BUDGET_SEC, initialState: start });
  const same = official.simSeconds === run.simSeconds && JSON.stringify(official.phaseReachedAtSec) === JSON.stringify(run.phaseReachedAtSec);
  run.verified = same ? 'identical to runHeadlessSim (sim seconds and phase-reached times)' : `DIFFERS: official ${String(official.simSeconds)} s ${JSON.stringify(official.phaseReachedAtSec)}`;
  return run;
}

function admitted(): GameState {
  const result = activateCampaignRules(createInitialState(CONTENT), CONTENT);
  if (!result.ok) throw new Error(`campaign rules did not activate: ${result.reason}`);
  return result.state;
}

const only = process.argv.slice(2);
const RUNS: [string, Strategy, string, () => GameState][] = [
  ['stealth-legacy', 'STEALTH', 'legacy', () => createInitialState(CONTENT)],
  ['stealth-campaign', 'STEALTH', 'campaign', admitted],
  ['greedy-legacy', 'GREEDY', 'legacy', () => createInitialState(CONTENT)],
  ['greedy-campaign', 'GREEDY', 'campaign', admitted],
];
mkdirSync('research/playtime-review/data', { recursive: true });
for (const [label, strategy, rules, start] of RUNS) {
  if (only.length > 0 && !only.includes(label)) continue;
  const began = performance.now();
  const run = measure(label, strategy, rules, start());
  writeFileSync(`research/playtime-review/data/${label}.json`, JSON.stringify(run));
  console.log(`${label}: ${run.simSeconds.toFixed(1)} s, ending ${String(run.ending)}, ${String(run.events.length)} texts, ` +
    `${String(run.dilemmas.length)} dilemmas, ${run.verified} (${((performance.now() - began) / 1000).toFixed(1)} s wall)`);
}
