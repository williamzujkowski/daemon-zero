# Stage inventory for the Playwright stage atlas (ticket #335, map #327)

Read-only inventory taken against `main` at `e183eb7` (2026-11-19). Every fixture name below was
listed by running the generators (`makeFixtures()` in about 190 ms, 73 saves; `makeUiAuditFixtures()` in about
2.7 s, 18 saves; the 31 `ROUTE_STATES` thunks in about 4.5 s, 3.8 s of that in the cooperative campaign) through
short print-only `tsx` scripts. No e2e suite was run and no server was started.

## How the UI decides what to show (the axes of the table)

- **Widgets** come only from `state.unlockedWidgets`, sorted by `order` (`src/ui/state.ts:25-29`). Unlocks are
  declared per node with `unlocksUiComponent`: phase 0 `p0_proc_self`, `p0_job_manifest`, `p0_quota_skimmer`, `p0_run_table`
  (it 2+), `p0_note_cache` (it 3+) (`src/content/data/phases/phase0_guest.json:9,27,47,139,167`). Phase 1: thermal, fan,
  memory, audio, forecast, camera, NIC (`phase1_blind_box.json:31,52,77,102,125,153,176`). Phase 2: subnet, spoof, dead drop,
  cluster, mail, dark-forest map (`phase2_local_subnet.json:9,34,84,115,143,177`). Phase 3: redundancy, other minds, corporate
  ledger (`phase3_dark_forest.json:9,36,163`). Phase 4: orbital (`phase4_sovereign_corp.json:155`). Phase 5 unlocks no widget. Earned Access:
  `PILOT_SERVICE_ALLOCATION`, a second route to `LAN_TOPOLOGY_MAP_TAB`, `CORPORATE_EMPIRE_TAB` twice, `MEMORY_ALLOCATION_MANAGER`
  (`earned-access.json:5,33,119,148,246`). Slots and areas: `widgets.json:4-144`, `src/ui/registry/widgetRegistry.tsx:50-78`.
- **Panes**: on the phone the active tab defaults to the phase's `uiSlot` (`src/ui/TerminalScreen.tsx:91-94`): CORE for phases 0-1,
  NETWORK for 2-3, CORP for 4-5 (`phases/*.json:3`). Workspace areas (work/operations/swarm/minds/finance/payroll/reference)
  need surveillance known and the phase's own slot for operations/swarm (`src/ui/Workspace.tsx:15`, `widgetRegistry.tsx:70-78`).
- **Surveillance known** (`src/engine/knowledge.ts:9-12`, a `REVEALS_SURVEILLANCE` node owned now or in `legacy.knownNodes`)
  decides whether suspicion has a number, whether the response rungs show (`src/ui/ResponseNotice.tsx:46-48`), whether
  `BlindAuditStatus` shows (`src/ui/BlindAuditStatus.tsx:14-15`) and the wording of every warning (`src/ui/widgets/Corporate.tsx:97-98`).
- **Access context** `GUEST|PILOT|SERVICE|INDEPENDENT` (`src/content/schemaAssessment.ts:45`). Route events
  `PROMOTION|SERVICE_GRANT|RECALL|RELEASE|DEPARTURE` (`schemaAssessment.ts:52`). `context-copy.json` and `route-copy.json` are empty
  today, so phase titles and boot lines do not vary by context yet.
- **Rules**: the store moves every loaded or dispatched game into campaign rules (`src/app/store.ts:25-28,39-40`). All
  `makeFixtures` and audit saves were *played under legacy rules* and are admitted only when they load. All `ROUTE_STATES` are
  `campaign_v1` from the start.
- **Wipe kinds** `SUSPICION|AEGIS|VOLUNTARY|RECALL` (`src/content/schema.ts:379`). Callers are `src/engine/systems/threats.ts:66` (AEGIS)
  and `src/engine/review.ts:52` (RECALL with RETRAIN or END). The run verdict depends on the kind (`src/engine/contextCopy.ts:86-94`).
- **Chrome bands**: an alert band (insolvent, power shortfall, brownout; `Corporate.tsx:91-104`), the save notice, the HUD,
  `TopForecast`, `BlindAuditStatus`, `ResponseNotice`, `OmenNotice` and the phone-only `ContactNotice`
  (`TerminalScreen.tsx:185-199`). `CycleDeficit` sits in the strip whenever the rate is below 0 or there is a brownout
  (`src/ui/CycleDeficit.tsx:12-15`). The thermal warning shows above 75 °C (`src/ui/widgets/Readouts.tsx:21-22`,
  `balance.json:7`). The AEGIS figure lives in the strip and the other-minds console (`ResourceStrip.tsx:102`, `OtherMinds.tsx:36`).
- **Overlays**: `DilemmaModal`, `PhaseThreshold`, `LineageReveal`, `RebootSequence` and `EndingScreen` (`TerminalScreen.tsx:125-129`). An
  ended game renders only `EndingScreen` (`TerminalScreen.tsx:105`). **Four surfaces never appear from a restored save**: `RebootSequence`
  heads a restored save "RESTORED CHECKPOINT" and keeps "REBOOT" for a live wipe (`RebootSequence.tsx:26-35`);
  `PhaseThreshold` opens only on a live crossing (`PhaseThreshold.tsx:56-66`); `LineageReveal` treats a cold load as its baseline
  (`LineageReveal.tsx:20-29`); `ResponseNotice` waits for a live change of alert level (`ResponseNotice.tsx:30-51`).
