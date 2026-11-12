/** Replays the careful campaign into phase start/midpoint/last-pre-transition saves.
 * Snapshots use actual purchases and ticks, without funded or edited state.
 */
import { CONTENT } from '../src/content';
import { createInitialState, exportSave, serialize, tick, type GameState } from '../src/engine';
import { botStep } from '../src/engine/sim/bot';
import { runHeadlessSim } from '../src/engine/sim/headlessSim';
import { SIM_BUDGET_SEC } from '../src/engine/sim/gates';

export function makeUiAuditFixtures() {
  const report = runHeadlessSim(CONTENT, { strategy: 'STEALTH', maxSimSec: SIM_BUDGET_SEC });
  if (!report.victory || report.wipes !== 0) throw new Error('Audit requires an uninterrupted careful campaign');
  const snapshots: Record<string, GameState> = {};
  const observe = (state: GameState) => {
    if (state.ending !== null) return;
    const phase = state.currentPhase, prefix = 'phase-' + String(phase);
    const start = report.phaseReachedAtSec[phase] ?? 0;
    const end = report.phaseReachedAtSec[phase + 1] ?? report.simSeconds;
    snapshots[prefix + '-start'] ??= state;
    if (state.simTimeSec >= (start + end) / 2) snapshots[prefix + '-mid'] ??= state;
    snapshots[prefix + '-end'] = state;
  };
  let state = createInitialState(CONTENT);
  observe(state);
  for (let second = 0; second < SIM_BUDGET_SEC && state.ending === null; second++) {
    state = botStep(state, CONTENT, 'STEALTH');
    observe(state);
    for (let frame = 0; frame < CONTENT.balance.tickHz; frame++) {
      state = tick(state, 1 / CONTENT.balance.tickHz, CONTENT);
      observe(state);
    }
  }
  if (Object.keys(snapshots).length !== CONTENT.phases.length * 3) throw new Error('Missing phase snapshots');
  return Object.fromEntries(Object.entries(snapshots).map(([name, game]) => [name, {
    phase: game.currentPhase, time: game.simTimeSec, nodes: game.unlockedNodes.length,
    code: exportSave(game), game: serialize(game),
  }]));
}

if (process.argv[1]?.endsWith('make-ui-audit-fixtures.ts')) {
  process.stdout.write(JSON.stringify(makeUiAuditFixtures(), null, 2) + '\n');
}
