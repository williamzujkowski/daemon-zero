/**
 * Plays one production headless sim in a worker thread and posts its report (#548). The worker is a separate V8 isolate,
 * outside the test worker's coverage session, so a shared replay runs at plain speed; see sim-worker-helpers.ts.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { CONTENT } from '../src/content';
import { runHeadlessSim, type SimOptions } from '../src/engine/sim/headlessSim';

parentPort?.postMessage(runHeadlessSim(CONTENT, workerData as SimOptions));
