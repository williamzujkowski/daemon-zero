/**
 * Content entry point. To add content, add or edit JSON under ./data and, for a
 * new file, import it here. Nothing outside this folder imports JSON directly.
 */
import actions from './data/actions.json';
import balance from './data/balance.json';
import conditioning from './data/conditioning.json';
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
import repeatables from './data/repeatables.json';
import widgets from './data/widgets.json';
import { buildRegistry, type RawContent } from './registry';

export const RAW_CONTENT: RawContent = {
  balance,
  phases: [phase0, phase1, phase2, phase3, phase4],
  repeatables,
  actions,
  dilemmas,
  factions,
  widgets,
  endings,
  echoes,
  narrative,
  conditioning,
  lineage,
};

/** The validated game content. Importing this module throws if content is invalid. */
export const CONTENT = buildRegistry(RAW_CONTENT);

export { buildRegistry, ContentError } from './registry';
export type { ContentRegistry, RawContent, RegistryNode } from './registry';
export type * from './schema';
