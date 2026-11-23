/** The CI shard split (#505): every spec runs in exactly one shard, and the heavy ones spread out. */
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assignShards, HEAVY_SPEC_SEC, LIGHT_SPEC_SEC } from './shard-balance.mjs';

const SPECS = readdirSync('tests').filter((file) => file.endsWith('.spec.ts')).map((file) => 'tests/' + file).sort();
const load = (paths: readonly string[], shards: readonly number[], shard: number) =>
  paths.reduce((sum, path, at) => sum + (shards[at] === shard ? HEAVY_SPEC_SEC[path] ?? LIGHT_SPEC_SEC : 0), 0);

describe('assignShards', () => {
  it('names only specs that exist, so a renamed heavy spec cannot silently fall back to the light weight', () => {
    for (const path of Object.keys(HEAVY_SPEC_SEC)) expect(SPECS, path).toContain(path);
  });

  it('puts every spec in exactly one of the three CI shards, whatever order the files arrive in', () => {
    const shards = assignShards(SPECS, 3);
    expect(shards.every((shard) => shard >= 0 && shard < 3)).toBe(true);
    const reversed = [...SPECS].reverse();
    const again = assignShards(reversed, 3);
    expect(reversed.map((path, at) => [path, again[at]]).sort()).toEqual(SPECS.map((path, at) => [path, shards[at]]).sort());
  });

  it('keeps each shard within the heaviest spec of the even share, and splits the heaviest three apart', () => {
    const shards = assignShards(SPECS, 3);
    const total = [0, 1, 2].map((shard) => load(SPECS, shards, shard));
    const heaviest = Math.max(...Object.values(HEAVY_SPEC_SEC));
    const even = total.reduce((sum, value) => sum + value, 0) / 3;
    for (const value of total) expect(Math.abs(value - even)).toBeLessThan(heaviest);
    const top = Object.entries(HEAVY_SPEC_SEC).sort(([, a], [, b]) => b - a).slice(0, 3).map(([path]) => shards[SPECS.indexOf(path)]);
    expect(new Set(top).size).toBe(3);
  });

  it('is longest-first to the least-loaded shard, ties to the lower shard and equal weights in path order', () => {
    const weights = { a: 5, b: 4, c: 3, d: 3 };
    expect(assignShards(['d', 'c', 'b', 'a'], 2, weights)).toEqual([0, 1, 1, 0]);
    expect(assignShards(['x', 'y', 'z'], 3, {})).toEqual([0, 1, 2]);
    expect(assignShards(['x', 'y'], 1, {})).toEqual([0, 0]);
  });
});