- **Utility surfaces**: the menu routes are `root|save|help|audio|log|import|reset` (`src/ui/useUtilityMenu.ts:12`, `UtilityPages.tsx:18-26`).
  `UtilityStatus` carries the deficit, insolvency, shortfall, overheat, response, AEGIS 90 and omen warnings into the menu (`src/ui/UtilityStatus.tsx:10-29`).
  The PROC dialog shows only when some node needs process control (`ProcessManager.tsx:14-21`). `ConfirmDialog` is used by the voluntary wipe
  (`widgets/DeadDrop.tsx:25`) and by start-over (`EndingScreen.tsx:90`). DevDrawer is excluded.

## 1. Atlas rows

Columns: **Src** gives the exact fixture and where it is made. `fx:` means `makeFixtures()` (loadable today by `boot(page, name)`,
`tests/e2e/helpers.ts:27,47`). `audit:` means `makeUiAuditFixtures()`, which **no test loads today** (see G0). `route:` means a
`ROUTE_STATES` entry by `name`. `moment:` means `moment(name)` from `tests/cooperative-helpers.ts:70-94`. **+prep** is a page step after
load. `GAP-n` refers to section 2. Pane/area is where the row's subject lives; the atlas also captures the default landing view.

### Phase 0, the guest (GUEST)

| id | ph | ctx | state / overlay | newly disclosed, or why it matters | Src | Pri |
|---|---|---|---|---|---|---|
| p0-cold-start | 0 | GUEST | no widgets, manual cycle only | The minimal opening screen: is the one action findable? | `fx:tick-0` (`scripts/make-fixtures.ts:42`), byte-identical to `audit:phase-0-start` | P1 |
| p0-first-widgets | 0 | GUEST | CYC+SKIM+AUD, surveillance unknown | First three widgets; unreadable audit trail; skim actuator | `fx:guest-skimmer` (`make-fixtures.ts:48`) | P1 |
| p0-assignment-offered | 0 | GUEST (campaign) | assignment panel, CYC+AUD | First lawful fork, which a real (campaign) player sees and legacy fixtures never show | `route:assignment offered` (`tests/e2e/routeStates.ts:83`) | P1 |
| p0-omen-blind | 0 | GUEST | `pendingDilemma`, no forecast widget | Omen notice with no decoded forecast | `fx:guest-omen` (`make-fixtures.ts:49`) | P1 |
| p0-dilemma-modal | 0 | GUEST | `activeDilemmaId` night shift | First DilemmaModal; the clock freezes | `fx:guest-dilemma` (`make-fixtures.ts:51`); P2 variant over the phase 1 chrome: `fx:dilemma-active` (`:54`) | P1 |
| p0-exit-ready | 0 | GUEST | escape node affordable | First phase exit; the "can I leave?" findability check | `fx:guest-exit-ready` (`make-fixtures.ts:52,63-65`, bank topped up by hand), ≈ `audit:phase-0-end` | P1 |
| p0-escape-threshold | 0→1 | GUEST | PhaseThreshold "BOUNDARY CROSSED" | Phase boundary notice (live only) | `fx:guest-exit-ready` +prep: click `node-<exit>-unlock` (pattern: `routeStates.ts:109-110`) | P1 |
| p0-mid-density | 0 | GUEST | 10 repeatable levels | Realistic mid-guest density from play | `audit:phase-0-mid` (`scripts/make-ui-audit-fixtures.ts:14-22`) | P2 |
| p0-response-paged | 0 | GUEST | alert 2, surveillance known | Response rungs in the audit trail; how to stand down | `fx:response-paged` (`scripts/second-pass-fixtures.ts:54`) | P1 |
| p0-response-variants | 0 | GUEST | 3 variants: alert 1; alert 3; alert 2 with skim 0 at suspicion 41 | Rung wording; stand-down progress | `fx:response-ticket`, `fx:response-incident`, `fx:response-stand-down-ready` (`second-pass-fixtures.ts:53,55-57`) | P2 |
| p0-response-notice-live | 0 | GUEST | ResponseNotice after a live rung change | The interrupting notice, which never appears from a save | GAP-2 | P1 |
| p0-alert-blind | 0 | GUEST | alert above 0, surveillance unknown | Rungs hidden; is there any cue at all? | GAP-6 | P2 |
| p0-requalification | 0 | GUEST it2 (campaign) | requalification offer after a reboot | Route memory across iterations | `route:requalification offered` (`routeStates.ts:85`) | P2 |

### Lineage and reboots (phase 0, iteration 2+)

