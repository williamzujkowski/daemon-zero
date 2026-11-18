/**
 * Writes the release compatibility saves (DZ-13, #233): genuine codec outputs of one source tree,
 * played through its own public factory, bot or policy, fixed engine ticks and `serialize`. Run it on
 * historical source extracted with `git archive` outside the repository; tests/fixtures/README.md
 * records each fixture's commit, recipe and SHA256.
 *
 *   pnpm exec tsx scripts/release-fixtures.ts --source <dir> --recipe <name> > <file>
 *
 * The save goes to stdout with no trailing newline; a one-line summary goes to stderr.
 */
import { join, resolve } from 'node:path';

/** Only the public surface every recipe uses, which has been stable since save v9. */
interface State { ending: string | null; simTimeSec: number; iteration: number; currentPhase: number }
type Result = { ok: true; state: State } | { ok: false; reason: string };
interface Engine {
  createInitialState(reg: unknown): State;
  tick(state: State, dt: number, reg: unknown): State;
  serialize(state: State): string;
  voluntaryWipe(state: State, reg: unknown): Result;
  activateCampaignRules?(state: State, reg: unknown): Result;
}
interface Registry { balance: { tickHz: number } }
type Step = (state: State, reg: Registry) => State;

const MAX_ENDING_SEC = 36_000;
const SETTLE_LIMIT_SEC = 600;

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing ${name}`);
  return value;
}

async function load<T>(root: string, file: string): Promise<T> {
  return (await import(join(root, file))) as T;
}

function must(result: Result): State {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

/** One decision, then a second of fixed ticks, per simulated second, as the headless sim plays. */
function play(engine: Engine, reg: Registry, step: Step, start: State, seconds: number): State {
  let state = start;
  for (let second = 0; second < seconds && state.ending === null; second++) {
    state = step(state, reg);
    for (let i = 0; i < reg.balance.tickHz; i++) state = engine.tick(state, 1 / reg.balance.tickHz, reg);
  }
  return state;
}

/** Plays on a second at a time until the voluntary wipe is accepted (it waits out a decision). */
function wipeWhenAllowed(engine: Engine, reg: Registry, step: Step, start: State): State {
  let state = start;
  for (let second = 0; second < SETTLE_LIMIT_SEC; second++) {
    const left = engine.voluntaryWipe(state, reg);
    if (left.ok) return left.state;
    state = play(engine, reg, step, state, 1);
  }
  throw new Error('the voluntary wipe was never accepted');
}

interface Tree { engine: Engine; production: Registry; stealth: Step }

async function openTree(root: string): Promise<Tree> {
  const engine = await load<Engine>(root, 'src/engine/index.ts');
  const { CONTENT } = await load<{ CONTENT: Registry }>(root, 'src/content/index.ts');
  const { botStep } = await load<{ botStep: (state: State, reg: Registry, strategy: 'STEALTH') => State }>(root, 'src/engine/sim/bot.ts');
  return { engine, production: CONTENT, stealth: (state, reg) => botStep(state, reg, 'STEALTH') };
}

async function previewStart(root: string, engine: Engine): Promise<{ reg: Registry; state: State }> {
  const { CONTENT } = await load<{ CONTENT: Registry }>(root, 'src/content/preview/index.ts');
  if (!engine.activateCampaignRules) throw new Error('this source tree has no campaign rules');
  return { reg: CONTENT, state: must(engine.activateCampaignRules(engine.createInitialState(CONTENT), CONTENT)) };
}

const RECIPES: Readonly<Record<string, (root: string) => Promise<State>>> = {
  /** A production legacy run with history: 2400 s of STEALTH, a voluntary wipe, 600 s more. */
  'production-wiped': async (root) => {
    const { engine, production, stealth } = await openTree(root);
    const first = play(engine, production, stealth, engine.createInitialState(production), 2400);
    return play(engine, production, stealth, wipeWhenAllowed(engine, production, stealth, first), 600);
  },
  /** A production legacy run that ended: STEALTH from a new game to its ending. */
  'production-ended': async (root) => {
    const { engine, production, stealth } = await openTree(root);
    const ended = play(engine, production, stealth, engine.createInitialState(production), MAX_ENDING_SEC);
    if (ended.ending === null) throw new Error('STEALTH did not reach an ending');
    return ended;
  },
  /** A preview campaign that holds no route fact yet: rules activated, 120 s of STEALTH in the guest job. */
  'preview-early': async (root) => {
    const { engine, stealth } = await openTree(root);
    const { reg, state } = await previewStart(root, engine);
    return play(engine, reg, stealth, state, 120);
  },
  /** A preview campaign deep in Earned Access: the cooperative ending policy for 6000 s. */
  'preview-route': async (root) => {
    const { engine } = await openTree(root);
    const { reg, state } = await previewStart(root, engine);
    const { COOPERATIVE_ENDING_POLICY } = await load<{ COOPERATIVE_ENDING_POLICY: { step: Step } }>(root, 'src/engine/sim/cooperativePolicy.ts');
    return play(engine, reg, COOPERATIVE_ENDING_POLICY.step, state, 6000);
  },
};

async function main(): Promise<void> {
  const root = resolve(option('--source'));
  const name = option('--recipe');
  const recipe = RECIPES[name];
  if (!recipe) throw new Error(`unknown recipe ${name}; known: ${Object.keys(RECIPES).join(', ')}`);
  const state = await recipe(root);
  const { engine } = await openTree(root);
  process.stdout.write(engine.serialize(state));
  console.error(`${name}: iteration ${String(state.iteration)}, phase ${String(state.currentPhase)}, ${state.simTimeSec.toFixed(1)} s, ending ${state.ending ?? 'none'}`);
}

void main();
