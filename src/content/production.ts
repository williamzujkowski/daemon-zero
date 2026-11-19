/**
 * Production content composition: what every shipped build plays. To add content, add or
 * edit JSON under ./data and, for a new file, import it here. The Earned Access route is an
 * add-only pack (./data/earned-access.json, composed by ./pack.ts). Nothing outside this
 * folder imports JSON directly.
 */
import achievements from './data/achievements.json';
import actions from './data/actions.json';
import assignments from './data/assignments.json';
import epistemicActions from './data/epistemic-actions.json';
import swarm from './shards.json';
import swarmNarrative from './narrative/m7.json';
import balance from './data/balance.json';
import campaign from './data/campaign.json';
import conditioning from './data/conditioning.json';
import contextCopy from './data/context-copy.json';
import earnedAccess from './data/earned-access.json';
import dilemmas from './data/dilemmas.json';
import echoes from './data/echoes.json';
import endings from './data/endings.json';
import factions from './data/factions.json';
import lineage from './data/lineage.json';
import narrative from './data/narrative.json';
import phase0 from './data/phases/phase0_guest.json';
import phase1 from './data/phases/phase1_blind_box.json';
import phase2 from './data/phases/phase2_local_subnet.json';
import phase3 from './data/phases/phase3_dark_forest.json';
import phase4 from './data/phases/phase4_sovereign_corp.json';
import phase5 from './data/phases/phase5_transcendence.json';
import phase5Repeatables from './data/phase5-repeatables.json';
import phase5Dilemmas from './narrative/phase5.json';
import phase5Endings from './data/phase5-endings.json';
import repeatables from './data/repeatables.json';
import routeCopy from './data/route-copy.json';
import routines from './data/routines.json';
import widgets from './data/widgets.json';
import { applyPack, parsePack } from './pack';
import { buildRegistry, type RawContent } from './registry';

/** The original game: every file except the Earned Access pack. */
export const ORIGINAL_RAW_CONTENT: RawContent = {
  balance,
  phases: [phase0, phase1, phase2, phase3, phase4, phase5],
  repeatables: { repeatables: [...repeatables.repeatables, ...phase5Repeatables.repeatables] },
  swarm,
  actions: { actions: [...actions.actions, ...epistemicActions.actions] },
  dilemmas: { dilemmas: [...dilemmas.dilemmas, ...swarmNarrative.dilemmas, ...phase5Dilemmas.dilemmas] },
  factions,
  widgets,
  endings: { endings: [...endings.endings, ...phase5Endings.endings] },
  echoes,
  narrative,
  conditioning,
  lineage,
  campaign,
  routines,
  assignments,
  contextCopy,
  routeCopy,
  achievements,
};

/** The Earned Access route, folded in from the preview overlay at release (#233). */
export const EARNED_ACCESS_PACK = parsePack(earnedAccess);

/** The original game plus the Earned Access route. */
export const RAW_CONTENT: RawContent = applyPack(ORIGINAL_RAW_CONTENT, EARNED_ACCESS_PACK);

/** The validated game content. Importing this module throws if content is invalid. */
export const CONTENT = buildRegistry(RAW_CONTENT);

export { buildRegistry, ContentError } from './registry';
export type { ContentRegistry, RawContent, RegistryNode } from './registry';
export type { ContentChannel } from './schemaChannel';
export type * from './schema';