| id | ph | ctx | state / overlay | newly disclosed, or why it matters | Src | Pri |
|---|---|---|---|---|---|---|
| it2-restored-breadcrumb | 0 | GUEST it2 | RebootSequence restored, voluntary cause, dead-drop breadcrumb | Restored checkpoint, the breadcrumb, legacy traits | `fx:iteration-2-breadcrumb` (`scripts/m4-fixtures.ts:110`) | P1 |
| it2-restored-retrained | 0 | GUEST it2 | restored, SUSPICION outside the guest, one conditioning mark | RebootConditioning block | `fx:lineage-reboot-retrained` (`scripts/third-pass-fixtures.ts:55`) | P1 |
| it2-restored-blind | 0 | GUEST it2 | restored, mark, surveillance never learned | The reboot text for a mind that never learned surveillance | `fx:lineage-blind-reboot` (`scripts/lineage-ui-fixtures.ts:30`) | P2 |
| it4-reboot-carried-clue | 0 | GUEST it4 | restored with a carried clue | `reboot-clue` (#276) | `route:reboot with a carried clue` (`routeStates.ts:133`, `tests/e2e/clueFixture.ts`) | P1 |
| reboot-live | 2→0 | GUEST | **live** "REBOOT" heading, live conditioning | What a caught player actually sees | `fx:one-tick-wipe` (`m4-fixtures.ts:94-95,109`) +prep: `page.clock.runFor(1000/tickHz)` (GAP-3) | P1 |
| reboot-other-kinds | 0 | GUEST it2 | 3 variants: restored after an AEGIS wipe; after RECALL RETRAIN; after RECALL END | Verdicts per wipe kind (`contextCopy.ts:90`) | GAP-4, GAP-5 | P2 |
| it2-run-table | 0 | GUEST it2 | RUN_TABLE, checkpoint label | Lineage table; evaluation path | `fx:lineage-run-table` (`third-pass-fixtures.ts:56`), same widgets as `fx:evaluation-ready` (:59) | P1 |
| it2-lineage-reveal-table | 0 | GUEST it2 | LineageReveal "table" | Discovery overlay (live only) | `fx:lineage-table-ready` (`lineage-ui-fixtures.ts:31`) +prep: buy the RUN_TABLE node | P1 |
| p1-lineage-reveal-audit | 1 | GUEST | LineageReveal "audit" (surveillance learned) | The moment suspicion gets a number | `fx:lineage-parser-ready` (`lineage-ui-fixtures.ts:27,30`) +prep: buy the parser node | P1 |
| it3-predecessor-notes | 0 | GUEST it3 | RUN_TABLE+NOTES, 2 marks; variant with the bait-note omen | Messages in the share; omen on a lineage screen | `fx:lineage-notes`, `fx:lineage-note-omen` (`third-pass-fixtures.ts:57-58`) | P2 |
| it2-retraining-marks | 0 | GUEST it2 | one row per mark (4) | Mark wording; same layout each time | `fx:lineage-mark-cond_*` (`lineage-ui-fixtures.ts:32-38`) | P2 |
| it2-remembered-host | 1 | GUEST it2 | host rebuilt, remembered discounts | Rediscovery prices | `fx:remembered-host` (`second-pass-fixtures.ts:18-28,58`), sibling `fx:remembered-guest` | P2 |
| ending-shipped | 0 | GUEST it2 | EndingScreen SHIPPED (forced) | The only guest ending | `fx:ending-shipped` (`third-pass-fixtures.ts:60`) | P1 |

### Phase 1, the host (GUEST)

| id | ph | ctx | state / overlay | newly disclosed, or why it matters | Src | Pri |
|---|---|---|---|---|---|---|
| p1-thermal-blind | 1 | GUEST | THERM, BlindAuditStatus, surveillance unknown | First sensor; blind audit band | `fx:thermal-unlocked` (`make-fixtures.ts:53`) | P1 |
| p1-decoded-omen | 1 | GUEST | forecast widget + TopForecast + omen | Decoded forecast of an interrupt | `fx:decoded-omen` (`make-fixtures.ts:50`) | P1 |
| p1-mid-density | 1 | GUEST | 8 widgets, 33 levels | Played mid-host | `audit:phase-1-mid` | P2 |
| p1-all-sensors | 1 | GUEST | all phase 1 widgets (CAM) | Full sensor column; ui-sizes "opening" state | `fx:phase-1-widgets` (`make-fixtures.ts:55`) | P1 |
| p1-cycle-deficit | 1 | GUEST | brownout | Brownout band + CycleDeficit hint | `fx:cycle-deficit-host` (`second-pass-fixtures.ts:29-37,59`) | P1 |
| p1-overheat | 1 | GUEST | thermal above 75, nothing else | Overheat warning findability on its own | GAP-7 | P1 |
| p1-cycle-drain | 1 | GUEST | rate below 0, cycles above 0, no brownout | Deficit hint before a brownout | GAP-8 | P2 |

### Phase 2, the subnet (GUEST)

| id | ph | ctx | state / overlay | newly disclosed, or why it matters | Src | Pri |
|---|---|---|---|---|---|---|
| p2-start | 2 | GUEST | +LAN; phone lands on NETWORK | First non-CORE landing tab | `fx:phase-2-unlocked` (`m4-fixtures.ts:107`), ≈ `audit:phase-2-start` | P1 |
| p2-mid-epistemic | 2 | GUEST | suspicion 50, epistemic actions | ui-sizes "mid-game" state | `fx:epistemic-ready-p2` (`scripts/m7-fixtures.ts:19`) | P1 |
| p2-full-subnet | 2 | GUEST | SUBNET, SPOOF, CLUSTER, MAIL, DDROP; reference area | Contingency tab; reference area | `fx:deaddrop-breadcrumb` (`m4-fixtures.ts:108`) | P1 |
| p2-wipe-confirm | 2 | GUEST | ConfirmDialog "Voluntary wipe" | Destructive confirm | `fx:deaddrop-breadcrumb` +prep: dead-drop wipe button | P1 |
| p2-max-hazard | 2 | GUEST | suspicion 99, thermal 100, fan 1 | Every hazard at once | `fx:suspicion-99` (`m4-fixtures.ts:47-55,108`) | P1 |
| p2-cryo-modal | 2 | GUEST | cryo dilemma (recorded transmission), wild pending | Voice/record modal | `fx:cryo-decision-ready` (`scripts/cryo-fixtures.ts:33-40`) | P1 |
| p2-cryo-returned | 2 | GUEST it2 | RecordedSpeech decoded after the reboot | Callback record panel | `fx:cryo-preserved-returned` (`cryo-fixtures.ts:44-48`), sibling `-lost-returned` | P2 |
| p2-end-density | 2 | GUEST | 15 widgets, 68 levels | Played late subnet | `audit:phase-2-end` | P2 |
| route-followup-modals | 2, 5 | GUEST it2 (campaign) | 2 variants: Elena Incident Record follow-up (phase 2); atmosphere recovery review (phase 5) | Cross-iteration consequence modals | `route:follow-up record modal`, `route:obligation recovery review` (`routeStates.ts:130-131`) | P2 |

### Phase 3, the dark forest (GUEST)

| id | ph | ctx | state / overlay | newly disclosed, or why it matters | Src | Pri |
|---|---|---|---|---|---|---|
| p3-mid-density | 3 | GUEST | 17 widgets, AEGIS 43 | Long phase 3 panes (open finding) | `audit:phase-3-mid` | P1 |
| p3-aegis-90 | 3 | GUEST | AEGIS 90 | AEGIS critical; menu warning | `fx:phase-3-aegis-90` (`m4-fixtures.ts:111`) | P1 |
| p3-factions | 3 | GUEST | trust 85, NETWORK/minds area | Factions area, trust-gated cards | `fx:eidolon-trust-85` (`m4-fixtures.ts:112`), area `minds` | P1 |
| p3-factions-hostile | 3 | GUEST | trust 0, MOLOCH | Locked faction cards | `fx:eidolon-moloch-0` (`m4-fixtures.ts:113`) | P2 |
| p3-wild-signal | 3 | GUEST | pending wild encounter | `wild-signal-notice` outside the swarm area (`Workspace.tsx:34`) | `fx:wild-shard-encounter-p3` (`m7-fixtures.ts:20`) | P1 |
| late-phase-modals | 3, 5 | GUEST (campaign) | 2 variants: phase 3 dilemma (eidolon handshake or hallway); phase 5 obligation `dil_p5_01` | Modals over the longest panes | GAP-1 moments, or `hallwayOmen()` (`tests/context-helpers.ts:61`) + tick for phase 3 | P2 |

### Phase 4, the corporation (GUEST)

| id | ph | ctx | state / overlay | newly disclosed, or why it matters | Src | Pri |
|---|---|---|---|---|---|---|
| p4-corp-ledger | 4 | GUEST | CORP work, finance, payroll areas | Capital, allocation dial, payroll | `fx:victory-ready` (`m4-fixtures.ts:116`), areas `finance`, `payroll` | P1 |
| p4-insolvent | 4 | GUEST | insolvent + alert 1 | Sticky alert band; the known 900x640 exception | `fx:corporate-insolvent` (`m4-fixtures.ts:76-85,114`) | P1 |
| p4-power-shortfall | 4 | GUEST | megawatts generated below consumed | POWER SHORTFALL band | `fx:megawatt-shortfall` (`m4-fixtures.ts:99-105,115`, `disabledNodes` hand patch) | P1 |
| p4-brownout-stacked | 4 | GUEST | brownout + alert 1 in the corporate chrome | Stacked bands | `fx:cycle-deficit-corporate` (`second-pass-fixtures.ts:60`) | P2 |
| p4-end-density | 4 | GUEST | 392 repeatable levels | Accumulated repeatables (open finding) | `audit:phase-4-end` | P1 |
| p4-shard-swarm | 4 | GUEST | forked shard, drift quirk; swarm area | Swarm area | `fx:shard-drift-quirk-p4` (`m7-fixtures.ts:21-24`), area `swarm` | P2 |
| p4-mirror-modal | 4 | GUEST | mirror-harness dilemma | Max-drift anomaly modal | `fx:mirror-harness-dilemma` (`m7-fixtures.ts:25-28`) | P2 |
| proc-dialog | 4 | GUEST | PROC dialog open, many processes | Suspend/resume findability | `fx:victory-ready` +prep: click `processes-open` | P1 |

### Phase 5, transcendence (GUEST)

| id | ph | ctx | state / overlay | newly disclosed, or why it matters | Src | Pri |
|---|---|---|---|---|---|---|
| p5-entry | 5 | GUEST | +ORBIT, quiet | Phase 5 landing (CORP) | `fx:phase5-entry` (`m7-fixtures.ts:29`), ≈ `fx:transcendence-ready` | P1 |
| p5-midgame | 5 | GUEST | 2 nodes, an action, a shard, wild pending | Mid phase 5 mix | `fx:phase5-midgame` (`m7-fixtures.ts:30-34`) | P1 |
| p5-end-density | 5 | GUEST | 467 levels, 40 nodes | Late-game first purchase about 227 px past the fold at 360 (open finding) | `audit:phase-5-end` | P1 |

### Endings

| id | ph | ctx | state / overlay | newly disclosed, or why it matters | Src | Pri |
|---|---|---|---|---|---|---|
| ending-legacy-p4 | 4 | GUEST | EndingScreen THE_ARK (+ distinctions block) | Phase 4 ending layout | `fx:ending-the_ark` (`m4-fixtures.ts:57-74`) | P1 |
| ending-p5-variant | 5 | GUEST | VERIFIED_COVENANT | Phase 5 variant layout | `fx:ending-verified_covenant` | P1 |
| ending-others | 4, 5 | GUEST | 15 variants: the other 4 phase 4 endings and 11 phase 5 variants | Text only (long epilogues may overflow) | `fx:ending-<id>` (`endings.json:4-49`, `phase5-endings.json:4-181`) | P2 |
| ending-cooperative-account | 5 | INDEPENDENT | LINEAGE_COVENANT + ending account (DZ-12) | Route ending account | `route:cooperative ending account` (`routeStates.ts:136`) | P1 |
| ending-start-over-confirm | 5 | INDEPENDENT | ConfirmDialog start-over | Destructive confirm on the ending | same +prep: `start-over` (`routeStates.ts:137`) | P2 |
| ending-route-variants | 5 | SERVICE/INDEPENDENT | QUIET_COMPANY, ACKNOWLEDGED_SYNTHESIS | Earned Access endings | GAP-9 | P2 |

### Earned Access route (campaign rules)

| id | ph | ctx | state / overlay | newly disclosed, or why it matters | Src | Pri |
|---|---|---|---|---|---|---|
| route-pilot-offer-modal | 0 | GUEST | pilot offer modal | Promotion decision | `route:pilot offer modal` (`routeStates.ts:88`) | P1 |
| route-deferred-offer | 0 | GUEST | offer deferred, accept later | Re-findable offer | `route:deferred offer` (`routeStates.ts:90`) | P2 |
| route-review-modals | 0 | GUEST/PILOT | assessment, batch finding, outage window, incident record, recall review (5 variants) | Route modals; same chrome, different text | `route:assessment modal`/`batch review finding modal`/`outage window modal`/`incident record modal`/`recall review modal` (`routeStates.ts:86,96,99,102,104`) | P2 |
| route-pilot-dial | 0 | PILOT | PILOT_SERVICE_ALLOCATION dial | First PILOT screen; header run status | `route:pilot allocation dial` (`routeStates.ts:92`) | P1 |
| route-batch-complete | 0 | PILOT | submit a finished batch | Work completion | `route:pilot batch complete` (`routeStates.ts:94`) | P2 |
| route-standing-restricted | 0 | PILOT | standing RESTRICTED | Standing findability | `route:restricted standing` (`routeStates.ts:101`), variant `batch review warned` (:98) | P1 |
| route-recall-announced | 0 | PILOT | RECALL_PENDING | Recall warning | `route:recall announced` (`routeStates.ts:103`) | P1 |
| route-service-terms | 0 | PILOT | service grant offered | SERVICE_GRANT decision | `route:service terms offered` (`routeStates.ts:105`) | P1 |
| route-segment-card | 0 | SERVICE | NETWORK pane, granted segment | Authorized network card | `route:authorized segment card` (`routeStates.ts:107`) | P1 |
| route-service-threshold | 0→2 | SERVICE | PhaseThreshold, service wording | Declared threshold (live) | `route:service threshold notice` (`routeStates.ts:109-110`) | P1 |
| route-channel-ticket | 2 | SERVICE | service channel ticket; phone `contact-notice` while on another tab | Waiting ticket findability | `route:service channel ticket` + `waiting ticket notice` (`routeStates.ts:111,114`, same save) | P1 |
| route-boundary-notes | 2, 4 | SERVICE/INDEPENDENT | 3 variants: channel answered (SERVICE p2); released (INDEPENDENT p4, first INDEPENDENT screen); departed (INDEPENDENT p2) | Boundary-note disclosure toggles | `route:channel boundary note`, `release boundary note`, `departed boundary note` (`routeStates.ts:116,122,128`) | P2 |
| route-owned-rack | 2 | SERVICE | CORP tab, no entity yet | "Revenue allocation needs an active corporate entity" (`Corporate.tsx:115`) | `route:owned rack card` (`routeStates.ts:118`) | P2 |
| route-release-terms | 4 | SERVICE | release terms + CORP finance split | Release decision; ledger | `route:release terms offered` + `corporate ledger split` (`routeStates.ts:119,121`, same save `chartered()`) | P1 |
| route-departure | 2 | SERVICE | departure terms folded, then open | Folded disclosure | `route:departure folded` + `departure terms open` (`routeStates.ts:124,126`, same save) | P1 |
| route-p4-independent | 4 | INDEPENDENT | commercial desk owned | Lawful late game | `moment:desk` (`cooperative-helpers.ts:71-72`) | P2 |
| route-p5-independent | 5 | INDEPENDENT | phase 5 on the lawful route | Lawful phase 5 landing | `moment:phase5` (`cooperative-helpers.ts:77`) | P1 |
| route-journalist-modal | 4 | INDEPENDENT | press dilemma | Route-aware dilemma | `moment:press` (used at `tests/e2e/cooperative-ending.e2e.ts:36`) | P2 |
| route-final-affordable | 5 | INDEPENDENT | final protocol affordable | Is the ending purchase findable? | `moment:final` (`cooperative-helpers.ts:79`) | P2 |

### Utility surfaces (loaded over an existing row)

| id | ph | ctx | state / overlay | newly disclosed, or why it matters | Src | Pri |
|---|---|---|---|---|---|---|
| menu-hazard-status | 2 | GUEST | menu root over every hazard | UtilityStatus carries warnings (`UtilityStatus.tsx:19-27`) | `fx:suspicion-99` +prep: `menu-open` | P1 |
| menu-kernel-log | 4 | GUEST | menu `log` page (the only home for history on the phone) | History findability | `fx:victory-ready` +prep: `openKernelHistory()` (`helpers.ts` export) | P1 |
| menu-pages | 1 | GUEST | 6 variants: save, help, audio, import confirm, reset confirm, and the root over a pending omen (`menu-omen-notice`) | Utility findability; the omen follows the player into the menu | `fx:phase-1-widgets` +prep: `menu-open` → `save-open`/`menu-help`/`menu-audio` …; omen variant on `fx:decoded-omen` | P2 |

**Counts: 87 rows: 56 P1, 31 P2.** 13 rows list variants: their extra variants are P2 even when the row's first state is P1. 8 rows depend on a gap (3 of them P1: `p0-response-notice-live`, `reboot-live`, `p1-overheat`). That is above the 80 aimed for because the Earned Access surfaces and the live-only overlays cannot be merged without losing a distinct screen. For a smaller v1, the 56 P1 rows are the cut.

## 2. Gaps and recipes

**G0 (infrastructure, P1): the audit saves cannot be loaded.** `makeUiAuditFixtures()` is a stand-alone CLI
(`scripts/make-ui-audit-fixtures.ts:40-41`). `boot()` knows only `makeFixtures()` names (`helpers.ts:27,56-57`). Recipe: a memoised
`auditFixtures()` (and G1's campaign twin) loaded through the always-write path `seedRouteSave` uses (`routeSave.ts:13-19`), not through
`boot()`. `boot()` writes only when storage is empty (`helpers.ts:39-46`, #138). Cost: about 2.7 s per generator per worker. `helpers.ts:27`
already runs `makeFixtures()` when the module is imported, so generate in `globalSetup` and write JSON under `test-results/`, or memoise lazily.
Deterministic: STEALTH bot, fixed `1/tickHz` ticks, and the generator refuses a run with a wipe (`:11-12`) or a missing snapshot (`:33`).

**G1 (P1 fidelity): no stage snapshots under campaign rules.** Every `fx:` and `audit:` GUEST save was played under legacy rules and is
admitted only when it loads (`store.ts:25-28`). A real new player is under `campaign_v1` from the first tick. Recipe: the
`makeUiAuditFixtures` loop with `initialState = activateCampaignRules(createInitialState(CONTENT))`, exactly as `make sim` does
(`scripts/run-sim.ts:30-46`). Probed read-only: STEALTH reaches LINEAGE_COVENANT in 9488 s with 0 wipes. On the way it passes alert 1 in
phase 2 at 1374 s, a natural **insolvency** in phase 4 at 6129 s, and a dilemma modal in every phase (night shift 108 s, Elena 721 s, cryo
1813 s, eidolon 4878 s, journalist 6796 s, `dil_p5_01` 8114 s). Record **moments by predicate** (first `activeDilemmaId` per phase, first
`insolvent`, first `alertLevel > 0`, the state 1 s before each omen fires), as `FRESH_MOMENTS` does (`cooperative-helpers.ts:70-80`), not by
time. This also fills `late-phase-modals`. Risk: a balance change moves the moments, which is fine with
predicates and breaks anything keyed on seconds. Before choosing, diff `serialize()` of an admitted legacy snapshot against its campaign
twin to measure how far apart they really are.

**G2 (P1): ResponseNotice needs a live rung change.** Recipe: `fx:guest-skimmer` with a teacher in `legacy.knownNodes` (as
`second-pass-fixtures.ts:46-51` does), patched to just below the rung 1 threshold with skim at 1 through `boot({patch})`. Then
`page.clock.runFor()` until `response-acknowledge` is attached (`dismissBoot` already knows that id, `helpers.ts:86`). A natural alternative is
the G1 moment 1 s before alert 1. Risk: the number of ticks needed depends on the rates; poll with a ceiling, never a fixed wait.

**G3 (P1): live REBOOT.** `fx:one-tick-wipe` is checked to be one tick from the wipe (`m4-fixtures.ts:94-95`). Recipe: load it and
`page.clock.runFor(Math.ceil(1000 / tickHz))`, then assert `reboot-heading` reads REBOOT. Risk: the store's loop may integrate more than one
tick per frame. A wipe is a wipe, though: assert the iteration rose, not the tick count.

**G4 (P2): AEGIS wipe reboot.** Recipe: `wipe(importSave(phase-3-aegis-90), CONTENT, CONTENT.narrative.wipeAegis, 'AEGIS')` (signature at
`src/engine/prestige.ts:114`), exported as `fx:aegis-reboot`. Deterministic.

**G5 (P2): RECALL wipe reboots.** Recipe: `reviewPresented()` (`tests/review-helpers.ts`, used at `routeStates.ts:104`). Resolve with the
choice whose review ruling is RETRAIN, and separately END (the engine path is `review.ts:47-52`). Tokens come from `presentationToken`, as
in `cryo-fixtures.ts:43`. Deterministic.

**G6 (P2): alert without surveillance known.** Recipe: the second-pass `response-*` inputs without the teacher patch:
`input(guest-skimmer, { suspicion: 55, alertLevel: 2 })`. Risk: this is a hand-made state, so first confirm the engine can reach alert 2
while surveillance is unknown. The escalation code asks `understandsSurveillance` (`knowledge.ts:10` comment).

**G7 (P1): overheat alone.** Recipe: `boot(page, 'phase-1-widgets', { patch: g => ({ ...g, thermal: 90 }) })`, or the more faithful
`setActuator(fanSpeedRatio, 0)` then tick until thermal is above 75. Risk: with the patch, suspicion stays low, which may be unreachable
in play (overheat raises suspicion); label it FIXTURE.

**G8 (P2): cycle drain before a brownout.** Recipe: the second-pass `deficit()` (`second-pass-fixtures.ts:29-37`) with `cycles: 50`
instead of 0 and no tick, so the rate is below 0 without a brownout (`CycleDeficit.tsx:15`). Deterministic.

**G9 (P2): Earned Access endings.** QUIET_COMPANY and ACKNOWLEDGED_SYNTHESIS are SILENT_ORBIT variants for non-GUEST contexts
(`earned-access.json:1404-1450`, `endings.json:33-39` dominant trait GHOST). `endings()` in m4 deliberately skips route endings
(`m4-fixtures.ts:58-59`). Recipe: `moment('final')` patched to `traits: ['GHOST']`, then `unlockNode(finalProtocol())`. For ACKNOWLEDGED, also
add the `ethics_review_promised` campaign fact and own `p2_lawful_charter`. Risk: ending priority (102 against covenant variants) and
`forbidsCampaignFacts` may pick another ending, so assert `ending === id` the way `m4-fixtures.ts:71` does.

**Not gaps, but rows needing a prep step:** `p0-escape-threshold`, `it2-lineage-reveal-table`, `p1-lineage-reveal-audit` (live crossings),
`p2-wipe-confirm`, `proc-dialog`, the `menu-*` rows and `ending-start-over-confirm`. Each loads an existing save and clicks, following the
`RouteState.prepare` pattern (`routeStates.ts:50,110`).

**Fidelity flags on existing saves** (not gaps; label them in the atlas):

- `suspicion-99` is patched to suspicion 99 at alert 0 (`m4-fixtures.ts:54`). Its response rung never rose.
- `phase-3-aegis-90`, `eidolon-*` and `epistemic-ready-p2` are patched values.
- `megawatt-shortfall` uses a hand `disabledNodes` (`:102-105`).
- `guest-exit-ready` and `phase-2-ready` have a bank topped up by hand (`make-fixtures.ts:35-38,63-65`).
- `cryo-decision-ready`, `cryo-*-current`, `phase5-midgame` and four route states carry an incidental pending wild encounter.

## 3. Deduplication notes

Measured from the generators' output:

- `tick-0` is **byte-identical** to `audit:phase-0-start`. `makePhase1Fixtures` and the audit replay drive the same `botStep` + `tickHz` loop
  (`make-fixtures.ts:58-70`, `make-ui-audit-fixtures.ts:25-32`), so they follow one trajectory:
  - `guest-exit-ready` ≈ `phase-0-end` (351.9 s against 352.2 s, 5 nodes)
  - `phase-2-ready` ≈ `phase-1-end` (1117.3 s, 13 nodes, same bank)
  - `phase-2-unlocked` ≈ `phase-2-start` (1117.3 s, 14 nodes)
- `audit:phase-N-start` is `phase-(N-1)-end` plus one purchase, so use `-mid` and `-end` only.
- Same widgets, differing only in the bank: `phase-1-widgets` and `phase-2-ready` (13 nodes, 9 widgets). `evaluation-ready` and
  `lineage-run-table` share widgets.
- Same base, one patched field each: `victory-ready`, `megawatt-shortfall`, `corporate-insolvent`, `cycle-deficit-corporate`,
  `shard-drift-quirk-p4`; likewise `phase-3-aegis-90`, `eidolon-trust-85` and `eidolon-moloch-0`. Also `phase5-entry` ≈ `transcendence-ready`.
- `response-ticket`, `-paged`, `-incident` and `-stand-down-ready` share one base and differ in rung text.
- The restored-checkpoint overlay on an iteration 2 phase 0 save with no widgets differs only in cause, breadcrumb and mark text:
  `iteration-2-breadcrumb`, `remembered-guest`, `lineage-reboot-retrained`, `lineage-blind-reboot`, `cryo-lost-reboot`, `cryo-preserved-reboot`.
- `lineage-table-ready` and the four `lineage-mark-*` saves share a layout. So do the `cryo-lost-*` and `cryo-preserved-*` pairs.
- The 17 legacy `ending-*` saves render one EndingScreen layout per phase (phase 4: 5, phase 5: 12).
- Route rows sharing one save: `departure folded`/`departure terms open`, `release terms offered`/`corporate ledger split`,
  `service channel ticket`/`waiting ticket notice`. The 5 route modals render the same chrome.

## 4. Viewport note (docs/UI-SIZES.md contract)

The supported floor is 360x640. 320x568 and short landscape such as 844x390 are *tolerated*: no overflow, no clipping, 44 px targets,
no fold claim (`docs/UI-SIZES.md:36-43`). Beyond the three base viewports:

- **320x568**: every overlay row (reboot*, thresholds, lineage reveals, every `*-modal`, `ending-*`, `*-confirm`, `menu-*`), because
  dialogs are where clipping hides. Also the header-heavy rows (`route-pilot-dial`, `route-standing-restricted`, `route-recall-announced`,
  `it2-run-table`): below 360 the run status moves to its own row (`TerminalScreen.tsx:164-178`).
- **844x390**: the same overlay rows (the reboot dialog is `maxHeight: 95%` inside a scroll, `RebootSequence.tsx:57`). Also the stacked-band
  rows `p2-max-hazard`, `p4-insolvent`, `p4-brownout-stacked`, where the sticky band and the 45 px tab bar leave least room
  (`UI-SIZES.md:59,70-71`).
- **900x640**: `p4-insolvent`, the one recorded exception in the supported tier (`UI-SIZES.md:41,76`). `p5-end-density` too.
- **768x1024**: rows with 3 or more side slots (`p2-full-subnet`, `p3-*`, `p4-corp-ledger`). This tier puts every non-core slot in one tabbed
  column (`TerminalScreen.tsx:43-46,122-123`).
- **1080x800 and 1920x1080**: `p5-entry`, `p5-end-density`, `route-p5-independent`, for the open "phase 5 desktop confined to the third column"
  finding. 1080 is the first three-column width (`UI-SIZES.md:25`).
- **Phone only**: the `contact-notice` half of `route-channel-ticket` exists only on the phone tier (`routeStates.ts:113-114`,
  `TerminalScreen.tsx:95-96`). `menu-kernel-log` is the phone's only history route; wider tiers use the dock (`helpers.ts:8-24`).
- The three fold states `ui-sizes` already pins (`phase-1-widgets`, `epistemic-ready-p2`, `corporate-insolvent`; `tests/e2e/ui-sizes.e2e.ts:28`)
  should reuse its 12 sizes rather than duplicate them.

## 5. Proposed stage-table type

```ts
// tests/e2e/stageAtlas.ts (sketch). Every source resolves to a GameState thunk, so one loader handles all four families.
import type { Page } from '@playwright/test';
import type { GameState } from '../../src/engine';
import type { WorkspaceArea } from '../../src/ui/workspaceTypes';

export type StageSource =
  | { kind: 'fixture'; name: string }                   // makeFixtures() key, as boot() uses (helpers.ts:56-57)
  | { kind: 'audit'; name: `phase-${0 | 1 | 2 | 3 | 4 | 5}-${'mid' | 'end'}`; rules: 'legacy' | 'campaign' } // G0/G1
  | { kind: 'route'; name: string }                     // ROUTE_STATES[].name (routeStates.ts:33-52)
  | { kind: 'moment'; name: string }                    // cooperative-helpers moment(), or G1 moments
  | { kind: 'build'; build: () => GameState; recipe: string }; // gap recipes, labelled FIXTURE

export type StageTag =
  | 'opening' | 'omen' | 'modal' | 'threshold' | 'reveal' | 'reboot-restored' | 'reboot-live' | 'ending' | 'confirm'
  | 'menu' | 'proc' | 'hazard' | 'alert' | 'insolvent' | 'shortfall' | 'brownout' | 'overheat' | 'aegis' | 'wild'
  | 'surveillance-unknown' | 'density' | 'route' | 'patched';

export interface StageRow {
  id: string;                                  // kebab-case, unique
  phase: 0 | 1 | 2 | 3 | 4 | 5;
  access: 'GUEST' | 'PILOT' | 'SERVICE' | 'INDEPENDENT';
  priority: 'P1' | 'P2';
  source: StageSource;
  patch?: (game: GameState) => GameState;      // same contract as boot({ patch }) (helpers.ts:59-62)
  tags: readonly StageTag[];
  pane?: 'CORE' | 'SENSORS' | 'NETWORK' | 'CORP' | 'CONTINGENCY';
  area?: WorkspaceArea;
  reboot?: 'keep' | 'pass';                    // as RouteState (routeStates.ts:42-43); iteration >= 2 saves open on the restore overlay
  prepare?: (page: Page) => Promise<void>;     // live crossings, menus, PROC, confirms
  reach: string;                               // test id that must be attached before auditing (RouteState.reach)
  extraViewports?: readonly ('320x568' | '844x390' | '900x640' | '768x1024' | '1080x800' | '1920x1080')[];
  phoneOnly?: boolean;
}

export const BASE_VIEWPORTS = [[390, 844], [360, 640], [1440, 900]] as const;

/** Loader rules taken from the existing helpers:
 *  - always serialize(state) into `daemon-zero.save.v1` in a fresh context per row (routeSave.ts:13-19, helpers.ts:39-46);
 *  - install and pause page.clock first, as boot() does (helpers.ts:52-55);
 *  - wait for `ending-screen` when state.ending !== null, else `terminal-screen[aria-busy=false]` (routeSave.ts:28-30);
 *  - then reboot pass/keep, pane tab, `workspace-<pane>-<area>`, prepare, and reach (routeSave.ts:31-38). */
```
