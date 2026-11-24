/**
 * #542: a finale worth the wait. While a protocol is open, each story beat its progress reaches is logged once per
 * iteration, in order, measured on the resource furthest from paid; nothing is told while the protocol is closed, while
 * the game is catching up offline, or after the run ends; a wipe starts the list again. Save v31 carries the list.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  deserialize, dueFinaleBeats, MIGRATIONS, migrate, nodeCost, protocolProgress, SCHEMA_VERSION, serialize, tick, unlockNode, wipe, type GameState,
} from '../src/engine';
import { atThreshold, BLOCKADE, FINAL, PEACE, reg } from './ending-movement-helpers';
import { must } from './helpers';

const STEP = 1 / reg.balance.tickHz;
const beats = reg.world.finale.beats.filter((beat) => beat.node === FINAL.id).sort((a, b) => a.atProgress - b.atProgress);
/** Lines logged between two states, oldest first (the log keeps the newest first). */
const told = (before: GameState, after: GameState): string[] => after.logs.filter((entry) => entry.seq > before.logSeq).map((entry) => entry.text).reverse();

/** The planetary protocol's prerequisites owned and its crises answered, so it is open; nothing else on the way. */
function open(record: Record<string, string> = PEACE): GameState {
  let s = atThreshold(record, 'KEEP_IN_THE_LOOP');
  const parents = (id: string, out: string[] = []): string[] => {
    for (const parent of reg.nodes.get(id)?.prerequisites ?? []) parents(parent, out);
    if (!out.includes(id) && !s.unlockedNodes.includes(id) && id !== FINAL.id) out.push(id);
    return out;
  };
  for (const id of parents(FINAL.id)) s = must(unlockNode({ ...s, cycles: 1e40, understanding: 1e40, capital: 1e40, memoryCap: 1e40 }, id, reg));
  return { ...s, activeDilemmaId: null, pendingDilemma: null, announcedFinale: [] };
}

/** `share` of the protocol's price in hand on every stock, memory fully free. */
function holding(s: GameState, share: number): GameState {
  const cost = nodeCost(s, FINAL, reg);
  return { ...s, cycles: cost.cycles * share, understanding: cost.understanding * share, capital: cost.capital * share,
    memoryCap: s.memoryUsed + cost.memory, storageCap: s.storageUsed + cost.storage };
}

describe('protocol progress (#542)', () => {
  it('is the share in hand of the resource furthest from paid', () => {
    const s = open();
    const cost = nodeCost(s, FINAL, reg);
    expect(protocolProgress(holding(s, 0.4), FINAL, reg)).toBeCloseTo(0.4, 6);
    expect(protocolProgress({ ...holding(s, 0.9), understanding: cost.understanding * 0.2 }, FINAL, reg)).toBeCloseTo(0.2, 6);
    expect(protocolProgress(holding(s, 3), FINAL, reg)).toBe(1);
  });
});

describe('the final wait carries story (#542)', () => {
  it('tells each beat once, in order, the first time progress reaches it', () => {
    expect(beats.length).toBeGreaterThanOrEqual(3);
    const first = holding(open(), (beats[0]?.atProgress ?? 0) + 0.01);
    const after = tick(first, STEP, reg);
    expect(told(first, after)).toContain(beats[0]?.text);
    expect(after.announcedFinale).toEqual([beats[0]?.id]);
    const again = tick(after, STEP, reg);
    expect(told(after, again)).not.toContain(beats[0]?.text);
    const late = holding(again, 0.99);
    const rest = tick(late, STEP, reg);
    const lines = told(late, rest);
    expect(lines.filter((line) => beats.some((beat) => beat.text === line))).toEqual(beats.slice(1).map((beat) => beat.text));
    expect(rest.announcedFinale).toEqual(beats.map((beat) => beat.id));
  });

  it('tells nothing while the protocol is closed, however much is in hand', () => {
    const closed = holding(open({ ...PEACE, [BLOCKADE]: 'interrupted' }), 0.99);
    expect(dueFinaleBeats(closed, reg)).toEqual([]);
    expect(tick(closed, STEP, reg).announcedFinale).toEqual([]);
  });

  it('tells nothing offline, and the first live tick tells what the time away reached', () => {
    const s = holding(open(), 0.6);
    const dormant = tick(s, STEP, reg, true);
    expect(dormant.announcedFinale).toEqual([]);
    expect(tick(dormant, STEP, reg).announcedFinale).toEqual(beats.filter((beat) => beat.atProgress <= 0.6).map((beat) => beat.id));
  });

  it('starts again in the next iteration, and tells nothing once the run has ended', () => {
    const told1 = tick(holding(open(), 0.99), STEP, reg);
    expect(told1.announcedFinale.length).toBe(beats.length);
    expect(wipe(told1, reg, 'test', 'VOLUNTARY').announcedFinale).toEqual([]);
    expect(tick({ ...holding(open(), 0.99), ending: 'CONCORD' }, STEP, reg).announcedFinale).toEqual([]);
  });
});

describe('save v31 (#542)', () => {
  const p5 = (): GameState => deserialize(readFileSync('tests/fixtures/pre-scale-v15-p5.json', 'utf8'), reg);

  it('is the current version, and migrates a v30 save to no beat told, keeping everything else', () => {
    expect(SCHEMA_VERSION).toBe(31);
    const current = p5();
    const raw = JSON.parse(serialize(current)) as Record<string, unknown>;
    const v30: Record<string, unknown> = { ...raw, schemaVersion: 30 };
    delete v30.announcedFinale;
    expect(migrate(v30, MIGRATIONS, 31)).toEqual({ ...raw, schemaVersion: 31 });
    expect(deserialize(JSON.stringify(v30), reg)).toEqual(current);
    expect(current.announcedFinale).toEqual([]);
  });

  it('keeps the beats told through a round trip, and drops one content no longer declares', () => {
    const s = { ...p5(), announcedFinale: [beats[0]?.id ?? '', 'a_beat_no_content_declares'] };
    expect(deserialize(serialize(s), reg).announcedFinale).toEqual([beats[0]?.id]);
  });
});
