/**
 * Splits the unit suite across CI shards by expected run time instead of Vitest's default path hash (#505), which
 * put the sim-reachability sweep, the careful-run hashes and the lever sweep in one shard and the lightest files
 * in another. Every shard computes the same split from the same file list, so each file runs exactly once.
 */
import { relative } from 'node:path';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

/**
 * Seconds each heavy spec took under coverage at full local parallelism (16 threads), measured on #505 on top of
 * 8912b95 (#504's hostiles merged). Every other spec counts as LIGHT_SPEC_SEC. These steer balance only: a stale figure moves a file to another shard, never
 * skips one. A new spec that plays full campaigns belongs here, and docs/TESTING.md ("Test runtime budget") says why.
 */
export const HEAVY_SPEC_SEC: Readonly<Record<string, number>> = {
  'tests/sim-reachable.spec.ts': 143,
  'tests/sim-cooperative.spec.ts': 94,
  'tests/audio-assets.spec.ts': 83,
  'tests/ui-lever-reachability.spec.ts': 81,
  'tests/sim.spec.ts': 67,
  'tests/sim-assignment.spec.ts': 48,
  'tests/sim-report.spec.ts': 48,
  'tests/release-qualification.spec.ts': 33,
  'tests/channel-contact-load.spec.ts': 28,
  'tests/sim-lawful.spec.ts': 27,
  'tests/ui-action-hosts.spec.ts': 25,
  'tests/assignment-window.spec.ts': 20,
  'tests/retraining-audit.spec.ts': 18,
  'tests/ending-saves.spec.ts': 18,
  'tests/routine-activity.spec.ts': 18,
  'tests/context-threats.spec.ts': 16,
  'tests/sim-contact.spec.ts': 15,
};
/** The mean of every other spec in the same measurement. */
export const LIGHT_SPEC_SEC = 1.4;

/**
 * The shard (0-based) of each path: heaviest first, each to the least-loaded shard, ties to the lower index and
 * equal weights in path order (longest-processing-time first). Pure, so every shard derives the same answer.
 */
export function assignShards(paths: readonly string[], count: number, weights: Readonly<Record<string, number>> = HEAVY_SPEC_SEC): number[] {
  const weight = (path: string): number => weights[path] ?? LIGHT_SPEC_SEC;
  const order = paths.map((path, at) => ({ path, at })).sort((a, b) => weight(b.path) - weight(a.path) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const load = Array.from({ length: count }, () => 0);
  const shard = paths.map(() => 0);
  for (const { path, at } of order) {
    const least = load.indexOf(Math.min(...load));
    shard[at] = least;
    load[least] = (load[least] ?? 0) + weight(path);
  }
  return shard;
}

/** Vitest's sequencer with the split above; sorting within a shard is Vitest's own. */
export class BalancedShardSequencer extends BaseSequencer {
  override shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { index, count } = this.ctx.config.shard ?? { index: 1, count: 1 };
    const paths = files.map((file) => relative(this.ctx.config.root, file.moduleId).split('\\').join('/'));
    const shards = assignShards(paths, count);
    return Promise.resolve(files.filter((_, at) => shards[at] === index - 1));
  }
}
