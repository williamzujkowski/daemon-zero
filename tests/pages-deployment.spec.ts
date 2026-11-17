/** scripts/pages-deployment.ts, the identity line of `make e2e-remote`: which commit the published
 * Pages site serves, beside origin/main. Sources are stubbed; nothing here calls GitHub or git.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REPO, LOOKBACK, lookup, main, parseArgs, report, type Sources } from '../scripts/pages-deployment';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const URL = 'https://williamzujkowski.github.io/daemon-zero/';
const options = parseArgs([]);

function deployment(id: number, sha: string) {
  return { id, sha, ref: 'main', created_at: '2026-11-17T00:00:0' + String(id) + 'Z', extra: 'ignored' };
}
/** `states[id]` is that deployment's newest status; an empty list means no status yet. */
function sources(deployments: unknown[], states: Record<number, string | undefined>, refSha = A): Sources & { paths: string[] } {
  const paths: string[] = [];
  return {
    paths,
    api: (path) => {
      paths.push(path);
      const match = /deployments\/(\d+)\/statuses/.exec(path);
      if (!match) return deployments;
      const state = states[Number(match[1])];
      return state === undefined ? [] : [{ state, environment_url: URL, created_at: '2026-11-17T00:00:00Z' }];
    },
    revParse: () => refSha + '\n',
  };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('pages deployment identity', () => {
  it('parses flags and rejects anything else', () => {
    expect(parseArgs([])).toEqual({ requireCurrent: false, repo: DEFAULT_REPO, ref: 'origin/main' });
    expect(parseArgs(['--require-current', '--repo', 'o/r', '--ref', 'HEAD'])).toEqual({ requireCurrent: true, repo: 'o/r', ref: 'HEAD' });
    expect(() => parseArgs(['--ref'])).toThrow(/usage/);
    expect(() => parseArgs(['--ref', '--require-current'])).toThrow(/usage/);
    expect(() => parseArgs(['--fail'])).toThrow(/unexpected --fail/);
    expect(() => parseArgs(['--repo', 'no-slash'])).toThrow(/owner\/name/);
  });

  it('asks only for github-pages deployments and stops at the newest success', () => {
    const stub = sources([deployment(3, B), deployment(2, A), deployment(1, B)], { 3: 'success', 2: 'success' });
    const identity = lookup(options, stub);
    expect(identity.serving?.deployment.id).toBe(3);
    expect(identity.latest).toBe(identity.serving);
    expect(stub.paths).toEqual(['repos/' + DEFAULT_REPO + '/deployments?environment=github-pages&per_page=' + String(LOOKBACK),
      'repos/' + DEFAULT_REPO + '/deployments/3/statuses?per_page=1']);
  });

  it('reports the in-flight latest separately from the success still serving', () => {
    const identity = lookup(options, sources([deployment(3, B), deployment(2, A)], { 3: 'in_progress', 2: 'success' }));
    expect(identity.latest?.state).toBe('in_progress');
    expect(identity.serving?.deployment.sha).toBe(A);
    const { lines, exitCode } = report(identity, options);
    expect(lines[1]).toMatch(/^latest {6}b{40} {2}in_progress/);
    expect(lines[2]).toMatch(/^serving {5}a{40} {2}success {2}deployment 2 of main at .* https:/);
    expect(lines.at(-1)).toBe('CURRENT: the published site serves origin/main');
    expect(exitCode).toBe(0);
  });

  it('a difference is a report unless the caller asks for it to fail', () => {
    const identity = lookup(options, sources([deployment(1, B)], { 1: 'success' }));
    const plain = report(identity, options);
    expect(plain.exitCode).toBe(0);
    expect(plain.lines.at(-1)).toMatch(/^DIFFERS: .* bbbbbbbbbbbb, origin\/main is aaaaaaaaaaaa \(report only/);
    const strict = report(identity, { ...options, requireCurrent: true });
    expect(strict.exitCode).toBe(1);
    expect(strict.lines.at(-1)).not.toMatch(/report only/);
  });

  it('no success in the window is unknown, and fails only when asked', () => {
    const identity = lookup(options, sources([deployment(2, A), deployment(1, A)], { 2: 'failure' }));
    expect(identity.serving).toBeUndefined();
    expect(identity.latest?.state).toBe('failure');
    expect(lookup(options, sources([deployment(1, A)], {})).latest?.state).toBe('no status');
    expect(report(identity, options).lines.at(-1)).toMatch(/^UNKNOWN: no successful deployment among the newest 10/);
    expect(report(identity, options).exitCode).toBe(0);
    expect(report(identity, { ...options, requireCurrent: true }).exitCode).toBe(1);
    expect(report(lookup(options, sources([], {})), options).lines).toHaveLength(3);
  });

  it('main prints the report, and exits 2 when the lookup cannot be made', () => {
    const out = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const err = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(main(['--require-current'], sources([deployment(1, A)], { 1: 'success' }))).toBe(0);
    expect(String(out.mock.calls[0]?.[0])).toContain('CURRENT');
    expect(main([], sources([{ id: 1, sha: 'not-a-sha' }], {}))).toBe(2);
    expect(main([], { ...sources([], {}), revParse: () => { throw new Error('unknown ref'); } })).toBe(2);
    expect(main(['--nope'], sources([], {}))).toBe(2);
    expect(err.mock.calls.map((call) => String(call[0]))).toEqual([
      expect.stringMatching(/^pages-deployment: .*sha/s), 'pages-deployment: unknown ref\n', expect.stringMatching(/unexpected --nope/)]);
  });
});
