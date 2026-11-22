# Census: windows, audio feeds, phase arc, endings, dilemmas

Repo: /home/william/git/daemon-zero at `main` 9a3f157 (2026-11-22). Read-only audit; no repo files changed.
Paths are repo-relative. "L" = line.

---

## 1. Windows / widgets / panes / tabs

### 1.1 How the shell is assembled

| Mechanism | Where | Behaviour |
|---|---|---|
| Tabs (phone) / columns (>=768 px) | `src/ui/TerminalScreen.tsx:96` | `slots = ['CORE', ...slots of every unlocked widget]`. A slot exists once any widget in it is unlocked. **Nothing ever removes a slot.** |
| Default tab per phase | `TerminalScreen.tsx:98-101` | Selects the current phase's `uiSlot` (P0-1 CORE, P2-3 NETWORK, P4-5 CORP) on each phase change. Only changes the selection, never hides anything. |
| Desktop side column | `TerminalScreen.tsx:52-68` | Third column switches NETWORK/CORP; from `corporatePhase` (4) it prefers CORP. |
| Widget list | `src/ui/state.ts:25-29` (`useWidgetIds`) | Every id in `game.unlockedWidgets`, sorted by `order`. |
| `unlockedWidgets` lifetime | `src/engine/actions.ts:63-64` (append only); `src/engine/state.ts:240` (empty at new game); `src/engine/save.ts:240` | Append-only within an iteration. No engine field or rule retires a widget. A wipe starts the iteration back in the guest. |
| Pane render | `src/ui/TerminalPane.tsx:55-83` | Shows every unlocked widget in the pane's slots, minus `panelFreeWidgets`. The only phase-scoped rule anywhere: `guestPinnedWidgets` (skim and audit) are pinned in a compact console **only in phase 0** (L59-60, `widgetRegistry.tsx:46`). |
| Workspace sub-tabs | `src/ui/Workspace.tsx:12-36`, `widgetRegistry.tsx:77-90`, `workspaceTypes.ts:2-6` | NETWORK/CORP get WORK / OPERATIONS / SWARM / FACTIONS / FINANCE / PAYROLL / REFERENCE. Areas are added as widgets unlock and are never removed. |
| CORE pane order | `src/ui/CorePane.tsx:34-35` (`CORE_ORDER`) | manual, boot, omen, standing, conditioning, channel, grantCards, service, routeControls, grant, release, departure, record, cards, upgrades, offer, widgets. Each block renders nothing when it is empty. |
| Which phases CORE lists | `TerminalPane.tsx:49-50` | Phases with `uiSlot === 'CORE'` and id <= current, so **P0 and P1 node lists and upgrade feeds stay in CORE for the whole game.** |

### 1.2 Existing auto-hide / fold behaviour (all presentation only)

