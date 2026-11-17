/**
 * Prints which commit the published GitHub Pages site serves - the newest `github-pages`
 * deployment whose latest status is `success` - beside `origin/main`, as `make e2e-remote` reports.
 * Read-only: GET requests through `gh api` and one `git rev-parse`. Differing only fails with
 * `--require-current`; a lookup that cannot be made always fails (exit 2).
 */
import { execFileSync } from 'node:child_process';
import { z } from 'zod';

export const DEFAULT_REPO = 'williamzujkowski/daemon-zero';
export const ENVIRONMENT = 'github-pages';
/** A failed or in-flight deploy leaves the previous success serving; look back this far for it. */
export const LOOKBACK = 10;

const Sha = z.string().regex(/^[0-9a-f]{40}$/);
const Deployment = z.object({ id: z.number().int().positive(), sha: Sha, ref: z.string(), created_at: z.string() });
const Status = z.object({ state: z.string(), environment_url: z.string().optional(), created_at: z.string() });
export type Deployment = z.infer<typeof Deployment>;

export interface Options { requireCurrent: boolean; repo: string; ref: string }
export interface Observed { deployment: Deployment; state: string; url: string | undefined }
export interface Identity { latest: Observed | undefined; serving: Observed | undefined; refSha: string }
/** `gh api <path>` parsed as JSON, and `git rev-parse <ref>`; injected so tests need no network. */
export interface Sources { api: (path: string) => unknown; revParse: (ref: string) => string }

const USAGE = 'usage: pages-deployment.ts [--require-current] [--repo owner/name] [--ref git-ref]';

export function parseArgs(argv: readonly string[]): Options {
  const options: Options = { requireCurrent: false, repo: DEFAULT_REPO, ref: 'origin/main' };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--require-current') options.requireCurrent = true;
    else if ((arg === '--repo' || arg === '--ref') && value !== undefined && !value.startsWith('--')) {
      if (arg === '--repo') options.repo = value; else options.ref = value;
      index++;
    } else throw new Error(USAGE + (arg === undefined ? '' : ' (unexpected ' + arg + ')'));
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(options.repo)) throw new Error('--repo must be owner/name, got ' + options.repo);
  return options;
}

/** Walks deployments newest first and stops at the first whose latest status is a success. */
export function lookup(options: Options, sources: Sources): Identity {
  const listPath = 'repos/' + options.repo + '/deployments?environment=' + ENVIRONMENT + '&per_page=' + String(LOOKBACK);
  const deployments = z.array(Deployment).parse(sources.api(listPath));
  const refSha = Sha.parse(sources.revParse(options.ref).trim());
  let latest: Observed | undefined;
  for (const deployment of deployments) {
    const statuses = z.array(Status).parse(sources.api('repos/' + options.repo + '/deployments/' + String(deployment.id) + '/statuses?per_page=1'));
    const status = statuses[0];
    const observed: Observed = { deployment, state: status?.state ?? 'no status', url: status?.environment_url };
    latest ??= observed;
    if (observed.state === 'success') return { latest, serving: observed, refSha };
  }
  return { latest, serving: undefined, refSha };
}

const column = (label: string) => label.padEnd(11) + ' ';

function line(label: string, observed: Observed): string {
  const { deployment } = observed;
  return column(label) + deployment.sha + '  ' + observed.state + '  deployment ' + String(deployment.id)
    + ' of ' + deployment.ref + ' at ' + deployment.created_at + (observed.url ? '  ' + observed.url : '');
}

/** The printed report and the exit code it implies. */
export function report(identity: Identity, options: Options): { lines: string[]; exitCode: number } {
  const lines = ['Pages deployment identity (' + options.repo + ', environment ' + ENVIRONMENT + ')'];
  const { latest, serving, refSha } = identity;
  if (latest && latest !== serving) lines.push(line('latest', latest));
  if (serving) lines.push(line('serving', serving));
  lines.push(column(options.ref) + refSha + '  (as last fetched; run git fetch first for a current answer)');
  let verdict: string;
  let current = false;
  if (!serving) verdict = 'UNKNOWN: no successful deployment among the newest ' + String(LOOKBACK);
  else if (serving.deployment.sha === refSha) { verdict = 'CURRENT: the published site serves ' + options.ref; current = true; }
  else verdict = 'DIFFERS: the published site serves ' + serving.deployment.sha.slice(0, 12) + ', ' + options.ref + ' is ' + refSha.slice(0, 12);
  lines.push(verdict + (current || options.requireCurrent ? '' : ' (report only; pass --require-current to fail on this)'));
  return { lines, exitCode: !current && options.requireCurrent ? 1 : 0 };
}

const ghSources: Sources = {
  api: (path) => JSON.parse(execFileSync('gh', ['api', '-H', 'Accept: application/vnd.github+json', path], { encoding: 'utf8' })) as unknown,
  revParse: (ref) => execFileSync('git', ['rev-parse', '--verify', '--quiet', ref + '^{commit}'], { encoding: 'utf8' }),
};

export function main(argv: readonly string[], sources: Sources = ghSources): number {
  try {
    const options = parseArgs(argv);
    const { lines, exitCode } = report(lookup(options, sources), options);
    process.stdout.write(lines.join('\n') + '\n');
    return exitCode;
  } catch (error) {
    process.stderr.write('pages-deployment: ' + (error instanceof Error ? error.message : String(error)) + '\n');
    return 2;
  }
}

if (process.argv[1]?.endsWith('pages-deployment.ts')) process.exitCode = main(process.argv.slice(2));
