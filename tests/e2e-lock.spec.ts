/** scripts/e2e-lock.sh, the lock inside `make e2e`, `e2e-pages` and `e2e-live`: it must
 * exclude a second suite, and it must not wait on itself when a caller already wrapped the
 * make target in `flock` on the same file. Runs against a scratch lock, never the real one.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const script = join(__dirname, '..', 'scripts', 'e2e-lock.sh');
const dir = mkdtempSync(join(tmpdir(), 'daemon-zero-e2e-lock-'));
const lock = join(dir, 'e2e.lock');
const env = { ...process.env, DAEMON_E2E_LOCK: lock };
// A deadlock shows up as this timeout killing the child (status null), never as a hung run.
const DEADLOCK_MS = 5000;
const hasFlock = spawnSync('flock', ['--version']).status === 0;
const spawned: ChildProcess[] = [];

function run(command: string, args: string[]) {
  return spawnSync(command, args, { env, encoding: 'utf8', timeout: DEADLOCK_MS });
}

/** A process that takes the lock through `command`, says so, and holds it until released. */
async function hold(command: string, args: string[]): Promise<{ release: () => Promise<unknown> }> {
  const holder = spawn(command, [...args, 'bash', '-c', 'echo held; read -r _'], { env, stdio: ['pipe', 'pipe', 'inherit'] });
  spawned.push(holder);
  await new Promise((resolve) => { holder.stdout.once('data', resolve); });
  return { release: () => {
    const closed = new Promise((resolve) => { holder.once('close', resolve); });
    holder.stdin.end();
    return closed;
  } };
}

afterAll(() => {
  for (const child of spawned) child.kill('SIGKILL');
  rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!hasFlock)('e2e lock', () => {
  it('runs the command and returns its exit status when nobody holds the lock', () => {
    const ok = run('bash', [script, 'echo', 'ran']);
    expect(ok.status).toBe(0);
    expect(ok.stdout.trim()).toBe('ran');
    expect(run('bash', [script, 'bash', '-c', 'exit 7']).status).toBe(7);
    expect(run('bash', [script]).status).toBe(2);
  });

  it('does not deadlock under a caller that already holds the lock with flock', () => {
    // `flock <lock> flock <lock> cmd` is the hang this avoids; it is not run here as a
    // control because the inner flock inherits the outer lock and outlives any timeout.
    const wrapped = run('flock', [lock, 'bash', script, 'echo', 'ran']);
    expect(wrapped.status, 'null means it was killed while waiting on its own caller').toBe(0);
    expect(wrapped.stdout.trim()).toBe('ran');
    // make e2e then make e2e-pages inside one wrapper, or a recipe that calls make again.
    const nested = run('flock', [lock, 'bash', script, 'bash', script, 'echo', 'nested']);
    expect(nested.status).toBe(0);
    expect(nested.stdout.trim()).toBe('nested');
  });

  it('holds the lock for as long as the command runs, bare or wrapped', async () => {
    for (const [command, args] of [['bash', [script]], ['flock', [lock, 'bash', script]]] as const) {
      const holder = await hold(command, [...args]);
      expect(run('flock', ['--nonblock', lock, 'true']).status, `${command} excludes a second caller`).toBe(1);
      await holder.release();
      expect(run('flock', ['--nonblock', lock, 'true']).status, `${command} releases on exit`).toBe(0);
    }
  });

  it('waits for a foreign holder instead of running beside it', async () => {
    const holder = await hold('flock', [lock]);
    const waiter = spawn('bash', [script, 'echo', 'ran'], { env });
    spawned.push(waiter);
    let out = '';
    let notice = '';
    waiter.stdout.on('data', (chunk: Buffer) => { out += chunk.toString(); });
    waiter.stderr.on('data', (chunk: Buffer) => { notice += chunk.toString(); });
    await new Promise((resolve) => { waiter.stderr.once('data', resolve); });
    expect(notice).toContain('waiting for');
    expect(out).toBe('');
    const done = new Promise((resolve) => { waiter.once('close', resolve); });
    await holder.release();
    expect(await done).toBe(0);
    expect(out.trim()).toBe('ran');
  });
});
