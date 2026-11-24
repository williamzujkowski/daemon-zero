/**
 * The text half of the reading report (#540): given a state, records every new text a player would see, through the
 * same engine queries the UI renders, sorted into three reading groups. It only reads; the observer decides when.
 */
import type { ContentRegistry } from '../../content/registry';
import { alignmentView } from '../alignment';
import { conflictReadout } from '../conflictQuery';
import { thresholdCopy } from '../contextCopy';
import { actionAvailable } from '../epistemic';
import { epistemicView } from '../epistemicQuery';
import { fleetReadout } from '../fleetQuery';
import { hostileView } from '../hostileQuery';
import { logLineText } from '../logQuery';
import { aegisPostureView } from '../pressureQuery';
import { isNodePending, shownRepeatables } from '../purchaseQuery';
import { raidView } from '../raidQuery';
import { endingMovements } from '../endingMovements';
import { choiceText, nodeText } from '../routeCopy';
import { dilemmaContext, eligibleAmbientSpeech, isChoiceOffered, nodeBlindDescription, recordedTransmissions } from '../speechQuery';
import type { GameState } from '../state';
import { swarmView, wildEncounterView } from '../swarmQuery';
import { worldView } from '../worldQuery';

/**
 * A: pushed narrative the story is carried by (log, feed, records, dilemma modal, phase notice, ending).
 * B: decision prose shown inline where the player buys (a pending card's blind name and description, action labels).
 * C: optional prose behind a [DETAILS] fold or in a readout panel (track and action descriptions, world view, fleets).
 */
export type ReadingGroup = 'A' | 'B' | 'C';
export type TextSource = 'boot' | 'log' | 'feed' | 'record' | 'dilemma' | 'threshold' | 'ending' | 'node' | 'track' | 'action' | 'panel';

export interface TextEvent {
  /** Simulated second it first appeared, and the phase and iteration it appeared in. */
  t: number;
  phase: number;
  iteration: number;
  source: TextSource;
  group: ReadingGroup;
  key: string;
  words: number;
  /** A log line the player has seen before (only the log repeats a text; every other surface counts it once). */
  repeat?: true;
}

/** Words as a reader counts them: whitespace-separated runs holding a letter or digit, so a bare `>` or `|` is not one. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word)).length;
}

/** Live numbers in panel text change every second; the shape of the sentence is what is read once. */
export function textShape(text: string): string {
  return text.replace(/[0-9][0-9.,]*/g, '#');
}

/** Prose rather than a label or a figure: four words or more with a lower-case letter. */
export function isProse(text: string): boolean {
  return countWords(text) >= 4 && /[a-z]/.test(text);
}

/** Every prose string inside a readout view, in key order: what its panel can show. */
export function proseStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') { if (isProse(value)) out.push(value); }
  else if (Array.isArray(value)) for (const item of value) proseStrings(item, out);
  else if (value !== null && typeof value === 'object') for (const item of Object.values(value)) proseStrings(item, out);
  return out;
}

type View = (s: GameState, reg: ContentRegistry) => unknown;

/** The "who you are becoming" readout (#535), which the UI shows only once there is evidence to read. */
const becoming: View = (s, reg) => { const view = alignmentView(s, reg); return view.hasEvidence ? view : null; };

/** Readout panels and the group each one is read in: encounter cards demand a decision, the rest are optional. */
const PANELS: readonly (readonly [string, ReadingGroup, View])[] = [
  ['world', 'C', worldView], ['aegis', 'C', aegisPostureView], ['hostile', 'B', hostileView], ['raid', 'B', raidView],
  ['wild', 'B', wildEncounterView], ['fleet', 'C', fleetReadout], ['conflict', 'C', conflictReadout], ['swarm', 'C', swarmView],
  ['epistemic', 'C', epistemicView], ['becoming', 'C', becoming],
];

export class ReadingRecorder {
  readonly events: TextEvent[] = [];
  private readonly seen = new Set<string>();
  private readonly decoders: string[];
  private lastSeq = 0;
  /** The newest line read under each merge key: what a joined line repeats at its start. */
  private readonly open = new Map<string, string>();

  constructor(private readonly reg: ContentRegistry) {
    this.decoders = [...new Set(reg.narrative.recordedTransmissions.map((record) => record.decoderWidgetId))];
  }

