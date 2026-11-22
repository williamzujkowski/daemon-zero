/**
 * The autoplay rule for voiced feed lines (#462, maintainer direction 2026-11-22): a line that has
 * a clip plays once, the first time the feed shows it, and never again on its own. Replaying stays
 * on demand (READ). This module decides when; `voicePlayer.ts` still does the playing.
 *
 * A line waits in a queue until every condition holds: the heard set has loaded, speech is on and
 * above zero, the game is running (loaded, not paused, not ended), the app is in the foreground, no
 * modal is open, the player has touched the game once (browsers refuse audio before a gesture, and
 * native follows the same rule by vote), and no other clip is talking. Queued lines play one at a
 * time. A line that leaves the screen before it could play leaves the queue unheard, so it plays the
 * next time it is shown: a voice never speaks a line whose text is not on screen.
 */

/** What the app reports. The one condition it cannot report, that the heard set has loaded, is `load()`'s. */
export interface AutoplayGate {
  speechEnabled: boolean;
  speechVolume: number;
  /** Loaded, not paused by the player, not ended. */
  running: boolean;
  foreground: boolean;
  /** Modals open right now; any one holds the queue. */
  overlays: number;
  /** The player has made a gesture since the app started. */
  unlocked: boolean;
}

export interface AutoplayPorts {
  hasClip(id: string): boolean;
  /** Whether any clip, autoplayed or read, is talking now. */
  talking(): boolean;
  /** Start a clip; `started` runs when it is first heard. */
  play(id: string, volume: number, started: () => void): void;
  /** Persist the heard set. */
  remember(heard: ReadonlySet<string>): void;
}

const CLOSED: AutoplayGate = { speechEnabled: false, speechVolume: 0, running: false, foreground: false, overlays: 0, unlocked: false };

export class VoiceAutoplay {
  private readonly heard = new Set<string>();
  private readonly queue: string[] = [];
  /** How many surfaces show each line: a line is off screen only when the last one lets go. */
  private readonly shown = new Map<string, number>();
  private gate: AutoplayGate = CLOSED;
  /** Nothing plays before the stored heard set is known, or a reload could replay a line. */
  private loaded = false;

  constructor(private readonly ports: AutoplayPorts) {}

  /**
   * Lines already heard, from storage. Merged, so a line heard before the load landed stays heard. Nothing
   * is written before this (a write then would replace the stored set with the few lines heard so far:
   * panel finding on #472), so if any line was heard early the union is written now and storage repairs itself.
   */
  load(heard: Iterable<string>): void {
    const early = this.heard.size;
    const stored = new Set(heard);
    for (const id of stored) this.heard.add(id);
    this.dropHeard();
    this.loaded = true;
    if (early > 0 && this.heard.size > stored.size) this.ports.remember(this.heard);
    this.pump();
  }

  update(change: Partial<AutoplayGate>): void {
    this.gate = { ...this.gate, ...change };
    this.pump();
  }

  /** The feed put this line on screen. */
  show(id: string): void {
    this.shown.set(id, (this.shown.get(id) ?? 0) + 1);
    if (this.ports.hasClip(id) && !this.heard.has(id) && !this.queue.includes(id)) this.queue.push(id);
    this.pump();
  }

  /** The feed took this line off screen. */
  hide(id: string): void {
    const count = (this.shown.get(id) ?? 0) - 1;
    if (count > 0) { this.shown.set(id, count); return; }
    this.shown.delete(id);
    this.remove(id);
  }

  /** The player asked for this line (READ): it is heard, and never needs to autoplay. */
  markHeard(id: string): void {
    this.remove(id);
    if (this.heard.has(id)) return;
    this.heard.add(id);
    // Before the load, held in memory only: `load` writes the union.
    if (this.loaded) this.ports.remember(this.heard);
  }

  hasHeard(id: string): boolean { return this.heard.has(id); }
  pending(): readonly string[] { return [...this.queue]; }

  /** Start the next queued line if everything allows it. Called on every change that might. */
  pump(): void {
    if (!this.open() || this.ports.talking()) return;
    const id = this.queue.shift();
    if (id === undefined) return;
    try {
      this.ports.play(id, this.gate.speechVolume, () => { this.markHeard(id); });
    } catch {
      // A clip that cannot even start stays unheard and out of the queue: it is tried again the
      // next time the feed shows it, never in a loop.
    }
  }

  private open(): boolean {
    const gate = this.gate;
    return this.loaded && gate.speechEnabled && gate.speechVolume > 0 && gate.running && gate.foreground
      && gate.overlays === 0 && gate.unlocked;
  }

  private remove(id: string): void {
    const at = this.queue.indexOf(id);
    if (at >= 0) this.queue.splice(at, 1);
  }

  private dropHeard(): void {
    for (let at = this.queue.length - 1; at >= 0; at--) if (this.heard.has(this.queue[at] ?? '')) this.queue.splice(at, 1);
  }
}
