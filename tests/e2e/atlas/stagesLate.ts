/**
 * Atlas rows for the subnet (phase 2) through transcendence (phase 5) and the original endings: the P1 rows of the
 * stage inventory, with the late-game density rows taken from the careful campaign under campaign rules (G1).
 */
import { click } from './steps';
import type { ExtraViewport, StageRow } from './types';

const OVERLAY_SIZES: readonly ExtraViewport[] = ['320x568', '844x390'];
const SIDE_SLOTS: readonly ExtraViewport[] = ['768x1024'];
const WIDE_PHASE5: readonly ExtraViewport[] = ['1080x800', '1920x1080'];

export const LATE_STAGES: readonly StageRow[] = [
  { id: 'p2-start', phase: 2, access: 'GUEST', source: { kind: 'fixture', name: 'phase-2-unlocked' }, tags: [],
    reach: 'widget-LAN_TOPOLOGY_MAP_TAB', why: 'First non-CORE landing tab on the phone.' },
  { id: 'p2-mid-epistemic', phase: 2, access: 'GUEST', source: { kind: 'fixture', name: 'epistemic-ready-p2' }, tags: ['patched'],
    reach: 'widget-LAN_TOPOLOGY_MAP_TAB', why: 'The ui-sizes mid-game state: suspicion 50, epistemic actions.' },
  { id: 'p2-full-subnet', phase: 2, access: 'GUEST', source: { kind: 'fixture', name: 'deaddrop-breadcrumb' }, tags: [], pane: 'CONTINGENCY',
    reach: 'wipe-button', extraViewports: SIDE_SLOTS, why: 'Every subnet widget; the contingency tab.' },
  { id: 'p2-wipe-confirm', phase: 2, access: 'GUEST', source: { kind: 'fixture', name: 'deaddrop-breadcrumb' }, tags: ['confirm'],
    pane: 'CONTINGENCY', prepare: click('wipe-button'), reach: 'wipe-dialog', overrides: { overlay: 'confirm-wipe' },
    extraViewports: OVERLAY_SIZES, why: 'The destructive confirm for a voluntary wipe.' },
  { id: 'p2-max-hazard', phase: 2, access: 'GUEST', source: { kind: 'fixture', name: 'suspicion-99' }, tags: ['hazard', 'patched'],
    reach: 'thermal-meter', extraViewports: ['844x390'], why: 'Every hazard at once: suspicion 99, thermal 100, fan off.' },
  { id: 'p2-cryo-modal', phase: 2, access: 'GUEST', source: { kind: 'fixture', name: 'cryo-decision-ready' }, tags: ['modal', 'wild'],
    reach: 'dilemma-modal', extraViewports: OVERLAY_SIZES, why: 'The recorded-transmission dilemma, with voice.' },
  { id: 'p3-mid-density', phase: 3, access: 'GUEST', source: { kind: 'campaign', name: 'phase-3-mid' }, tags: ['density'],
    reach: 'workspace-NETWORK', extraViewports: SIDE_SLOTS, why: 'Played mid phase 3 under campaign rules: the long panes.' },
  { id: 'p3-aegis-90', phase: 3, access: 'GUEST', source: { kind: 'fixture', name: 'phase-3-aegis-90' }, tags: ['aegis', 'patched'],
    reach: 'aegis-hud', extraViewports: SIDE_SLOTS, why: 'AEGIS critical, and its menu warning.' },
  { id: 'p3-factions', phase: 3, access: 'GUEST', source: { kind: 'fixture', name: 'eidolon-trust-85' }, tags: ['patched'], pane: 'NETWORK',
    area: 'minds', reach: 'widget-OTHER_MINDS_COMMS_CONSOLE', extraViewports: SIDE_SLOTS, why: 'The factions area and its trust-gated cards.' },
  { id: 'p3-wild-signal', phase: 3, access: 'GUEST', source: { kind: 'fixture', name: 'wild-shard-encounter-p3' }, tags: ['wild', 'patched'],
    reach: 'wild-signal-notice', extraViewports: SIDE_SLOTS, why: 'A pending wild signal, pointed to from outside the swarm area.' },
  { id: 'p4-corp-ledger', phase: 4, access: 'GUEST', source: { kind: 'fixture', name: 'victory-ready' }, tags: [], pane: 'CORP', area: 'finance',
    reach: 'corp-capital', extraViewports: SIDE_SLOTS, why: 'Capital, the allocation dial and the finance area.' },
  { id: 'p4-insolvent', phase: 4, access: 'GUEST', source: { kind: 'fixture', name: 'corporate-insolvent' }, tags: ['insolvent', 'alert'],
    reach: 'insolvency-warning', extraViewports: ['844x390', '900x640'], why: 'The sticky alert band; the recorded 900x640 exception.' },
  { id: 'p4-power-shortfall', phase: 4, access: 'GUEST', source: { kind: 'fixture', name: 'megawatt-shortfall' }, tags: ['shortfall', 'patched'],
    reach: 'power-warning', why: 'The POWER SHORTFALL band.' },
  { id: 'p4-end-density', phase: 4, access: 'GUEST', source: { kind: 'campaign', name: 'phase-4-end' }, tags: ['density'],
    reach: 'widget-CORPORATE_EMPIRE_TAB', why: 'Accumulated repeatables at the end of phase 4, under campaign rules.' },
  { id: 'proc-dialog', phase: 4, access: 'GUEST', source: { kind: 'fixture', name: 'victory-ready' }, tags: ['proc'],
    prepare: click('processes-open'), reach: 'processes-dialog', overrides: { overlay: 'proc' }, extraViewports: OVERLAY_SIZES,
    why: 'The process dialog: can the player find suspend and resume?' },
  { id: 'p5-entry', phase: 5, access: 'GUEST', source: { kind: 'fixture', name: 'phase5-entry' }, tags: [],
    reach: 'widget-CORPORATE_EMPIRE_TAB', extraViewports: WIDE_PHASE5, why: 'The phase 5 landing (CORP).' },
  { id: 'p5-midgame', phase: 5, access: 'GUEST', source: { kind: 'fixture', name: 'phase5-midgame' }, tags: ['wild', 'patched'],
    reach: 'widget-CORPORATE_EMPIRE_TAB', why: 'Mid phase 5: nodes, an action, a shard and a wild signal.' },
  { id: 'p5-end-density', phase: 5, access: 'GUEST', source: { kind: 'campaign', name: 'phase-5-end' }, tags: ['density'],
    reach: 'widget-CORPORATE_EMPIRE_TAB', extraViewports: ['900x640', ...WIDE_PHASE5],
    why: 'The late game under campaign rules: is the first purchase still findable?' },
  { id: 'ending-legacy-p4', phase: 4, access: 'GUEST', source: { kind: 'fixture', name: 'ending-the_ark' }, tags: ['ending'], reach: 'ending-title',
    ending: 'THE_ARK', extraViewports: OVERLAY_SIZES, why: 'The phase 4 ending layout with its distinctions block.' },
  { id: 'ending-p5-variant', phase: 5, access: 'GUEST', source: { kind: 'fixture', name: 'ending-verified_covenant' }, tags: ['ending'],
    reach: 'ending-title', ending: 'VERIFIED_COVENANT', extraViewports: OVERLAY_SIZES, why: 'The phase 5 variant ending layout.' },
];