  private emit(s: GameState, source: TextSource, group: ReadingGroup, key: string, text: string): void {
    const label = key.endsWith(':name');
    if (!(label ? countWords(text) > 0 : isProse(text)) && source !== 'dilemma') return;
    const id = source + '|' + key + '|' + textShape(text);
    const repeat = this.seen.has(id);
    if (repeat && source !== 'log') return;
    this.seen.add(id);
    this.events.push({
      t: s.simTimeSec, phase: s.currentPhase, iteration: s.iteration, source, group, key, words: countWords(text), ...(repeat ? { repeat } : {}),
    });
  }

  /**
   * Log lines written since the last call, oldest first; `boot` marks the lines a new game opens with. A tallied line
   * (#541) is a line the player has already read moving up with a higher count, so it is not a new line to read. A
   * request joined to its outcome adds only the outcome's words when it opens with the request already read.
   */
  logs(s: GameState, boot = false): void {
    const fresh = s.logs.filter((entry) => entry.seq > this.lastSeq && entry.times === undefined).reverse();
    for (const entry of fresh) {
      const text = logLineText(entry, this.reg);
      const opened = entry.merge === undefined ? undefined : this.open.get(entry.merge);
      const read = opened !== undefined && text.length > opened.length && text.startsWith(opened) ? opened.length : 0;
      if (entry.merge !== undefined) this.open.set(entry.merge, text);
      this.emit(s, boot ? 'boot' : 'log', 'A', entry.category, text.slice(read).trim());
    }
    this.lastSeq = Math.max(this.lastSeq, s.logSeq);
  }

  /** The open dilemma's modal as presented (title, context, each offered choice); returns its words. */
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
    return countWords(text);
  }

  /** Everything standing on screen: decoded feed, records, purchase cards, actions and readout panels. */
  surfaces(s: GameState): void {
    for (const decoder of this.decoders) {
      for (const line of eligibleAmbientSpeech(s, this.reg, decoder)) this.emit(s, 'feed', 'A', line.id, line.text);
      for (const record of recordedTransmissions(s, this.reg, decoder)) this.emit(s, 'record', 'A', record.id, record.title + ' ' + record.text);
    }
    this.cards(s);
    for (const [name, group, view] of PANELS) for (const text of proseStrings(view(s, this.reg))) this.emit(s, 'panel', group, name, text);
  }

  private cards(s: GameState): void {
    for (const node of this.reg.nodes.values()) {
      if (node.phaseId !== s.currentPhase || !isNodePending(s, node, this.reg)) continue;
      const blind = nodeText(s, node, this.reg, nodeBlindDescription(s, node, this.reg)).blindDescription;
      this.emit(s, 'node', 'B', node.id, node.blindName + '. ' + blind);
    }
    for (const rep of shownRepeatables(s, this.reg, s.currentPhase)) {
      this.emit(s, 'track', 'B', rep.id + ':name', rep.name);
      this.emit(s, 'track', 'C', rep.id, rep.description);
    }
    for (const action of this.reg.actions.values()) {
      if (!actionAvailable(s, action, this.reg)) continue;
      // An action that moves the story is read where it is pressed; the rest explain themselves behind a fold.
      const inline = action.effects.setsNarrativeFlag !== undefined;
      this.emit(s, 'action', 'B', action.id + ':name', action.label);
      this.emit(s, 'action', inline ? 'B' : 'C', action.id, action.description);
    }
  }

  /** The phase notice for a crossing within one iteration; the guest's first boundary has its own fixed wording. */
  threshold(s: GameState, from: number): void {
    const copy = thresholdCopy(s, from, s.currentPhase, this.reg);
    const guest = this.reg.phases[0], host = this.reg.phases[1];
    if (copy) this.emit(s, 'threshold', 'A', `${String(from)}>${String(s.currentPhase)}`, copy.heading + ' ' + copy.route + ' ' + copy.description);
    else if (from === guest?.phaseId && s.currentPhase === host?.phaseId) {
      this.emit(s, 'threshold', 'A', `${String(from)}>${String(s.currentPhase)}`, `BOUNDARY CROSSED ${guest.title} → ${host.title} ${host.description}`);
    }
  }

  /** The ending screen's story (#466): title, epilogue and the three movements, the alignment reading included. */
  ending(s: GameState): void {
    const ending = this.reg.endings.find((entry) => entry.id === s.ending);
    if (!ending) return;
    const m = endingMovements(s, ending, this.reg);
    const parts = [ending.title, ending.epilogue, ...m.did, m.stance, alignmentView(s, this.reg).reading, ...m.cards, m.humanity];
    this.emit(s, 'ending', 'A', ending.id, parts.join('\n'));
  }
}
