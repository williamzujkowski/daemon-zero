/**
 * Plays one named full campaign (tests/sim-worker-scenarios.ts) in a worker thread and posts its result (#548). The
 * worker is a separate V8 isolate, outside the test worker's coverage session, so the run goes at plain speed.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { SIM_SCENARIOS, type SimScenario } from './sim-worker-scenarios';

parentPort?.postMessage(SIM_SCENARIOS[workerData as SimScenario]());