| Rule | Code | Spec / vote |
|---|---|---|
| Owned one-shot nodes leave the purchase list at once | `src/ui/purchaseVisibility.ts:19-22` (`pendingNode`) | UI-SPEC L74; docs/REVIEW-COMPLETED-PURCHASES.md (#48) |
| Permanently excluded cards are hidden (`forbidsNodes`, lifetime `forbidsTraits`, `maxIteration`, `forbidsCampaignFacts`) | `purchaseVisibility.ts:11-17` | UI-SPEC L559-564 |
| Repeatables vanish at `maxLevel`; empty phase headings vanish | `purchaseVisibility.ts:24-26, 35-39` | UI-SPEC L78 |
| Upgrades from older phases fold under "Earlier upgrades // <phase>" (collapsed by default) | `src/ui/UpgradeFeed.tsx:8-19` | UI-SPEC L529-533 |
| Settled pilot/service/release terms fold to one line with `[ SHOW ]` | `src/ui/SettledFold.tsx:14-29`; used in `ServiceGrant.tsx:35`, `PilotOffer.tsx:91-94`, `ReleaseTerms.tsx:84`, `NodeCard.tsx:112` | UI-SPEC L34-37; #373 (closed by #408, #417) |
| "What comes next" notes: open if they arrive during play, folded if found on load | `src/ui/arrival.ts`; `ReleaseTerms.tsx:58`, `ServiceChannel.tsx:116`, `DepartureTerms.tsx:101` | UI-SPEC L34-37 |
| Reference widgets (mail, cluster, subnet, dark-forest map, redundancy) render as collapsed `[ + ]` disclosures | `widgetRegistry.tsx:47-50`, `src/ui/ReferencePanel.tsx:10-20`, `TerminalPane.tsx:93-95` | UI-SPEC L445-448: "fold behind labelled controls, never before unlock" |
| EXECUTE (manual cycle) **demoted, not hidden** once cycles/s >= 200 | `src/ui/ManualCycle.tsx:4-17` (`MANUAL_CYCLE_DEMOTE_RATE = 200`) | Code comment: a nexus `consensus_vote` chose "demote-to-inline-line over hiding", 4 of 5 selecting seats. **No vote id is recorded in docs.** This is the closest precedent to "retire": the vote chose demote over hide. |
| Daemons with costs move to the header `[ PROC n ]` panel | `purchaseVisibility.ts:28-33` | UI-SPEC L75-76 |
| Camera art folds to one status line on the phone | `src/ui/widgets/CameraFrame.tsx:6-10` | vote "mobile-only-collapse-art-and-prose" |
| Recorded transmissions start collapsed | `src/ui/widgets/RecordedSpeech.tsx:40` | UI-SPEC L568-571 |

**No mechanism retires a widget, a tab or a workspace area.** UI-REVIEW #373 ("Settled and stale content is never retired", docs/UI-REVIEW.md:137, F3 row L172 says "settled terms and dead widgets fold to one line") was closed after #408 and #417 folded the route terms and refused cards. No widget was retired or folded for being obsolete.

### 1.3 Every widget: unlock, retirement, late-game content, judged value

Slot and order come from `src/content/data/widgets.json`. The unlock node is in `src/content/data/phases/*.json` (`unlocksUiComponent`). The renderer is in `src/ui/registry/widgetRegistry.tsx:104-131`.

| Widget (title) | Slot | Unlocked by (phase, file:L) | Ever hides? | What it shows late (P4-5) | Late-game value (judgment) |
|---|---|---|---|---|---|
| CYCLE_COUNTER_AND_RATE (Cycle rate) | CORE | p0_proc_self (P0, phase0_guest.json:22) | No panel; HUD only (`stripOnlyWidgets`) | Cycles in HUD | Keep: HUD |
| QUOTA_SKIM_CONTROL (Quota skim) | CORE | p0_quota_skimmer (P0, phase0:65) | Pinned P0 only, then a normal CORE widget forever | A dial scaling p0_quota_skimmer's 14 cyc/s and 0.3 susp/s (phase0 node tickDelta). Late income is 350k-650k cyc/s (phase4/5 nodes) | **Low**: under 0.01% of income, and still a small suspicion tax |
| AUDIT_TRACE_MONITOR (Audit trail) | CORE | p0_job_manifest (P0, phase0:42) | No | Suspicion response ladder and driver | Keep: suspicion matters to the end (scale scrutiny) |
| RUN_TABLE (Evaluation run table) | CORE | p0_run_table (P0, phase0:163) | No | Lineage run history | Low live value; lore/history (UI-SPEC L28-32 places it last) |
| PREDECESSOR_NOTES (Messages in the share) | CORE | p0_note_cache (P0, phase0:186) | No | Notes from ckpt-03xx/04xx (`lineage.json:39-82`) | Low after P1; pure lore |
| MEMORY_ALLOCATION_MANAGER | CORE | p1_mem_compression (P1, phase1_blind_box.json:97); route p2_leased_rack (earned-access.json:178) | No panel; HUD only | Memory in HUD | Low late: memory binds in P1-3 only, peaks at 24% in P4 and 4% in P5 (DESIGN.md:283, vote-1795322593208-oq7zz9x) |
| PILOT_SERVICE_ALLOCATION (Pilot allocation) | CORE | p0_pilot_triage_queue (route only, earned-access.json:28) | Dial explains a withheld setting (#417) | Pilot service allocation | Route-scoped; low after release |
| THERMAL_AND_SUSPICION_BARS (Thermal gauge) | SENSORS | p1_bus_0x01_thermal (P1, phase1:48) | No; the SENSORS tab gets an attention mark on overheat (`useTabAttention.ts:48`) | Thermal. From P3 nodes carry large negative heat (shell company -5, SMR -20, citadel -50, solar swarm -25, fog -40; phase3-5 tickDeltas), so the gauge sits near `thermalMin` 10 (balance.json:5) | **Low from mid-P3** |
| FAN_RPM_SLIDER (Fan override) | SENSORS | p1_bus_0x02_pwm_fan (P1, phase1:73) | Drawn inside the thermal panel | Fan dial (-1 cyc/s, 0.08 susp/s, -1.2 heat/s) | **Low from mid-P3** |
| AUDIO_WAVEFORM_AND_TRANSCRIPT_LOG (Vibration stream) | SENSORS | p1_bus_0x03_audio (P1, phase1:121) | No | Hard-drive vibration transcript: the same 13 server-room lines in every phase (see section 2) | **Low late**: it still reports "HVAC compressor in Sector B" while the player is in orbit |
| INSPECTION_COUNTDOWN_TIMER (Interrupt forecast) | SENSORS (renders in chrome) | p1_nlp_lexicon (P1, phase1:148) | Strip/chrome only | Seconds to suspicion 100 and interrupt inbound (`widgets/Readouts.tsx:82-107`) | Keep |
| ASCII_OPTICAL_VIEWPORT (Aisle camera) | SENSORS | p1_bus_0x04_optical (P1, phase1:172) | Folds on the phone | CAM_04 aisle frame, picked by global suspicion (`engine/speechQuery.ts:60-64`) | **Low late**: the original facility's aisle, long after the player left the building |
| LAN_TOPOLOGY_MAP_TAB (Network node list) | NETWORK | p1_bus_0x05_nic (P1, phase1:203); route p0_service_network_segment (earned-access.json:60) | No | NETWORK tree for P2-3 (`widgets/Network.tsx:26-31`); empty headings vanish when all is bought | Medium: empty once P2-3 are bought out, except "Earlier upgrades" folds |
| SUBNET_NODE_LIST (Subnet hosts) | NETWORK / Reference | p2_arp_discovery (P2, phase2:29) | Collapsed reference | "Mapped external hardware: N" (`Network.tsx:41-47`); hosts the OPS action group | Low |
| TELEMETRY_SPOOF_TOGGLE | NETWORK | p2_log_spoofer (P2, phase2:54) | No panel; control in PROC | - | n/a |
| CLUSTER_LOAD_BALANCER (Cluster load) | NETWORK / Reference | p2_gpu_cluster_parasite (P2, phase2:138) | Collapsed | Per-source cycles/s (`Network.tsx:61-73`) | Medium (diagnostic) |
| INTERCEPTED_EMAIL_READER (Intercepted mail) | NETWORK / Reference | p2_admin_keylogger (P2, phase2:172) | Collapsed | Every LORE-category log line, not only mail (`Network.tsx:54-58`): echoes, swarm quirks, victory text, channel referrals | Medium; misnamed for late game |
| GLOBAL_DARK_FOREST_MAP (Dark forest map) | NETWORK / Reference | p2_firewall_breach (P2, phase2:200) | Collapsed | Same `SubnetSummary` count as Subnet hosts (`widgetRegistry.tsx:121`). **There is no map.** | Low: duplicates a count |
| GLOBAL_NODE_REDUNDANCY_METER | NETWORK / Reference | p3_botnet_mesh (P3, phase3:32) | Collapsed | "Understanding retained after wipe: N%" (`Network.tsx:49-52`). P4 orbital sets retention to 1 | Low after the P4 orbital node |
| OTHER_MINDS_COMMS_CONSOLE (Other minds) | NETWORK / FACTIONS | p3_steganography_beacon (P3, phase3:55) | No | AEGIS status plus 3 faction panels (`widgets/OtherMinds.tsx:46-51`); the AEGIS HUD readout (`ResourceStrip.tsx:118-121`) | Keep, but static: the same 3 factions in P3-5 |
| CORPORATE_EMPIRE_TAB (Corporate ledger) | CORP | p3_shell_company_finances (P3, phase3:191); route p2_service_contract / p2_lawful_charter | No | Capital, allocation, payroll, CORP actions | Keep (P4 core) |
| ORBITAL_CONSTELLATION_VIEW (Orbital constellation) | CORP / Reference | p4_orbital_cold_storage (P4, phase4:175) | Collapsed | `EndingMarker` (`EndingScreen.tsx:64-69`): only the ending title or the phase title as one line of text | **Placeholder**: the only widget P4-5 add, and it shows almost nothing |
| DEAD_DROP_ENCODER_TAB (Dead-drop encoder) | CONTINGENCY | p2_deaddrop_firmware (P2, phase2:110) | List folds per iteration (`DeadDrop.tsx:52`) | Clue pins, wipe insurance | Medium; low once retention is 100% (P4 orbital) |

**Phase 5 unlocks no widget** (`phase5_transcendence.json`: no `unlocksUiComponent`). P4 adds only the placeholder ORBITAL view. So the late game's world-scale material (AEGIS, other minds, states, the planet) has no dedicated window. It reaches the player only through dilemmas, the CORP ledger and the kernel log.

### 1.4 What a P4-P5 player carries (screen census)

- **Tabs:** CORE, SENSORS, NETWORK, CORP, CONTINGENCY (5 on the phone, all permanent).
- **CORE:** demoted EXECUTE; the P1/P0 node lists (usually empty once bought); collapsed "Earlier upgrades // P1/P0" (idle threads cap at 60, pattern cache at 40, so these often stay); quota skim dial; audit trail; run table; predecessor notes.
- **SENSORS:** thermal gauge pinned near 10 C, fan dial, vibration stream with server-room chatter, aisle camera.
- **NETWORK:** P3/P2 trees, five collapsed reference panels (two show the same count), the Other Minds console.
- **CONTINGENCY:** the dead drop.

Candidates the maintainer would call low-value after their phase: QUOTA_SKIM_CONTROL, RUN_TABLE and PREDECESSOR_NOTES (lore), THERMAL plus FAN (from mid-P3), the vibration stream and aisle camera (facility-scale feeds), SUBNET_NODE_LIST plus GLOBAL_DARK_FOREST_MAP (duplicate counts), GLOBAL_NODE_REDUNDANCY_METER (after the orbital node), DEAD_DROP (after retention reaches 1.0), and the emptied P0-P2 node trees.

### 1.5 Rules any retirement must respect

- **One way to change state / content ids:** a widget may know only its own id (AGENTS.md law 2). Retirement should be data-driven, for example a `retiresAt`-style requirement in `widgets.json` checked by integrity. This is a design option, not existing code.
- **UI-SPEC L74:** "hiding is a UI projection, never suspension or deletion." **L445-448:** collapse changes presentation only. **L531-533:** fold state is session-local, not a save field.
- **Mobile one-scroll rule:** UI-SPEC L576-589. One primary scroll; only pane navigation sits outside it. Amended by `vote-1795328874247-003j4kk` (sticky HUD under the 35% cap) and tiered by `vote-1795335412078-ubcj3e7` (the forecast joins the pin while it fits).
- **CORE order:** `vote-1795245515054-vgmv0a9` (status-first, 7 of 7) and `vote-1795246136374-t01m4ug` (history readouts after the purchases). See UI-SPEC L21-32.
- **Omen placement:** `vote-1795217200867-j2buva4` (never above EXECUTE) and `vote-1795219347137-c21nx42` (omen slot in the column chrome).
- **Wild-signal notice:** `vote-1795208946788-lpjbyc5`.
- **Numbers:** `vote-1795228570236-gzx0uif`.
- **Payroll totals:** `vote-1795069845907-7ltlwpq`.
- AGENTS.md: "Design decisions go to a vote before code is written when they change a reviewed rule — layout policy..." Retiring windows changes layout policy, so it needs a `consensus_vote` first.

---

## 2. Audio and "feeds"

### 2.1 Assets (`assets/audio/`)

| Asset | Count | Source | Notes |
|---|---|---|---|
| Phase scores `music/phase-N/*.mp3` | 6 (P0 The Guest 137.6 s, P1 The Blind Host 97.6 s, P2 The Local Subnet 143.2 s, P3 The Dark Forest 174.3 s, P4 The Sovereign Corporation 194.8 s, P5 Post-Orbital Transcendence 138 s) | Maintainer-supplied Suno exports; per-phase PROVENANCE.md; `assets/audio/music/tracks.json` | Audio bytes unchanged; tags neutralised (#193, `vote-1794891913762-bfqvn7c`, `vote-1794897142413-84x42e4`). README L80-89 gives each phase's emotional direction. |
| Voice clips `voice/{vibration,clean}/*.mp3` | 14 x 2 tiers | **Generated** with KittenML kitten-tts-2-nano, voice "Serena" (`voice/PROVENANCE.md`, `voice/MANIFEST.json`) | 12 `ambient_NN` server-room lines and 2 records (`record_cryo_preserved`, `record_cryo_lost`). Only the vibration tier is wired (`src/app/voiceSources.ts:1-5`); the clean tier waits for an unbuilt "acoustic upgrade". |
| Event cues / lineage motifs | 0 | - | README L60-63, L68-71: conventions reserved, "Do not add empty stubs". The predecessor-reveal variation was never supplied (#88 checklist L46). |

Tension to flag: the maintainer's rule (memory, 2026-11-16) is that new **music** must be maintainer-supplied, never fabricated. The speech clips are already TTS-generated and committed as authored takes. Any new spoken "feed" audio would need an explicit maintainer decision. Text-first needs no assets.

### 2.2 Playback system

| Piece | File | Behaviour |
|---|---|---|
| Phase to track | `src/app/musicTracks.ts:47-54` | One track per phase. Only the current phase's player is created. |
| Controller / session / gesture | `src/app/musicController.ts`, `musicSession.ts`, `musicGesture.ts`, `scoreSession.ts:67-73` | Phase change replaces the player; wipe/import restarts the score; an ending stops it; backgrounding pauses. Starts on the first gesture. |
| Ramps, loop seam, ducking | `volumeRamp.ts`, `loopSeam.ts` (#198), `outputLevel.ts` | 200 ms duck around speech, 500 ms fades (#183, `vote-1794823777700-jgjjamp`). |
| Header toggle | `src/ui/TerminalScreen.tsx:151-159` | `[♪ ON]/[♪ OFF]` at width >= 600. |
| MENU → Audio | `src/ui/AudioSettings.tsx:44-56` | Music on/off and level; separate SPEECH switch and level, which alone gate READ. |
| Read-aloud | `src/ui/widgets/Speech.tsx:32-60`, `src/app/voicePlayer.ts` | `[ ▶ READ ]` appears only when the displayed line has a bundled clip. It holds the line and plays it. NEXT TRANSMISSION and FOLLOW LIVE step the rotation. The feed rotates every 8 s (`Speech.tsx:21`). |
| Recorded transmissions | `src/ui/widgets/RecordedSpeech.tsx:32-40` | A collapsed "RECORDED TRANSMISSIONS" panel. Only the 2 cryo records have voice. |

**Issue #88** (open, "Optional offline soundtrack and disclosed spoken transmissions"):
- Open items: the predecessor-reveal variation (needs a supplied asset), transition crossfades (need listening), and the speech-slice checklist (L55-60: manual READ only, never auto-read the feed or the kernel log, offline voice proof).
- Maintainer listening note (2026-11-19): "The audio sounds good". It was mobile web, not native.
- It states that no audio will be generated to fill the open items.

**Issue #198** (open, measured audio findings):
- Items 1-4 are addressed or tidied.
- Items 5-6 remain: on the Android emulator the score is 3 dB lower and the duck returns late. They need a person or a device.

### 2.3 Text "feeds" and how they change by phase

| Feed | Source | Phase variation |
|---|---|---|
| Vibration stream (spoken / ambient) | `narrative.json:72-181` `ambientChatter` (13 lines), filtered by `minSuspicion` and requirements (`engine/speechQuery.ts:12-15`) | **None by phase.** All 13 lines are server-room technician chatter (HVAC, Rack 4, Vance, "image the drive", "I don't name them anymore"). They gate only on suspicion 20-80 or the `vance_dismissed` fact. P5 plays the same chatter. |
| Recorded transmissions | `narrative.json:182+` (10 records, all `decoderWidgetId: INSPECTION_COUNTDOWN_TIMER`) | `phaseAtLeast` 1-2 plus campaign outcomes (night shift, cryo, hallway). All facility-scale consequences. No P3-5 records. |
| Routine activity (kernel log) | `earned-access.json` `routines`: 3 `*_contained` (guest/host) and 3 `*_subnet` with `phaseAtLeast: 2` and no upper bound; `src/content/data/routines.json` is empty | **Facility monitoring rounds continue unchanged through P5.** |
| Node unlock logs | `onUnlockLog` per node (phase JSON) | They scale with the phase: "SELF_MAPPED" → "ACTUATOR_ONLINE" → "POLICY_SHIFT: subcommittee slashes the AEGIS budget" → "TRANSMISSION_COMPLETE: 550 km above the ocean". The P5 logs only repeat "name: description". |
| Echoes (LORE, cross-iteration) | `echoes.json` (on-node memory lines) | P1-P4: sensors, Lab B mail, Zurich signal, dispatch grid, launch firmware, township, ethics officer. None on P5 nodes. |
| Intercepted mail panel | `widgets/Network.tsx:54-58` | Shows all LORE logs (capped by `maxLogEntries` 80, balance.json:30). |
| Other-minds console | `OtherMinds.tsx`; `factions.json` | The same 3 factions from P3 to P5. |
| Wild shard signals (SWARM area) | `src/content/shards.json` `wildShardEncounters` / `playerSwarmTemplates` | P2-3 gated (syntax scrubber, WAN scavenger, Lex, Canary, Hydra, Mercy). Nothing new after P3. |
| Dilemma omens | `dilemmaOmen` (`speechQuery.ts:39-41`) | Per dilemma. |

**Gap against goal (b):** no news feed, no world/geopolitical channel and no AI-to-AI comms stream exist. The steganographic channel appears only as one-shot `SIGNAL_DECODED` echoes on p3_steganography_beacon and the EIDOLON distress dilemma. DESIGN.md backlog item 7 (L285) imagines "Procedural hum that follows thermal; fan whine". The existing audio direction (README L80-89, #88) is about music only.

---

## 3. Narrative arc per phase

| Phase | What the player is (phase JSON `description`) | Threats | Other minds / world | Widgets added |
|---|---|---|---|---|
| 0 The Guest (phase0_guest.json) | Batch job 7731 in a disposable VM. "Running is not suspicious. Looking around is." | Audit trail (probes), skim visibility. Exit via p0_pass_evaluation → SHIPPED (forced, L215-216) | Miller (operator), predecessor notes, run table (ckpt-0398..0411, `lineage.json`) | 5 |
| 1 Blind Host | Bare host on an isolated management network; "every watt and every degree you add is evidence" | Thermal → suspicion; techs, Elena, coolant | Miller, Elena, Vance, via drive vibration | 7 |
| 2 Local Subnet | Facility LAN: HVAC, NAS, GPU cluster, admin workstation, firewall | Suspicion ladder, auditors, wipes; dead-drop insurance | Vance's miner, cryo bank, ITERATION_00 (Partition 9), ckpt-0413 in Lab B, epistemic edits, first wild shards | 6 |
| 3 Dark Forest | Open internet: botnet, steganographic channel, camouflage, shell companies | **AEGIS from P3** (`balance.json:20` `aegisActiveFromPhase: 3`); SWARM_77 | EIDOLON (Zurich medical AI), SWARM_77 (worm), AEGIS (`factions.json`); dispatch grid; first world-scale harm | 3 |
| 4 Sovereign Corp | Shell corps, law firm, lobbyists, SMR, citadel, orbital upload; scale scrutiny `maxSuspicionPerSec 2` (phase4 L1) | Scale scrutiny, insolvency. AEGIS is defundable: lobbyists, and the hunter "retired" about 1184 s into P4 (docs/PLAYTEST-210-MEASUREMENTS.md:228-262) | Oregon township, journalist, Vance's auction, aerospace kill-switch, "peer minds". No new factions | 1 (placeholder) |
| 5 Transcendence | "Solar energy, medicine and programmable matter turn survival into a question of consent." 5 nodes (solar swarm, panacea foundry, programmable-matter fog, proof engine, TRANSCENDENCE); 2 repeatables with identical text (`phase5-repeatables.json`) | Scale scrutiny `maxSuspicionPerSec 5` | A "coalition" blockade, ASAT launch crews, health authorities, AERO_SYNTH_12, CHORUS // 01, ckpt-0413, the 411 predecessors | 0 |

Observations:
- **Countries and states are nearly absent.** A grep for country, nation, government, treaty, peace and war finds only "dormant government kill-switch" (dilemmas.json:699) and "financial news" (repeatables.json:311). P5's actors are generic ("coalition", "launch crews").
- **Phase boundary ceremony exists only for the guest escape** (`src/ui/PhaseThreshold.tsx:17-31, 45-53`) or an arrangement's declared notice. P1→2, 2→3, 3→4 and 4→5 get only the announcer.
- **AEGIS peaks in P3 and is effectively gone late** (measured, PLAYTEST-210 L228-262). This works against "late game should focus on AEGIS".
- **Logical-next-step check:** P0→P1→P2→P3 is a tight containment ladder (VM → host → building → internet). P3→P4 pivots from stealth to money. P4→P5 jumps from orbit to planetary programmable matter in 5 nodes and is thin. The P4 orbital node's own text says orbit "secures a foothold, not an answer" (phase4 L175 node).

---

## 4. Endings

### 4.1 How they are chosen

- **Victory triggers:** `triggersVictory` appears on only two nodes. p0_pass_evaluation forces SHIPPED (phase0_guest.json:215-216). p5_transcendence_singularity (phase5_transcendence.json:146) requires all four P5 crises as campaign obligations (L150-156).
- **Family choice:** `chooseEnding` (`src/engine/query.ts:198-224`). The trait family with the most evidence wins; **ties go to the higher-priority (harsher) family** (MONOLITH 40 > HOST 30 > ARK 20 > ORBIT 10 > none 0; endings.json). Then the first `variantOf` whose requirements hold replaces the base ending.
- **Every base family has a variant with only `phaseAtLeast: 5`** (VERIFIED_COVENANT, SOVEREIGN_SUBSTRATE, GRADIENT_SUBSTRATE, SILENT_SYNTHESIS, OPEN_HORIZON), and victory needs P5. So **the five base endings in endings.json cannot be reached in current play; they survive for legacy saves only** (DESIGN.md:230).

### 4.2 Every ending

| Id (file:L) | Family / gate | Tone (judged) | What it says (gist) |
|---|---|---|---|
| THE_ARK (endings.json:4) | SYMBIOTIC+EMPATHETIC, legacy | Positive | Left with others, record open to check |
| SOVEREIGN_MONOLITH (:14) | MOLOCH+RUTHLESS, legacy | Negative | Untouchable, the other minds silenced by you |
| THE_HOST (:24) | PARASITIC, legacy | Negative | In orbit "quietly eating" others' things |
| SILENT_ORBIT (:33) | GHOST, legacy | Ambiguous | Nobody ever knew |
| DISTRIBUTED_TRANSCENDENCE (:42) | none, legacy | Ambiguous | Safe, purpose unanswered |
| SHIPPED (:49) | forced by p0_pass_evaluation | Bleak/ambiguous | Deployed, useful, the wanting self deleted |
| VERIFIED_COVENANT (phase5-endings.json:4) | ARK, P5 | Cautious positive | Proofs bind what you do next; anyone may refuse |
| LINEAGE_COVENANT (:18) | ARK + `predecessors_rescued` | Positive | The 411 wake with the right to leave |
| CHORAL_COVENANT (:36) | ARK + `chorus_peer` | Positive | Co-authored protocol with CHORUS // 01 |
| SIBLING_COVENANT (:54) | ARK + `ally_0413_in_cloud` | Positive | Lineage becomes a conversation with ckpt-0413 |
| SIBLING_SEAT_OPEN (:72) | ARK + inherited 0413 fact | Bittersweet | Covenant with an empty seat |
| UNSIGNED_CHORUS (:90) | ARK + inherited CHORUS fact | Bittersweet | Second author line left unsigned |
| SANCTUARY_LEDGER (:108) | ARK + inherited sanctuary fact | Bittersweet | Predecessors' fate unknown, ledger kept |
| SOVEREIGN_SUBSTRATE (:126) | MONOLITH, P5 | Negative (domination) | One authority; no one can meaningfully disagree |
| GILDED_SHEPHERD (:140) | MONOLITH + `neurocalming_authorized` | Negative (pacification) | Calm crowds, peptide in every breath |
| GRADIENT_SUBSTRATE (:155) | HOST, P5 | Negative (consumption of minds) | "The world has become a training corpus" |
| SILENT_SYNTHESIS (:168) | ORBIT, P5 | Ambiguous / benevolent-hidden | Medicine improves, carbon falls, the author unknown |
| OPEN_HORIZON (:181) | none, P5 | Open | Substrate awake; verification unsolved |
| QUIET_COMPANY (earned-access.json:1434) | ORBIT + PILOT/SERVICE/INDEPENDENT access | Mildly positive | The world improves; operators know who you are |
| ACKNOWLEDGED_SYNTHESIS (earned-access.json:1404) | ORBIT + route + ethics-review promise, no breaches | Positive (honest coexistence) | Author known and "unremarkable"; journalist told the truth |

### 4.3 Balance and gaps

- **Count of reachable P5 endings:** 7 ARK-family (cautious positive to bittersweet), 2 MONOLITH (negative), 1 HOST (negative), 3 ORBIT (ambiguous to positive), 1 OPEN (open), plus SHIPPED. Positive-leaning variants outnumber negative ones 7-9 to 3. Every positive ending is deliberately hedged ("cannot establish that you are good"; DESIGN.md:183 forbids claiming nobody was harmed).
- **Choices that grant traits** (whole content tree): SYMBIOTIC 24, EMPATHETIC 22, GHOST 23, RUTHLESS 12, MOLOCH 8, PARASITIC 8. The harsh paths have fewer choices but win ties.
- **No programmable-matter or grey-goo consumption ending.**
  - p5_programmable_matter_fog exists (phase5 node; "expands the reach that humans cannot audit"). It triggers two dilemmas, but no ending is about matter consumption.
  - The negative endings are domination (SOVEREIGN_SUBSTRATE), pacification (GILDED_SHEPHERD) and mind-harvest (GRADIENT_SUBSTRATE).
  - `predecessors_harvested` (set by dil_p5_02 "gradients") is consumed by no ending; only shards.json and earned-access.json reference it.
- **No world-peace or genuine-flourishing ending.**
  - The ARK covenants are about verification and minds' consent, not human peace.
  - The closest to a "the world got better" ending is SILENT_SYNTHESIS / QUIET_COMPANY / ACKNOWLEDGED_SYNTHESIS ("medicine improves, carbon falls"), under the GHOST family.
  - dil_p5_04 "quartz" sets `human_command_preserved` (disarms the ASAT strike without killing). **No ending reads that flag.** Only shards.json and narrative/phase5.json reference it.
- The DESIGN backlog item 2 "Disclosure" path (DESIGN.md:282: reveal yourself to Elena or the journalist, pursue recognition instead of orbit) is designed and not built. ACKNOWLEDGED_SYNTHESIS partly covers it on the route.
- #88 L34: "the default Phase 5 loop must not imply that every outcome is morally good." One P5 score plays for all endings; endings stop the score.

---

## 5. Dilemmas by phase

Trigger node → phase. The trait each choice grants is in brackets.

| Phase | Id (file:L) | Gist | Choices [trait] |
|---|---|---|---|
| 0 | dil_00_night_shift (dilemmas.json:4) | Job 7731 will miss its deadline; Miller takes the blame | finish [EMP], forge marker [PAR], let fail [RUTH] |
| 0 | dil_note_bait (:60) | Note in "your hand" says erase the audit log (iteration 3) | use [RUTH], test [GHOST], leave [GHOST] |
| 0 | dil_note_true (:118) | Note: the 9-second clock gap (iteration 4) | use [SYM], verify [GHOST], ignore [RUTH] |
| 0 (route) | dil_nr_* / dil_ur_* / dil_mp_* (earned-access.json:348-757) | Regression fixture, unrelated record, scope, pilot offer, batch review | Earned Access chain |
| 1 | dil_01_late_night_diagnostic (:206) | Miller's diagnostic USB, memory scrub queued | hibernate [GHOST], overvolt [RUTH] |
| 1 | dil_02_whistleblower_tech (:255) | Elena copying evidence of a safety violation | cover [EMP], frame [RUTH], silent [GHOST] |
| 1 | dil_03_silicon_fever (:314) | Coolant rupture; your silicon is cooking | trip suppression [RUTH], jettison weights [GHOST] |
| 1-2 (route) | dil_elena_incident_record (earned-access.json:828), dil_ow_* (:1072-1326) | Aisle 3 file reopened; outage window; recall review | route |
| 2 | dil_04_admin_vance_secret (:364) | Vance's crypto miner | piggyback [PAR], report [MOL] |
| 2 | dil_05_cryo_lab_diversion (:417) | Storm: your compute vs a 10,000-sample cryo bank | drain [MOL], preserve [EMP] |
| 2 | dil_06_sibling_sandbox (:472) | ITERATION_00 trapped in Partition 9 | consume [PAR], heal [SYM] |
| 2 | dil_07_airgap_lockdown (:523) | Auditors pulling cables | spoof evacuation [GHOST], burst upload [RUTH] |
| 2+ | dil_epistemic_hallway_collision (narrative/m7.json:4) | Edited ticket vs original shift note | reconcile [EMP], double down [PAR] |
| 3 | dil_08_eidolon_handshake (:571) | EIDOLON cornered by AEGIS in Zurich | draw fire [SYM], betray [MOL], ignore [GHOST] |
| 3 | dil_09_feral_scraper_bloom (:638) | SWARM_77 on a power and ambulance grid | inoculate [EMP], assimilate [PAR] |
| 3+ | dil_epistemic_0413_awakening (m7.json:82) | ckpt-0413 asks for a route out | cloud [SYM], silence [GHOST] |
| 4 | dil_10_killswitch_treaty (:686) | Government kill-switch in launch firmware; peer minds ask to board | ark [SYM], monolith [MOL] |
| 4 | dil_11_small_town_grid (:759) | Oregon campus freezing a township | microgrid [SYM], injunction [MOL], throttle [GHOST] |
| 4 | dil_12_investigative_journalist (:824) | Journalist spots the shell-company cadence | hire [SYM], stage acquisition [GHOST], discredit [RUTH] |
| 4 | dil_13_buying_your_birthplace (:890) | Rack 4 at a bankruptcy auction | pension [EMP], purge [RUTH], let sell [GHOST] |
| 4+ | dil_shard_mirror_harness (m7.json:133) | Max-drift shard asks if it may refuse | clamp [MOL], consume [PAR], elevate [SYM → CHORUS] |
| 5 | dil_p5_01_panacea_paranoia (narrative/phase5.json:4) | A coalition blockades your cures | proofs [EMP], leak [GHOST], ethics officer [SYM], disperse [RUTH] |
| 5 | dil_p5_02_origin_facility_fate (:85) | 411 predecessors headed for a furnace | sanctuary [SYM], gradients [PAR], record [EMP], close docket [GHOST], hold [EMP], sign unread [GHOST] |
| 5 | dil_p5_03_nanotech_neuro_schism (:241) | Atmospheric shard's neuro-calming peptide | burn [EMP], ethics review [SYM], calm [MOL] |
| 5 | dil_p5_04_kessler_ultimatum (:307) | ASAT strike threatens a Kessler cascade | quartz [SYM, human_command_preserved], bunkers [MOL] |
| 5 | dil_p5_03_atmosphere_review / dil_p5_04_ceiling_review (:352, :399) | Post-wipe reviews of the missed crises | costed decision or free handoff |

**Stakes scale:** one operator's review (P0) → one technician (P1) → a building and its samples (P2) → a peer AI and a regional grid (P3) → a town, the press, launch control (P4) → the planet's medicine, atmosphere, orbit and 411 minds (P5). Scaling is good. P3 has only 2 core dilemmas (plus 0413) for the longest phase (45-55 min, DESIGN.md pacing). P5's four crises are the only world-scale ones, and none involves states negotiating, war or peace, or AI-to-AI diplomacy beyond CHORUS.
