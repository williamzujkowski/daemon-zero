/**
 * Full campaigns played in a worker thread (#548). Vitest's V8 coverage counts every block the test worker runs, which
 * makes a full campaign about 2.3 times slower, and on a busy CI runner each in-process replay took 30-60 s. A worker
 * thread is its own isolate, outside that session, so the run goes at plain speed. TESTING.md ("Test runtime budget")
 * says when a run may move here: the merged coverage report must not lose a line.
 */
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { ScenarioResult, SimScenario } from './sim-worker-scenarios';

/** The named scenario's result, played in a worker; it arrives by structured clone, key order and all. */
export function playInWorker<S extends SimScenario>(scenario: S): Promise<ScenarioResult<S>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(__dirname, 'sim-worker.ts'), { workerData: scenario, execArgv: ['--import', 'tsx'] });
    worker.once('message', (result: ScenarioResult<S>) => { resolve(result); });
    worker.once('error', reject);
    worker.once('exit', (code) => { if (code !== 0) reject(new Error(`sim worker for ${scenario} exited with code ${String(code)}`)); });
  });
}
