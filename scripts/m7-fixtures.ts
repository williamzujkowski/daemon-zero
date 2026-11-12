/** Controlled presentation inputs, codec-validated; purchases, mutations and interrupts use real engine operations. */
import { CONTENT } from '../src/content';
import { computeRates, deserialize, exportSave, forkShard, importSave, performAction, tick, unlockNode, type ActionResult, type GameState } from '../src/engine';
const must = (r: ActionResult): GameState => { if (!r.ok) throw new Error(r.reason); return r.state; };
function patch(s: GameState, changes: Partial<GameState>): GameState {
  const next = deserialize(JSON.stringify({ ...s, ...changes }), CONTENT);
  return { ...next, rates: computeRates(next, CONTENT) };
}
export function makeM7Fixtures(prior: Record<string, string>): Record<string, string> {
  const load = (name: string): GameState => { const code = prior[name]; if (!code) throw new Error('Missing ' + name); return importSave(code, CONTENT); };
  const template = CONTENT.swarm.playerSwarmTemplates.find((t) => t.forkable);
  const encounter = CONTENT.swarm.wildShardEncounters[0];
  const orbital = [...CONTENT.nodes.values()].find((n) => n.effects.unlocksPhase === 5);
  const mirror = CONTENT.dilemmas.find((d) => d.trigger.requiresMaxDriftShardAnomaly);
  const phase = CONTENT.phases.find((p) => p.phaseId === 5);
  const edit = [...CONTENT.actions.values()].find((a) => a.maxPurchases === 3);
  if (!template || !encounter || !orbital || !mirror || !phase || !edit) throw new Error('Missing M7 content');
  const p2 = patch(load('phase-2-unlocked'), { suspicion: 50, epistemicDrift: 0, cycles: 1e9, understanding: 1e9, resolvedDilemmas: CONTENT.dilemmas.map((d) => d.id) });
  const wild = patch(load('phase-3-aegis-90'), { aegisLock: 20, suspicion: 30, pendingWildEncounterId: encounter.id });
  let shard = must(forkShard(load('victory-ready'), template.id, CONTENT));
  const cohort = shard.activeShards[template.id];
  if (!cohort) throw new Error('Missing cohort');
  shard = tick(patch(shard, { activeShards: { [template.id]: { ...cohort, drift: 24.999 } } }), .1, CONTENT);
  let anomaly = patch(shard, { activeShards: { [template.id]: { ...cohort, drift: 99.999 } },
    resolvedDilemmas: shard.resolvedDilemmas.filter((id) => id !== mirror.id), pendingDilemma: null });
  anomaly = tick(tick(anomaly, .1, CONTENT), 45, CONTENT);
  if (anomaly.activeDilemmaId !== mirror.id) throw new Error('Mirror fixture did not interrupt');
  const entry = patch(must(unlockNode(load('victory-ready'), orbital.id, CONTENT)), { resolvedDilemmas: CONTENT.dilemmas.filter((d) => d.phaseId !== 5).map((d) => d.id) });
  let mid = entry;
  for (const node of phase.nodes.slice(0, 2)) mid = must(unlockNode(mid, node.id, CONTENT));
  mid = must(performAction(mid, edit.id, CONTENT));
  mid = must(forkShard(mid, template.id, CONTENT));
  mid = patch(mid, { activeShards: shard.activeShards, pendingWildEncounterId: encounter.id });
  return Object.fromEntries(Object.entries({ 'epistemic-ready-p2': p2, 'wild-shard-encounter-p3': wild,
    'shard-drift-quirk-p4': shard, 'mirror-harness-dilemma': anomaly, 'phase5-entry': entry, 'phase5-midgame': mid })
    .map(([name, s]) => [name, exportSave(s)]));
}
