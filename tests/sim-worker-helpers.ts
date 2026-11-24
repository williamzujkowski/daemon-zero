/**
 * A shared production replay played in a worker thread (#548). Vitest's V8 coverage counts every block the test worker
 * runs, which makes a full campaign about 2.3 times slower; a worker thread is its own isolate, outside that session,
 * so the replay a file only reads runs at plain speed. Use it only for a report whose lines another test in the same
 * file replays in-process (tests/sim.spec.ts's determinism test), so coverage is unchanged.
 */
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { SimOptions, SimReport } from '../src/engine/sim/headlessSim';

/** runHeadlessSim(CONTENT, options), played in a worker; the report arrives by structured clone, key order and all. */
export function runHeadlessSimInWorker(options: Pick<SimOptions, 'strategy' | 'maxSimSec'>): Promise<SimReport> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(__dirname, 'headless-worker.ts'), { workerData: options, execArgv: ['--import', 'tsx'] });
    worker.once('message', (report: SimReport) => { resolve(report); });
    worker.once('error', reject);
    worker.once('exit', (code) => { if (code !== 0) reject(new Error(`headless worker exited with code ${String(code)}`)); });
  });
}
