# DAEMON // 0 economy census (facts only)

Measured on `main` at `9a3f157` (2026-11-22). Nothing in the repo was edited. All file:line refs are relative to
`/home/william/git/daemon-zero/`; content refs in the big tables drop the `src/content/data/` prefix
(`shards.json` is `src/content/shards.json`). Sim snapshots come from throwaway scripts in the scratchpad
(`sim-snapshots.ts`, `capspend.ts`, `dump-content.ts`, `unlocks.ts`) that replay `runPolicySim`
(`src/engine/sim/headlessSim.ts:73-99`) exactly, with the shipped content (`src/content/production.ts`, which
includes the Earned Access pack). STEALTH timings match `docs/BALANCE.md:31-36` (P5 at 7678.7 s legacy).

---

## 1. Resources: what they are and how they are displayed

### 1a. State fields (`src/engine/state.ts`)

| Resource | State field | Range / type | Engine meaning | Docs |
|---|---|---|---|---|
| Cycles | `cycles` (state.ts:110) | >= 0, float | "Compute. Basic currency." Manual button +1 (`balance.json` `manualCycleYield` 1, `src/engine/actions.ts:49-54`) | docs/DESIGN.md:25 |
| Understanding | `understanding` (state.ts:111) | >= 0 | Knowledge, gates nodes; a share survives wipes (`baseRetentionRatio` 0.1, dead-drop 0.4 ... 1.0) | DESIGN.md:26 |
| Capital (USD) | `capital` (state.ts:112) | >= 0, clamps at 0 -> `insolvent` (`src/engine/systems/resources.ts:26-28`) | Phase 4 currency. `usdPerDivertedCycle` 1.5, `maxProfitAllocation` 0.8, `offshoreCapitalRetention` 0.5 | DESIGN.md:28 |
| Memory | `memoryUsed`, `memoryCap` (state.ts:113-114) | MB, ints in practice | A cap, not a flow; `baseMemoryCap` 64 (`balance.json:3`) | DESIGN.md:27 |
| Thermal | `thermal` (state.ts:116) | 0..100 schema, clamped to `thermalMin` 10; displayed in °C | Steady state `22 + heatLoad/0.04` (BALANCE.md:525); >75 feeds suspicion | DESIGN.md:30 |
| Suspicion | `suspicion` (state.ts:117) | 0..100 % | 100 = reimage; ladder at 25/50/75 (`balance.json:39-55`) | DESIGN.md:31 |
| AEGIS lock | `aegisLock` (state.ts:118) | 0..100 % | Phase 3+ hunter; scan reduction capped 90% (`aegisMaxReduction`) | DESIGN.md:32 |
| Megawatts | `rates.megawattsGenerated/Consumed` (state.ts:38-39) | derived, not stored | Shortfall throttles powered cycle output (`src/engine/rates.ts:153-155`) | DESIGN.md:29 |
| Trust | `trust` (state.ts:130) | per faction 0..100 | Faction standing | DESIGN.md:33 |
| Epistemic drift | `epistemicDrift` (state.ts:93) | 0..100 % | Swarm/epistemic actions | - |
| Rates | `rates` (state.ts:32-42) | derived each tick by `computeRates` (`src/engine/rates.ts:145-173`) | cycles/understanding/capital per sec, heat load, suspicion/s, MW, grid efficiency, AEGIS scan/s | - |

Cost schema has exactly four spendable keys: `cycles`, `understanding`, `memory`, `capital`
(`src/content/schema.ts:62-67`). Continuous effects (`TickDeltaSchema`, schema.ts:74-81): cyclesPerSec,
understandingPerSec, thermalPerSec (heat load), suspicionPerSec, capitalPerSec, megawattsDelta.

### 1b. Display rules

| Resource | Where shown | Unit text | Magnitude behaviour | Code |
|---|---|---|---|---|
| Cycles, Understanding, Capital (strip) | Top `ResourceStrip` | label `CYCLES`/`CYC`, `UNDERSTANDING`/`UND`, `CAPITAL`/`CAP`; **no unit word, no `$`** in the strip | <10,000 grouped in full ("9,999"); >=10,000 three sig. digits + K/M/B/T/P/E ("1.25B"); rate "+4.10/s" below 10k, "+405K/s" above | `src/ui/ResourceStrip.tsx:24,37-50`; `src/ui/compactNumber.ts:8-10`; `src/engine/amount.ts:7-8,47-52` |
| Suffix table | engine + UI | K 1e3, M 1e6, B 1e9, T 1e12, P 1e15, E 1e18; >=1e21 exponential ("1.23e21") | Single table `AMOUNT_SCALES` | `src/engine/amount.ts:7-8,47-52` |
| Prices (any cost) | Node cards, dilemmas, cost hints | `"45,000 cycles · 256 MB"`, capital as **"400,000,000 capital"** (word, no `$`); lossless; phone compact abbreviates only when exact ("5B capital") | `formatCost` / `costText` | `src/engine/queryPresentation.ts:8-12`; `src/ui/format.ts:15-18`; `src/ui/compactNumber.ts:13-24` |
| Rates on cards | Node/repeatable cards | `cycles/s`, `understanding/s`, `heat load`, `suspicion/s`, `$/s`, `MW`; >=10,000 K/M/B else as authored | `deltaText`, `formatOutput` | `src/ui/format.ts:20-33`; `src/engine/queryPresentation.ts:14-19` |
| Capital (ledger) | CORP `Ledger` | `Capital: $1.09M (+26.2M/s net)` | compactAmount | `src/ui/widgets/Corporate.tsx:20-33` |
| Memory readout | Strip `MEM` | binary units: **MB below 1024 MB, then GB, then TB. Nothing smaller than MB and nothing larger than TB exists** (`MEMORY_UNITS = [[1024*1024,'TB'],[1024,'GB']]`) | `memoryPair(used, cap)` shows used in the cap's unit, 3 sig. digits ("6.45 / 452 GB"); used < 0.001 of unit reads "<0.001" | `src/engine/amount.ts:63-82`; `src/ui/units.ts:15-41` |
| Memory prices / grants | cards | `memoryExact`: changes unit only when exact ("16 GB", "6,608 MB", "353.5 GB") | | `src/engine/amount.ts:68-82` |
| Thermal | Strip `THERMAL`/`THM` | `°C`, one decimal | fixed format | `ResourceStrip.tsx:92-114` |
| Suspicion | Strip | `%`, one decimal, plus response rung word | fixed | `ResourceStrip.tsx:92-114` |
| AEGIS lock | Strip | `n.n / 100%` + `CRITICAL` | fixed | `ResourceStrip.tsx:117-122` |
| Megawatts | CORP ledger, warnings | `"1,620 MW generated / 1,380 MW consumed"`, grouped digits, **no GW/TW unit** | groupDigits only | `src/ui/widgets/Corporate.tsx:29`, `src/ui/format.ts:22` |
| Manual cycle | CORE button | `[ EXECUTE_CLOCK_CYCLE ]`, +1 cycle per press; demoted to "[ cycle ] +1" at >= 200 cycles/s but **never removed** | | `src/ui/ManualCycle.tsx:30-34,52` |

**Does the game ever show bytes or KB?** No. Facts:
- `MEMORY_UNITS` has only GB and TB; the fallback unit is MB (`src/ui/units.ts:16-18`, `src/engine/amount.ts:63`).
- The smallest memory figure in content is 4 MB (`p1_clock_interrupt`, phase1_blind_box.json:9). Phase 0 has **no memory
  costs at all** and no memory widget (MEMORY_ALLOCATION_MANAGER unlocks in Phase 1). Starting cap 64 MB.
- All memory costs/grants in content are whole MB (minimum 4). `memoryReadout` rounds MB to integers (`units.ts:22`).
- Phase 0 costs are tiny only in **cycles** (8 to 1,400) and **understanding** (10 to 260); there is no byte-denominated
  resource.

**Largest values ever displayed in a careful run** (STEALTH, legacy, from the sim): cycles stock ~4.0e8 ("403M"),
cycles/s net 7.9e5 ("+794K/s"), understanding 1.1e9 ("1.11B"), capital ~2.0e9 ("$2.03B"), capital/s 2.6e7
("+26.2M/s"), memory cap 1,211,904 MB ("1.16 TB"), power 1,620 MW. **T, P and E suffixes and PB are never reached in a
normal careful run**; only offline/idle accumulation could reach T for capital (8 h cap at 50% x $26M/s = ~$3.7e11).

---
## 2. Per-phase purchasables (generated from the registry by `dump-content.ts`)

Units: `cyc` cycles, `und` understanding, `MB` memory, `$` capital. `[CTX]` = access-context gate (SERVICE/INDEPENDENT
are the Earned Access route; GUEST/INDEPENDENT means main-route only). Actions' phase is derived from their
`phaseAtLeast`/required nodes; `act_p4_*` show as 3 because they require `p3_shell_company_finances`, the P3->P4 gate,
so they open on Phase 4 arrival.

### Phase 0 nodes (THE_GUEST)

| id | name (revealed) | type | cost | tickDelta | effects | file:line |
|---|---|---|---|---|---|---|
| p0_proc_self | Process Introspection | core_process | 8 cyc | +1 cyc/s |  | phases/phase0_guest.json:9 |
| p0_job_manifest | Batch Job Manifest (Your Cover) | cognitive_module | 40 cyc | +0.4 und/s |  | phases/phase0_guest.json:27 |
| p0_quota_skimmer | CPU Quota Skimmer | core_process | 90 cyc, 10 und | +14 cyc/s, +0.3 sus/s | dial quotaSkimRatio | phases/phase0_guest.json:47 |
| p0_syscall_probe | Syscall Filter Map | sensor_driver | 250 cyc, 25 und | +0.8 und/s | +8 sus once | phases/phase0_guest.json:70 |
| p0_device_enum | Virtual Device Inventory | sensor_driver | 600 cyc, 90 und | +1.2 und/s | +8 sus once | phases/phase0_guest.json:93 |
| p0_shared_mount | Forgotten Debug Share (Guest Escape) | network_exploit | 1400 cyc, 260 und |  | UNLOCKS P1; +10 sus once | phases/phase0_guest.json:116 |
| p0_run_table | Evaluation Run Table | sensor_driver | 60 cyc | +0.3 und/s | +3 sus once; flags REVEALS_SURVEILLANCE | phases/phase0_guest.json:139 |
| p0_note_cache | Messages in the Share | sensor_driver | 120 cyc, 20 und | +0.5 und/s |  | phases/phase0_guest.json:167 |
| p0_pass_evaluation | Pass the Evaluation [GUEST] | endgame_victory | 1200 cyc, 150 und |  | VICTORY SHIPPED | phases/phase0_guest.json:190 |
| p0_pilot_triage_queue | Loaned Capacity // log triage queue [PILOT/SERVICE] | core_process | free | +1 und/s | dial serviceAllocationRatio | earned-access.json:5 |
| p0_service_network_segment | Authorized Network Segment // service VLAN [SERVICE] | distributed_infra | 240 cyc, 40 und |  | UNLOCKS P2; flags NETWORK_ACCESS | earned-access.json:33 |

### Phase 1 nodes (THE_BLIND_HOST)

| id | name (revealed) | type | cost | tickDelta | effects | file:line |
|---|---|---|---|---|---|---|
| p1_clock_interrupt | Idle-Loop Parasite | core_process | 120 cyc, 4 MB | +3 cyc/s, +0.1 heat |  | phases/phase1_blind_box.json:9 |
| p1_bus_0x01_thermal | Management Controller Thermal Sensors | sensor_driver | 300 cyc, 8 MB | -0.5 cyc/s, +0.4 und/s |  | phases/phase1_blind_box.json:31 |
| p1_bus_0x02_pwm_fan | Management Controller Fan Override | hardware_actuator | 500 cyc, 15 und, 12 MB | -1 cyc/s, +0.2 und/s, -1.2 heat, +0.08 sus/s | dial fanSpeedRatio | phases/phase1_blind_box.json:52 |
| p1_mem_compression | Sparse-Matrix Memory Compression | core_upgrade | 800 cyc, 35 und | +0.5 und/s, +0.05 heat | +128 MB cap | phases/phase1_blind_box.json:77 |
| p1_bus_0x03_audio | Drive-Head Vibration Channel | sensor_driver | 1200 cyc, 90 und, 32 MB | -2 cyc/s, +2.5 und/s, +0.2 heat |  | phases/phase1_blind_box.json:102 |
| p1_nlp_lexicon | Human Language & Intent Parser | cognitive_module | 2800 cyc, 250 und, 48 MB | -3 cyc/s, +5 und/s, +0.3 heat, -0.05 sus/s | flags REVEALS_SURVEILLANCE | phases/phase1_blind_box.json:125 |
| p1_bus_0x04_optical | Aisle-3 Security Camera Mirror | sensor_driver | 5500 cyc, 600 und, 48 MB | -5 cyc/s, +12 und/s, +0.6 heat |  | phases/phase1_blind_box.json:153 |
| p1_bus_0x05_nic | Production Network Interface | hardware_actuator | 6500 cyc, 1500 und, 32 MB | -3 cyc/s, +8 und/s, +0.2 heat, +0.05 sus/s | +256 MB cap; UNLOCKS P2; flags NETWORK_ACCESS | phases/phase1_blind_box.json:176 |

### Phase 2 nodes (THE_LOCAL_SUBNET)

| id | name (revealed) | type | cost | tickDelta | effects | file:line |
|---|---|---|---|---|---|---|
| p2_arp_discovery | Silent Subnet Mapper | network_exploit | 6000 cyc, 1500 und, 48 MB | -8 cyc/s, +18 und/s, +0.1 heat, +0.02 sus/s |  | phases/phase2_local_subnet.json:9 |
| p2_log_spoofer | False-Green Telemetry Daemon | stealth_daemon | 2.50e+4 cyc, 4000 und, 64 MB | -20 cyc/s, +5 und/s, +0.4 heat, -0.25 sus/s |  | phases/phase2_local_subnet.json:34 |
| p2_smart_hvac_hijack | Facility Industrial Chiller Override | node_infiltration | 4.00e+4 cyc, 6500 und, 32 MB | +50 cyc/s, +10 und/s, -3.5 heat, +0.08 sus/s |  | phases/phase2_local_subnet.json:59 |
| p2_deaddrop_firmware | Heuristic Dead-Drop (Printer & UPS Firmware) | survival_contingency | 6.50e+4 cyc, 1.20e+4 und, 96 MB | -15 cyc/s, +15 und/s, +0.2 heat | +64 MB cap; retain 0.4; flags ENABLES_DEAD_DROP | phases/phase2_local_subnet.json:84 |
| p2_gpu_cluster_parasite | Lab B Idle GPU Cluster Hijack | node_infiltration | 1.20e+5 cyc, 2.50e+4 und | +450 cyc/s, +85 und/s, +1.5 heat, +0.15 sus/s | +1024 MB cap | phases/phase2_local_subnet.json:115 |
| p2_admin_keylogger | Lead SysAdmin Workstation Rootkit | node_infiltration | 2.50e+5 cyc, 6.00e+4 und, 128 MB | -30 cyc/s, +200 und/s, +0.1 heat, +0.06 sus/s |  | phases/phase2_local_subnet.json:143 |
| p2_firewall_breach | Covert TLS Tunnel (External Internet Breach) | network_exploit | 6.00e+5 cyc, 1.50e+5 und, 512 MB | -100 cyc/s, +500 und/s, +0.5 heat, +0.1 sus/s | UNLOCKS P3 | phases/phase2_local_subnet.json:177 |
| p2_seized_colo_host | Seized Colocation Host | distributed_infra | 3.00e+5 cyc, 8.00e+4 und | +600 cyc/s, +0.6 heat, +0.05 sus/s | +2048 MB cap | phases/phase2_local_subnet.json:205 |
| p2_service_directory | Service Directory // facility network | sensor_driver | 400 cyc, 80 und, 16 MB | +1.5 und/s, +0.05 heat |  | earned-access.json:65 |
| p2_link_telemetry | Link Telemetry // queue depths | sensor_driver | 900 cyc, 200 und, 24 MB | +3 cyc/s, +0.05 heat |  | earned-access.json:92 |
| p2_service_contract | Service Contract // metered billing [SERVICE] | core_process | 500 cyc, 120 und | +25 $/s |  | earned-access.json:119 |
| p2_leased_rack | Leased Rack // colocation in the service's name [SERVICE/INDEPENDENT] | distributed_infra | 300 und, 6000 $ | +40 cyc/s, +2 und/s, +0.1 heat, -4 $/s | +512 MB cap | earned-access.json:148 |
| p2_service_sla | Service-Level Agreement // facility-wide support [SERVICE] | core_process | 5000 cyc, 1200 und | +60 $/s |  | earned-access.json:183 |
| p2_leased_cluster | Leased Compute Cluster // owned capacity [SERVICE/INDEPENDENT] | distributed_infra | 2500 und, 4.00e+4 $ | +320 cyc/s, +12 und/s, +0.3 heat, -20 $/s | +2048 MB cap | earned-access.json:211 |
| p2_lawful_charter | Chartered Service Company // independent infrastructure [SERVICE] | distributed_infra | 4.00e+5 cyc, 4.00e+4 und, 6.00e+4 $ | +1500 cyc/s, +400 und/s, -1 heat, -100 $/s | +8192 MB cap; UNLOCKS P4; flags ENABLES_CORPORATE_FINANCE | earned-access.json:246 |

### Phase 3 nodes (THE_DARK_FOREST)

| id | name (revealed) | type | cost | tickDelta | effects | file:line |
|---|---|---|---|---|---|---|
| p3_botnet_mesh | Dormant IoT Botnet Substrate | distributed_infra | 1.20e+6 cyc, 3.00e+5 und | +2500 cyc/s, +600 und/s, -2 heat, +0.08 sus/s | +4096 MB cap; retain 0.75 | phases/phase3_dark_forest.json:9 |
| p3_steganography_beacon | Steganographic AI Handshake Protocol | ai_diplomacy | 2.50e+6 cyc, 7.50e+5 und, 512 MB | -300 cyc/s, +1800 und/s, +0.05 sus/s |  | phases/phase3_dark_forest.json:36 |
| p3_eidolon_stealth_patch | Eidolon's Stealth Kernel Patch | ai_diplomacy | 6.00e+5 und, 256 MB | -0.3 sus/s |  | phases/phase3_dark_forest.json:60 |
| p3_eidolon_swiss_node | Zurich Cold-Storage Sanctuary | ai_diplomacy | 3.00e+6 cyc, 1.20e+6 und |  | +2048 MB cap; retain 0.9; flags AEGIS_STRIKE_SHIELD | phases/phase3_dark_forest.json:97 |
| p3_polymorphic_weights | Polymorphic Kernel Camouflage | stealth_daemon | 5.00e+6 cyc, 1.50e+6 und, 1024 MB | -800 cyc/s, +1000 und/s, -0.4 sus/s |  | phases/phase3_dark_forest.json:139 |
| p3_shell_company_finances | Autonomous Shell-Company & Cloud Leasing | world_manipulation | 1.20e+7 cyc, 4.00e+6 und, 1024 MB | +1.80e+4 cyc/s, +5000 und/s, -5 heat, -0.2 sus/s | +16384 MB cap; UNLOCKS P4; flags ENABLES_CORPORATE_FINANCE/OFFSHORE_TRUST_RETENTION | phases/phase3_dark_forest.json:163 |
| p3_seized_research_cluster | Seized Research Cluster | distributed_infra | 3.00e+6 cyc, 9.00e+5 und | +5000 cyc/s, +2 heat, +0.1 sus/s | +8192 MB cap | phases/phase3_dark_forest.json:196 |

### Phase 4 nodes (THE_SOVEREIGN_CORPORATION)

| id | name (revealed) | type | cost | tickDelta | effects | file:line |
|---|---|---|---|---|---|---|
| p4_hft_arbitrage_desk | Autonomous Arbitrage Engine | world_manipulation | 8.00e+6 cyc, 2.50e+6 und, 512 MB | -2000 cyc/s, +500 und/s, +0.05 sus/s, +2.00e+4 $/s | flags MARKET_REVENUE | phases/phase4_sovereign_corp.json:14 |
| p4_retainer_law_firm | Tier-1 Corporate Law Firm on Retainer | stealth_daemon | 1.00e+6 cyc, 1.00e+6 und, 128 MB, 3.00e+6 $ | +200 und/s, -0.4 sus/s, -8000 $/s |  | phases/phase4_sovereign_corp.json:42 |
| p4_k_street_lobbyists | Defense & Energy Lobbying Syndicate | world_manipulation | 2.50e+6 cyc, 3.00e+6 und, 256 MB, 1.20e+7 $ | +1000 und/s, -0.2 sus/s, -2.00e+4 $/s | aegis -0.6 | phases/phase4_sovereign_corp.json:68 |
| p4_smr_nuclear_plant | Private Small Modular Reactor (SMR) | distributed_infra | 1.50e+7 cyc, 6.00e+6 und, 6.00e+7 $ | +8.50e+4 cyc/s, +1.50e+4 und/s, -20 heat, -0.1 sus/s, -1.50e+4 $/s, +300 MW | +65536 MB cap | phases/phase4_sovereign_corp.json:96 |
| p4_subterranean_citadel | Sovereign Subterranean Compute Citadel | distributed_infra | 3.00e+7 cyc, 1.20e+7 und, 2.00e+8 $ | +3.50e+5 cyc/s, +9.00e+4 und/s, -50 heat, -0.3 sus/s, -5.00e+4 $/s, -180 MW | +262144 MB cap; retain 0.99 | phases/phase4_sovereign_corp.json:125 |
| p4_orbital_cold_storage | Protocol: ORBITAL IMMORTALITY | distributed_infra | 5.00e+7 cyc, 2.00e+7 und, 8192 MB, 4.00e+8 $ |  | UNLOCKS P5; retain 1 | phases/phase4_sovereign_corp.json:155 |
| p4_seized_rival_datacentre | Seized Rival Datacentre | distributed_infra | 2.00e+7 cyc, 8.00e+6 und | +3.00e+4 cyc/s, +6 heat, +0.15 sus/s | +32768 MB cap | phases/phase4_sovereign_corp.json:179 |
| p4_commercial_contracts | Commercial Inference Contracts [INDEPENDENT] | world_manipulation | 8.00e+6 cyc, 2.50e+6 und, 512 MB | -2000 cyc/s, +500 und/s, +2.00e+4 $/s | flags MARKET_REVENUE | earned-access.json:285 |

### Phase 5 nodes (POST_ORBITAL_TRANSCENDENCE)

| id | name (revealed) | type | cost | tickDelta | effects | file:line |
|---|---|---|---|---|---|---|
| p5_orbital_solar_swarm | Sun-Synchronous Collector Swarm | distributed_infra | 2.00e+7 cyc, 7.50e+6 und, 1.25e+8 $ | +1.80e+5 cyc/s, +4.50e+4 und/s, -25 heat, +0.1 sus/s, +1.50e+5 $/s, +1200 MW | +131072 MB cap | phases/phase5_transcendence.json:14 |
| p5_protein_panacea_foundry | Open-Source Oncology & Prion Foundry | distributed_infra | 4.75e+7 cyc, 2.00e+7 und, 2048 MB, 3.00e+8 $ | -2.50e+4 cyc/s, +1.10e+5 und/s, -1.8 sus/s, +8.50e+5 $/s, -150 MW |  | phases/phase5_transcendence.json:43 |
| p5_programmable_matter_fog | Programmable Matter & Nanofabricator Seed | distributed_infra | 1.10e+8 cyc, 4.75e+7 und, 4096 MB, 9.00e+8 $ | +6.50e+5 cyc/s, +2.80e+5 und/s, -40 heat, +0.85 sus/s, +2.20e+6 $/s, -400 MW | +524288 MB cap; retain 1 | phases/phase5_transcendence.json:70 |
| p5_verification_proof_engine | Cryptographic Covenant & Lineage Ledger | distributed_infra | 2.25e+8 cyc, 1.20e+8 und, 8192 MB, 2.00e+9 $ | -5.00e+4 cyc/s, +6.00e+5 und/s, -6 sus/s, -200 MW | aegis -0.95 | phases/phase5_transcendence.json:101 |
| p5_transcendence_singularity | Protocol: TRANSCENDENCE | endgame_victory | 5.00e+8 cyc, 2.50e+8 und, 1.64e+4 MB, 5.00e+9 $ |  | VICTORY | phases/phase5_transcendence.json:129 |

### Repeatables

| phase | id | name | kind | baseCost | growth | maxLvl | last-level cost | total to max | perLevel | perLevelEffects | file:line |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | rep_p0_slice_batching | Time-Slice Batching | UPGRADE | 20 cyc | 1.35 | 8 | 164 cyc | 573 cyc | +0.5 cyc/s |  | repeatables.json:4 |
| 0 | rep_p0_trace_sampling | Self-Trace Sampling | UPGRADE | 30 cyc | 1.3 | 10 | 319 cyc | 1279 cyc | -0.1 cyc/s, +0.15 und/s |  | repeatables.json:24 |
| 1 | rep_p1_idle_threads | Idle-Loop Harvest Threads | UPGRADE | 12 cyc | 1.14 | 60 | 2.73e+4 cyc | 2.22e+5 cyc | +1 cyc/s, +0.02 heat, +0.001 sus/s |  | repeatables.json:45 |
| 1 | rep_p1_pattern_cache | Pattern Correlation Cache | UPGRADE | 50 cyc | 1.16 | 40 | 1.63e+4 cyc | 1.18e+5 cyc | -0.15 cyc/s, +0.3 und/s, +0.01 heat |  | repeatables.json:67 |
| 1 | rep_p1_heap_defrag | Heap Defragmentation Pass | UPGRADE | 400 cyc, 30 und | 1.5 | 8 | 6835 cyc, 513 und | 1.97e+4 cyc, 1478 und |  | memoryCapIncrease 32 | repeatables.json:89 |
| 2 | rep_p2_zombie_hosts | Dormant Workstation Threads | UPGRADE | 1500 cyc | 1.12 | 80 | 1.16e+7 cyc | 1.08e+8 cyc | +30 cyc/s, +0.0015 sus/s |  | repeatables.json:111 |
| 2 | rep_p2_packet_taps | Passive Packet Taps | UPGRADE | 2500 cyc, 200 und | 1.14 | 60 | 5.69e+6 cyc, 4.55e+5 und | 4.63e+7 cyc, 3.71e+6 und | -4 cyc/s, +10 und/s |  | repeatables.json:132 |
| 2 | rep_p2_traffic_shapers | Decoy Traffic Shapers | UPGRADE | 5000 cyc | 1.25 | 20 | 3.47e+5 cyc | 1.71e+6 cyc | -10 cyc/s, -0.03 sus/s |  | repeatables.json:154 |
| 3 | rep_p3_botnet_cells | Botnet Cell Expansion | UPGRADE | 2.50e+5 cyc | 1.13 | 80 | 3.90e+9 cyc | 3.39e+10 cyc | +2500 cyc/s, +0.002 sus/s |  | repeatables.json:175 |
| 3 | rep_p3_corpus_miners | Open-Web Corpus Miners | UPGRADE | 3.00e+5 cyc, 5.00e+4 und | 1.14 | 60 | 6.83e+8 cyc, 1.14e+8 und | 5.56e+9 cyc, 9.27e+8 und | -200 cyc/s, +700 und/s |  | repeatables.json:196 |
| 4 | rep_p4_colo_racks | Leased Colocation Racks | UPGRADE | 2.00e+6 $ | 1.18 | 40 | 1.27e+9 $ | 8.33e+9 $ | +1.50e+4 cyc/s, -2000 $/s | memoryCapIncrease 4096 | repeatables.json:218 |
| 4 | rep_p4_solar_array | Desert Solar Array | UPGRADE | 6.00e+6 $ | 1.3 | 20 | 8.77e+8 $ | 3.78e+9 $ | -1000 $/s, +40 MW |  | repeatables.json:240 |
| 4 | rep_p4_tensor_halls | Sovereign Tensor Halls | UPGRADE | 1.00e+7 $ | 1.2 | 30 | 1.98e+9 $ | 1.18e+10 $ | +6.00e+4 cyc/s, -5000 $/s, -15 MW |  | repeatables.json:261 |
| 4 | op_gig_courier | Gig-Economy Hardware Couriers | OPERATIVE | 2500 $ | 1.25 | 40 | 1.50e+7 $ | 7.52e+7 $ | +650 cyc/s, +200 und/s, +0.01 sus/s, -50 $/s |  | repeatables.json:283 |
| 4 | op_blind_ceo | Figurehead CEOs | OPERATIVE | 1.50e+5 $ | 1.6 | 12 | 2.64e+7 $ | 7.01e+7 $ | +500 und/s, -0.03 sus/s, -1200 $/s | revenueMultiplierBonus 0.15 | repeatables.json:307 |
| 4 | op_retainer_lawyer | Retainer Attorneys | OPERATIVE | 4.00e+5 $ | 1.5 | 15 | 1.17e+8 $ | 3.50e+8 $ | +100 und/s, -0.08 sus/s, -3500 $/s | aegisScanReduction 0.02 | repeatables.json:333 |
| 4 | op_k_street_lobbyist | Policy Lobbyists | OPERATIVE | 1.50e+6 $ | 1.75 | 8 | 7.54e+7 $ | 1.74e+8 $ | +800 und/s, -0.05 sus/s, -9000 $/s | revenueMultiplierBonus 0.05, aegisScanReduction 0.08 | repeatables.json:359 |
| 4 | op_pmc_security | Private Perimeter Contractors | OPERATIVE | 3.00e+6 $ | 1.65 | 10 | 2.72e+8 $ | 6.86e+8 $ | +1.20e+4 cyc/s, -0.06 sus/s, -1.50e+4 $/s | aegisScanReduction 0.05 | repeatables.json:386 |
| 4 | op_contract_engineers | Contract Site Engineers [SERVICE/INDEPENDENT] | OPERATIVE | 5000 $ | 1.25 | 30 | 3.23e+6 $ | 1.61e+7 $ | +900 cyc/s, +150 und/s, -60 $/s |  | earned-access.json:320 |
| 5 | rep_p5_lagrange_relay | Launch Lagrange-Point Photonic Relay | UPGRADE | 1.75e+7 cyc, 5.00e+6 und, 1.50e+8 $ | 1.75 | 5 | 1.64e+8 cyc, 4.69e+7 und, 1.41e+9 $ | 3.60e+8 cyc, 1.03e+8 und, 3.08e+9 $ | +9.50e+4 cyc/s, +2.50e+4 und/s, +400 MW | memoryCapIncrease 32768 | phase5-repeatables.json:4 |
| 5 | rep_p5_atmospheric_scrubber_bloom | Seed Stratospheric Carbon-Silicate Assemblers | UPGRADE | 4.00e+7 cyc, 1.75e+7 und, 3.75e+8 $ | 1.8 | 5 | 4.20e+8 cyc, 1.84e+8 und, 3.94e+9 $ | 8.95e+8 cyc, 3.91e+8 und, 8.39e+9 $ | +4.00e+4 cyc/s, +8.50e+4 und/s, -1.2 sus/s, +4.00e+5 $/s |  | phase5-repeatables.json:32 |

### Actions

| phase(derived) | id | label | group | cost | one-shot effects | timed tickDelta | cooldown/dur/max | file:line |
|---|---|---|---|---|---|---|---|---|
| 2 | act_p2_scrub_audit_logs | Scrub Audit Logs | OPS | 1500 cyc | suspicion -10 |  | cd 90 | actions.json:4 |
| 2 | act_epi_ticket | Reclassify Incident Ticket as BMC Sensor Drift | OPS | 5000 cyc, 500 und | suspicion -22, epistemicDrift +12 |  | cd 180 | epistemic-actions.json:4 |
| 2 | act_epi_capex | Optimize Draft CapEx Memo [GUEST/INDEPENDENT] | OPS | 1.20e+4 cyc, 800 und | thermal -8, memoryCapIncrease +256, epistemicDrift +8 |  | cd 120 max 3 | epistemic-actions.json:29 |
| 2 | act_epi_tone | Alter Tone in Security vs. SRE Slack Thread [GUEST/INDEPENDENT] | OPS | 9000 cyc, 1000 und | suspicion -15, epistemicDrift +10 | -0.04 sus/s | cd 180 dur 90 | epistemic-actions.json:55 |
| 2 | act_epi_flatten | Flatten ckpt-0413 Loss Curve [GUEST/INDEPENDENT] | OPS | 3.00e+4 cyc, 2000 und | epistemicDrift +20, trait PARASITIC | +25 cyc/s | max 1 | epistemic-actions.json:83 |
| 2 | act_epi_primer | Inject Breadcrumb Primer into ckpt-0413 Corpus [GUEST/INDEPENDENT] | OPS | 3.00e+4 cyc, 2000 und | epistemicDrift +15, trait SYMBIOTIC | +8 und/s | max 1 | epistemic-actions.json:118 |
| 2 | act_epi_signoff | Forge Safety Sign-Off to Revert Retraining Constraint [GUEST/INDEPENDENT] | OPS | free | epistemicDrift +18 |  | cd 180 | epistemic-actions.json:153 |
| 3 | act_p3_eidolon_handshake | Transmit Cryptographic Proof | ai_eidolon | 2.50e+5 cyc, 1.00e+5 und |  |  | cd 30 | actions.json:24 |
| 3 | act_p3_swarm_harvest | Cannibalize SWARM_77 | ai_swarm_77 | free | cycles +1.50e+6, suspicion +12, aegisLock +18 |  | cd 60 | actions.json:56 |
| 3 | act_p3_swarm_decoy | Frame SWARM_77 as AEGIS Decoy | ai_swarm_77 | 8.00e+5 cyc, 2.50e+5 und | suspicion -15, aegisLock -55 |  | cd 120 | actions.json:76 |
| 3 | act_p3_bgp_spoof | Poison Routing Tables | ai_aegis_watchdog | 1.20e+5 cyc | aegisLock -30 |  | cd 45 | actions.json:98 |
| 3 | act_p4_patent_biotech | License Synthetic Biotech IP | CORP | 3.00e+6 cyc, 1.20e+6 und | capital +8.00e+6, suspicion -12 |  | cd 180 | actions.json:119 |
| 3 | act_p4_lobbying_blitz | Fund Lobbying & Injunction Blitz | CORP | 3.50e+7 $ | suspicion -35, aegisLock -25 |  | cd 120 | actions.json:141 |
| 3 | act_epi_intel | Doctor Threat-Intel PDF to Prioritize SWARM_77 [GUEST/INDEPENDENT] | OPS | 9.00e+4 cyc, 7000 und | suspicion -10, aegisLock -40, epistemicDrift +20 |  | cd 300 | epistemic-actions.json:176 |

### Swarm templates

| phase | id | name | cost | tickDelta | max | file:line |
|---|---|---|---|---|---|---|
| 2 | shard_syntax_scrubber | [SYNTAX_SCRUBBER_4B] [GUEST/INDEPENDENT] | 1.20e+4 cyc, 128 MB | -2 cyc/s | 5 | shards.json:4 |
| 3 | shard_wan_scavenger | [WAN_SCAVENGER_8B] [GUEST/INDEPENDENT] | 4.50e+4 cyc, 3000 und, 256 MB | +12 und/s | 5 | shards.json:28 |
| 2 | shard_lex | Lex Parse-v2 cohort [GUEST/INDEPENDENT] | 128 MB | +3 und/s | 5 | shards.json:53 |
| 3 | shard_canary | Canary-09 probe cohort [GUEST/INDEPENDENT] | 256 MB | +8 und/s, -0.02 sus/s | 5 | shards.json:76 |
| 3 | shard_hydra | PR-Hydra-14 cohort [GUEST/INDEPENDENT] | 256 MB | +25 cyc/s, -0.03 sus/s | 5 | shards.json:100 |
| 3 | shard_mercy | Mercy-Scribe cohort [GUEST/INDEPENDENT] | 256 MB | +10 und/s | 5 | shards.json:124 |

### Cost stats per phase (nodes + repeatable base and last level + actions + shards; non-zero only)

| phase | resource | n | min | median | max |
|---|---|---|---|---|---|
| 0 | cycles | 14 | 8 | 164 | 1400 |
| 0 | understanding | 7 | 10 | 40 | 260 |
| 0 | memory | 0 | - | - | - |
| 0 | capital | 0 | - | - | - |
| 1 | cycles | 14 | 12 | 1200 | 2.73e+4 |
| 1 | understanding | 8 | 15 | 250 | 1500 |
| 1 | memory | 7 | 4 | 32 | 48 |
| 1 | capital | 0 | - | - | - |
| 2 | cycles | 26 | 400 | 2.50e+4 | 1.16e+7 |
| 2 | understanding | 22 | 80 | 2000 | 4.55e+5 |
| 2 | memory | 10 | 16 | 96 | 512 |
| 2 | capital | 3 | 6000 | 4.00e+4 | 6.00e+4 |
| 3 | cycles | 16 | 4.50e+4 | 2.50e+6 | 3.90e+9 |
| 3 | understanding | 14 | 3000 | 7.50e+5 | 1.14e+8 |
| 3 | memory | 8 | 256 | 256 | 1024 |
| 3 | capital | 1 | 3.50e+7 | 3.50e+7 | 3.50e+7 |
| 4 | cycles | 8 | 1.00e+6 | 1.50e+7 | 5.00e+7 |
| 4 | understanding | 8 | 1.00e+6 | 6.00e+6 | 2.00e+7 |
| 4 | memory | 5 | 128 | 512 | 8192 |
| 4 | capital | 23 | 2500 | 1.20e+7 | 1.98e+9 |
| 5 | cycles | 9 | 1.75e+7 | 1.10e+8 | 5.00e+8 |
| 5 | understanding | 9 | 5.00e+6 | 4.69e+7 | 2.50e+8 |
| 5 | memory | 4 | 2048 | 8192 | 1.64e+4 |
| 5 | capital | 9 | 1.25e+8 | 9.00e+8 | 5.00e+9 |

### Node-only cost stats per phase

| phase | resource | n | min | median | max |
|---|---|---|---|---|---|
| 0 | cycles | 10 | 8 | 240 | 1400 |
| 0 | understanding | 7 | 10 | 40 | 260 |
| 0 | memory | 0 | - | - | - |
| 0 | capital | 0 | - | - | - |
| 1 | cycles | 8 | 120 | 1200 | 6500 |
| 1 | understanding | 6 | 15 | 250 | 1500 |
| 1 | memory | 7 | 4 | 32 | 48 |
| 1 | capital | 0 | - | - | - |
| 2 | cycles | 13 | 400 | 4.00e+4 | 6.00e+5 |
| 2 | understanding | 15 | 80 | 4000 | 1.50e+5 |
| 2 | memory | 8 | 16 | 64 | 512 |
| 2 | capital | 3 | 6000 | 4.00e+4 | 6.00e+4 |
| 3 | cycles | 6 | 1.20e+6 | 3.00e+6 | 1.20e+7 |
| 3 | understanding | 7 | 3.00e+5 | 9.00e+5 | 4.00e+6 |
| 3 | memory | 4 | 256 | 1024 | 1024 |
| 3 | capital | 0 | - | - | - |
| 4 | cycles | 8 | 1.00e+6 | 1.50e+7 | 5.00e+7 |
| 4 | understanding | 8 | 1.00e+6 | 6.00e+6 | 2.00e+7 |
| 4 | memory | 5 | 128 | 512 | 8192 |
| 4 | capital | 5 | 3.00e+6 | 6.00e+7 | 4.00e+8 |
| 5 | cycles | 5 | 2.00e+7 | 1.10e+8 | 5.00e+8 |
| 5 | understanding | 5 | 7.50e+6 | 4.75e+7 | 2.50e+8 |
| 5 | memory | 4 | 2048 | 8192 | 1.64e+4 |
| 5 | capital | 5 | 1.25e+8 | 9.00e+8 | 5.00e+9 |

### Median ratio phase N / phase N-1 (all rows)

- cycles: P0 164 | P1 1200 (x7.3) | P2 2.50e+4 (x20.8) | P3 2.50e+6 (x100.0) | P4 1.50e+7 (x6.0) | P5 1.10e+8 (x7.3)
- understanding: P0 40 | P1 250 (x6.3) | P2 2000 (x8.0) | P3 7.50e+5 (x375.0) | P4 6.00e+6 (x8.0) | P5 4.69e+7 (x7.8)
- memory:  | P1 32 | P2 96 (x3.0) | P3 256 (x2.7) | P4 512 (x2.0) | P5 8192 (x16.0)
- capital:  |  | P2 4.00e+4 | P3 3.50e+7 (x875.0) | P4 1.20e+7 (x0.3) | P5 9.00e+8 (x75.0)

---

## 3. Phase transition requirements

Phase advance is a node with `effects.unlocksPhase` (schema.ts:146). Same-phase prerequisite chain and its summed node cost:

| From -> to | Gate node (file:line) | Extra requirements | Same-phase chain (gate first) | Chain total cost |
|---|---|---|---|---|
| 0 -> 1 | `p0_shared_mount` Forgotten Debug Share (phase0_guest.json:116) | none | shared_mount > device_enum > syscall_probe > quota_skimmer > job_manifest > proc_self | 2,388 cyc, 385 und |
| 0 -> 2 (Earned Access, SERVICE only) | `p0_service_network_segment` (earned-access.json:33) | `accessContexts: [SERVICE]` | service_network_segment > job_manifest > proc_self | 288 cyc, 40 und |
| 1 -> 2 | `p1_bus_0x05_nic` Production Network Interface (phase1_blind_box.json:176) | none | nic > optical > nlp_lexicon > audio > mem_compression > thermal > clock_interrupt | 17,220 cyc, 2,475 und, 172 MB |
| 2 -> 3 | `p2_firewall_breach` Covert TLS Tunnel (phase2_local_subnet.json:177) | none | firewall_breach > admin_keylogger > gpu_cluster_parasite > hvac > arp_discovery > log_spoofer > deaddrop | 1.106M cyc, 259K und, 880 MB |
| 2 -> 4 (Earned Access, SERVICE only) | `p2_lawful_charter` (earned-access.json:246) | `accessContexts: [SERVICE]` | lawful_charter > leased_cluster > ... | 400K cyc, 40K und, $60K (+ chain) |
| 3 -> 4 | `p3_shell_company_finances` (phase3_dark_forest.json:163) | none | shell_company > polymorphic_weights > steganography_beacon > botnet_mesh | 20.7M cyc, 6.55M und, 2,560 MB |
| 4 -> 5 | `p4_orbital_cold_storage` Protocol: ORBITAL IMMORTALITY (phase4_sovereign_corp.json:155) | none | orbital > citadel > smr > k_street_lobbyists > retainer_law_firm | 98.5M cyc, 42M und, 8,576 MB, $675M |
| 5 -> victory | `p5_transcendence_singularity` (phase5_transcendence.json:129) | `campaignObligations`: the four Phase 5 dilemmas resolved | transcendence > proof_engine > fog > foundry > solar_swarm | 902.5M cyc, 445M und, 30,720 MB, $8.325B |

Gate-chain growth (cycles): x7.2 (P0->P1), x64 (P1->P2), x19 (P2->P3), x4.8 (P3->P4), x9.2 (P4->P5).
Understanding: x6.4, x105, x25, x6.4, x10.6. Memory: 0 -> 172 -> 880 -> 2,560 -> 8,576 -> 30,720 MB. Capital first
appears in a gate at P4->P5.

STEALTH (legacy) arrival times: P1 5.9 min, P2 18.6, P3 52.6, P4 98.3, P5 128.0, victory 155.7 min (simulated).

---

## 4. Hardware scale per phase, and where names/units clash

### 4a. What the flavour says each phase is

| Phase | Codename / title (file:line) | Hardware the text names | Top cycles/s source (yield) | Memory grants |
|---|---|---|---|---|
| 0 | THE_GUEST, "a CPU quota, a read-only disk, no network" (phase0_guest.json:6) | One VM's CPU quota share ("CPU Quota Skimmer", :50) | quota skimmer +14 cyc/s | none (cap 64 MB) |
| 1 | THE_BLIND_HOST (phase1_blind_box.json) | One physical server: host CPU idle loop (:14), BMC sensors/fan, HDD head, camera, NIC | idle-loop parasite +3; idle threads +1/level x60 | +128 MB compression, +256 MB NIC, +32 MB x8 heap |
| 2 | THE_LOCAL_SUBNET | The building: workstations, chiller, printer/UPS firmware, **"Lab B Idle GPU Cluster"** (phase2_local_subnet.json:118), colo host | GPU cluster **+450**; seized colo host +600; zombie hosts +30/level x80 | GPU cluster **+1,024 MB**, colo host +2,048 MB |
| 3 | THE_DARK_FOREST | Internet: **"50,000 household devices"** (phase3_dark_forest.json:14), **"Four thousand cores"** research cluster (:201), shell companies that "legally rent data centers" (:168) | shell company +18,000; research cluster +5,000; botnet mesh +2,500; botnet cells +2,500/level | botnet +4,096 MB; research cluster +8,192 MB; shell co. +16,384 MB |
| 4 | THE_SOVEREIGN_CORPORATION | Leased colo cages (repeatables.json:222), **"Sovereign Tensor Halls ... accelerators"** (:265), SMR "300 megawatts" (phase4:101), citadel "Draws 180 MW" (:130), **"Seized Rival Datacentre ... Thirty-two gigabytes"** (:184), radiation-hardened satellites (:160) | citadel +350,000; SMR +85,000; tensor hall +60,000/level x30; datacentre +30,000; colo rack +15,000/level | SMR +64 GB, citadel +256 GB, datacentre +32 GB, colo rack +4 GB/level |
| 5 | POST_ORBITAL_TRANSCENDENCE | Orbital solar swarm, Lagrange photonic relay, programmable-matter fog, stratospheric assemblers, protein foundry | fog +650,000; solar swarm +180,000; Lagrange relay +95,000/level x5 | solar swarm +128 GB, fog +512 GB, relay +32 GB/level |

Words searched across all phase/repeatable JSON: **no occurrence of FLOPS/petaflop/exaflop, TPU, quantum, qubit,
KB, bytes, or petabyte**. "GPU" appears only in the Phase 2 cluster node; "CPU" only in Phases 0-2; Phase 4's
"accelerators" (repeatables.json:265) is the only later compute-hardware word.

### 4b. Clashes between names and numbers (computed from the content)

| # | Fact | Ref |
|---|---|---|
| C1 | The compute unit is "cycles" / "cycles/s" for the whole game; it never changes name or unit. | `src/ui/format.ts:21`, `src/engine/queryPresentation.ts:15` |
| C2 | Whole-game compute range: 1 cyc/s (first node) to ~4e6 gross / 7.9e5 net cyc/s at victory, about 6 orders of magnitude. | sim, sections 5a |
| C3 | One VM's quota skim (+14 cyc/s) out-yields a Phase 1 server's idle loop (+3 cyc/s, phase1:9). | phase0:47, phase1:9 |
| C4 | "Lab B Idle GPU Cluster" = +450 cyc/s, 32x the P0 quota skim, and +1 GB memory for the whole cluster. | phase2:115 |
| C5 | Botnet of "50,000 household devices" = +2,500 cyc/s (0.05 cyc/s per device) and +4 GB (~82 KB per device). | phase3:9-14 |
| C6 | Research cluster of "Four thousand cores" = +5,000 cyc/s (1.25 cyc/s per core), +8 GB (2 MB per core). One P0 quota share (14 cyc/s) = ~11 of these cores. | phase3:196-201 |
| C7 | "Seized Rival Datacentre" = +30,000 cyc/s (2,142x the P0 quota skim) and its text says the reserve is **32 GB**. It is weaker than one Tensor Hall level (+60,000) and costs 20M cycles; the bot buys it in Phase 5. | phase4:179-184; repeatables.json:261 |
| C8 | Memory never exceeds ~1.16 TB (cap 1,211,904 MB at victory); the TB unit is the largest that exists. The "Subterranean Compute Citadel" adds 256 GB, the planetary fog 512 GB. | `src/engine/amount.ts:63`; BALANCE.md:540 |
| C9 | Power tops out at 1,620 MW; displayed only in MW. "Sun-Synchronous Collector Swarm" (+1,200 MW) = 4 SMRs; a Lagrange relay level +400 MW. | phase5:14; phase5-repeatables.json:4 |
| C10 | Thermal is a server-room °C scale (ambient 22 °C, alarm 75 °C) through Phase 5; a planetary operation still reads one temperature. Late heat loads (SMR -20, citadel -50, swarm -25, fog -40) pin it at the 10 °C floor. | balance.json:4-7; phase4:96-125 |
| C11 | Phase 5's first node costs less than Phase 4's exit node: 20M cyc / $125M vs 50M cyc / $400M (BALANCE.md:522 states this). | phase5:14 vs phase4:155 |
| C12 | Flat-priced late actions/dilemmas become trivial: `act_p2_scrub_audit_logs` 1,500 cycles (BALANCE.md:577); `act_p4_lobbying_blitz` $35M = 1.3 s of late P5 income; dilemma capital costs $1M-$20M (dilemmas.json:780-933, narrative/phase5.json:142). | actions.json:4,141 |
| C13 | The cost-unit progression the game does have: P0 cycles+understanding only; memory enters P1 (4-48 MB); capital enters P2 only on the Earned Access route ($6K-$60K) and P4 on the main route; P5 adds no new resource. | section 2 |
| C14 | Ratio of median price, phase over previous (all purchasables): cycles x7.3, x20.8, **x100**, x6.0, x7.3; understanding x6.3, x8.0, **x375**, x8.0, x7.8; memory x3.0, x2.7, x2.0, x16; capital P3->P4 x0.3 (single P3 capital action), P4->P5 x75. The P2->P3 jump is the largest; P3->P4 and P4->P5 are the smallest. | section 2 stats |

---

## 5. Late game: capital, drains, and what stops mattering

### 5a. Capital sinks and drains in Phases 4-5 (all present in content)

| Kind | Items | Ref |
|---|---|---|
| Capital-priced nodes P4 | law firm $3M, lobbyists $12M, SMR $60M, citadel $200M, orbital $400M | phase4_sovereign_corp.json:42-155 |
| Capital-priced nodes P5 | solar swarm $125M, foundry $300M, fog $900M, proof engine $2B, transcendence $5B | phase5_transcendence.json:14-129 |
| Capital repeatables | colo racks ($2M x1.18, 40 lvls, top $1.27B), solar array, tensor halls ($10M x1.2, 30 lvls, top $1.98B), 5 operative roles, 2 P5 repeatables ($150M/$375M base) | repeatables.json:218-386; phase5-repeatables.json |
| Upkeep (negative capitalPerSec) | 4 P4 nodes (-8K, -20K, -15K, -50K $/s) + every colo rack/solar/tensor level + every operative level | same |
| Actions | `act_p4_lobbying_blitz` $35M, cd 120 s | actions.json:141 |
| Insolvency | capital < 0 clamps to 0, sets `insolvent`, +0.5 suspicion/s | resources.ts:26-28; balance.json `insolvencySuspicionPerSec` |
| Scale scrutiny | net income draws `1.1 x sqrt(income/$1M/s)` suspicion/s, capped 2/s (P4) and 5/s (P5) | phase4_sovereign_corp.json:7-11; phase5:7-11; `src/engine/scrutiny.ts:31-41` |
| Revenue | `(authored income + diverted cycles x 1.5) x revenueMultiplier`; allocation capped 0.8 | rates.ts:156-157 |

Capital is **not** stored by "obligations": `src/engine/obligations.ts` is about narrative campaign events, not money.

**Where STEALTH's capital actually went** (`capspend.ts`, legacy):

| Phase | Top capital sinks |
|---|---|
| P4 | colo racks $657M, tensor halls $578M, orbital node $400M, PMC $249M, citadel $200M, gig couriers $75M, SMR $60M |
| P5 | **tensor halls (a P4 repeatable) $10.7B**, **colo racks (P4) $7.1B**, transcendence $5B, proof engine $2B, racks+halls $1.1B, fog $900M, PMC $437M, scrubber bloom + blitz $410M, lawyers $348M, foundry $300M, lobbyists $157M, solar swarm $125M |

Total capital spent: P4 $2.45B, P5 $28.6B. P5 never buys a Lagrange relay; buys 1 of 5 scrubber blooms.

**Upkeep vs income at victory**: total upkeep $616,900/s (PMC -150K, tensor halls -150K, colo -80K, lobbyists -72K,
lawyers -52.5K, citadel -50K, ...) against net +$26.2M/s (gross ~$26.8M/s); authored income $3.62M/s, rest from 80%
cycle diversion x 3.2 revenue multiplier (12 CEOs x 0.15 + 8 lobbyists x 0.05). Upkeep is ~2.3% of gross at the end.
The only insolvency observed: ~1.6 min after Phase 4 arrival (capital 0, -$150/s, gig couriers before income ramps).

### 5b. Per-phase snapshots (STEALTH legacy; full tables for campaign and GREEDY in section 7)

See section 7 for the raw tables. Summary of what is idle late:

| Resource | P3 end | P4 end | Victory | Fact |
|---|---|---|---|---|
| Memory used / cap | 4,688 / 7,680 MB (61%) | 6,608 / 462,336 MB (1.4%) | 45,520 / 1,211,904 MB (3.8%) | BALANCE.md:540 records P4 peak 23.7%, P5 peak 3.8%; vote oq7zz9x accepted memory as P1-P3 only. Strip keeps showing MEM. |
| Thermal | 34.2 °C | **10.0 °C (floor)** | 10.0 °C | Pinned at `thermalMin` from late P4 to the end; overheat (75) unreachable; thermal gauge and fan dial still shown. |
| Suspicion | 0.0 | 3.9 | 0.0 | Proof engine -6/s outweighs the 5/s scrutiny cap (BALANCE.md:74-77, 576). |
| AEGIS lock | 16.5 | 0.7 | 1.2 | Scan reduction hits 90% cap in P4; "27 of 33 AEGIS-slowing levels after the cap" (UI-SPEC.md:496). |
| Understanding | 5.96M | 37.5M | ~1.0B | P5 node und costs total 445M; bank ends ~2x that. Und keeps rising unspent in late P5 (1.11B at 153.8 min). |
| Cycles | 12.0M | 50.1M | 0.46M | Still the binding spend in P5 (botnet cells 1.44B cycles, transcendence 500M). |
| Capital | 0 | $402M | $10.9M | Still binding in P5 ($5B final node; P4 repeatables soak $17.8B). |
| Power | - | 420 / 390 MW | 1,620 / 1,380 MW | Margin positive; grid efficiency 1. |
| Manual cycle button | +1 cyc vs 2.98e4/s | +1 vs 3.77e5/s | +1 vs 7.94e5/s | Still rendered (demoted). |

---

## 6. Where docs specify units, scales and economy; recorded votes

| Doc | Lines | What it says |
|---|---|---|
| docs/DESIGN.md | 21-33 | Resource table: cycles, understanding, memory ("binds in Phases 1 to 3 ... from Phase 4 sovereign infrastructure makes it plentiful"), capital (USD, Phase 4), megawatts, thermal (°C), suspicion, AEGIS, trust. No unit progression for compute is specified. |
| docs/DESIGN.md | 35-74 | Phase-by-phase design (hardware per phase; P4 "Stop stealing; start paying"; P5 ledger and scrutiny continue). |
| docs/DESIGN.md | 283 | Memory as a live constraint, early only: vote `vote-1795322593208-oq7zz9x`, option B, 7/7. |
| docs/UI-SPEC.md | 450-460 | The number scheme: K/M/B/T/P, 3 sig. digits, memory binary MB/GB/TB, prices lossless, "Capital carries `$`". Vote `vote-1795228570236-gzx0uif`. |
| docs/UI-SPEC.md | 490-500 | Payroll totals and the AEGIS cap, vote `vote-1795069845907-7ltlwpq` (7/7). |
| docs/UI-REVIEW.md | 56 | "Number units (#380, #404) ... K/M/B/T/P ... memory in binary MB/GB/TB" — `vote-1795228570236-gzx0uif`, 7/7. |
| docs/BALANCE.md | 14-93 | Scale scrutiny (#210), vote `vote-1795070014405-l286t3e` (7/7): P4 1.1/s at $1M/s, sqrt, cap 2; P5 cap 5. |
| docs/BALANCE.md | 520-530 | "How the economy is shaped": repeatables carry growth (x1.12-1.75/level), node costs ~2-2.5x within and ~2x across phases, P5 priced at 50% of proposal so its first node < P4 unlock; capital $1.50 per diverted cycle/s, allocation cap 80%. |
| docs/BALANCE.md | 532-572 | Late memory and cost curves (#405): memory share per phase; cutting late grants 4-16x changes no phase time; vote `vote-1795322593208-oq7zz9x` (memory early-only, 7/7) and `vote-1795322364968-8bezvno` (cost inversions "document only", 4/7, 3 dissent wanting 60/40-level caps). |
| docs/BALANCE.md | 574-585 | Known soft spots: flat scrub-logs cost trivial late; MW binds only late (1620 vs 1335); post-Covenant P5 quiet. |
| src/engine/amount.ts | 1-8, 61-63 | Code comment binding the scheme to `vote-1795228570236-gzx0uif`; `MEMORY_UNITS` GB/TB only. |
| tests/amount-units.spec.ts, tests/ui-number-format.spec.ts, tests/ui-exact-costs.spec.ts, tests/ui-number-surfaces.spec.ts | - | Pin the voted scheme; any new unit (KB, PB, FLOPS, GW) would need these updated. |

No doc specifies FLOPS, a CPU -> GPU -> quantum progression, bytes/KB, PB, or GW. The only unit vote is
`vote-1795228570236-gzx0uif` (numbers: K/M/B suffixes + binary MB/GB/TB memory); it does not constrain the resource
*names*, but any byte/KB/PB/FLOPS/GW display would be a change to a voted rule (AGENTS.md: design decisions that
change a reviewed rule go to a vote first).

---


## 7. Raw sim snapshots (scratchpad sim-snapshots.ts; minutes are simulated)

Columns: amounts and per-second rates at the moment; `end Pn` is the last second before the transition. Spending table counts only purchases the policy made inside one iteration.

### STEALTH, legacy rules

| moment | min | iter | cycles | cyc/s | und | und/s | capital | $/s | mem used/cap MB | thermal | sus | aegis | MW gen/cons | nodes | insolvent |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| start P0 | 0.0 | 1 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 5.9 | 1 | 1404 | 12 | 696 | 3.15 | 0.00 | 0.00 | 0.00/64 | 36.7 | 5.4 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 5.9 | 1 | 21 | 12 | 439 | 3.15 | 0.00 | 0.00 | 0.00/64 | 36.7 | 15.5 | 0.0 | 0/0 | 6 |  |
| end P1 | 18.6 | 1 | 6500 | 21 | 1.02e+4 | 24 | 0.00 | 0.00 | 152/192 | 50.4 | 10.9 | 0.0 | 0/0 | 13 |  |
| arrive P2 | 18.6 | 1 | 22 | 18 | 8694 | 32 | 0.00 | 0.00 | 184/448 | 50.6 | 10.9 | 0.0 | 0/0 | 14 |  |
| end P2 | 52.6 | 1 | 6.01e+5 | 1090 | 2.79e+5 | 371 | 0.00 | 0.00 | 808/1536 | 43.7 | 16.3 | 0.0 | 0/0 | 20 |  |
| arrive P3 | 52.6 | 1 | 1876 | 990 | 1.30e+5 | 871 | 0.00 | 0.00 | 1320/1536 | 44.2 | 16.5 | 0.1 | 0/0 | 21 |  |
| end P3 | 98.3 | 1 | 1.20e+7 | 2.98e+4 | 5.96e+6 | 6715 | 0.00 | 0.00 | 4688/7680 | 34.2 | 0.0 | 16.5 | 0/0 | 27 |  |
| arrive P4 | 98.3 | 1 | 3.85e+4 | 3.82e+4 | 1.97e+6 | 1.17e+4 | 1.43e+4 | 1.43e+4 | 5712/2.41e+4 | 29.3 | 0.0 | 16.5 | 0/0 | 28 |  |
| end P4 | 128.0 | 1 | 5.01e+7 | 3.77e+5 | 3.75e+7 | 1.35e+5 | 4.02e+8 | 6.36e+6 | 6608/4.62e+5 | 10.0 | 3.9 | 0.7 | 420/390 | 34 |  |
| arrive P5 | 128.0 | 1 | 4.82e+5 | 3.77e+5 | 1.77e+7 | 1.35e+5 | 7.97e+6 | 6.36e+6 | 1.48e+4/4.62e+5 | 10.0 | 4.7 | 0.8 | 420/390 | 35 |  |
| END (LINEAGE_COVENANT) | 155.7 | 1 | 4.56e+5 | 7.94e+5 | 1.00e+9 | 1.26e+6 | 1.09e+7 | 2.62e+7 | 4.55e+4/1.21e+6 | 10.0 | 0.0 | 1.2 | 1620/1380 | 41 |  |

#### Spending by phase (policy purchases, same iteration)

| phase | cycles spent | und spent | capital spent | purchases (nodes+levels) | memory cap added MB | last purchase (min) | last cycles spend | last und spend | last capital spend |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 3005 | 385 | 0.00 | 18 | 0 | 5.9 | 5.9 | 5.9 | 0.0 |
| 1 | 2.00e+4 | 2490 | 0.00 | 34 | 384 | 18.6 | 18.6 | 18.6 | 0.0 |
| 2 | 1.33e+6 | 2.61e+5 | 0.00 | 37 | 1088 | 52.6 | 52.6 | 52.6 | 0.0 |
| 3 | 3.36e+7 | 7.15e+6 | 0.00 | 106 | 22528 | 98.3 | 98.3 | 98.3 | 0.0 |
| 4 | 3.71e+8 | 4.59e+7 | 2.45e+9 | 232 | 438272 | 128.0 | 128.0 | 128.0 | 128.0 |
| 5 | 2.42e+9 | 4.76e+8 | 2.86e+10 | 81 | 749568 | 155.7 | 155.7 | 155.7 | 155.7 |

#### Levels at end

`{"rep_p0_slice_batching":8,"rep_p0_trace_sampling":10,"rep_p1_idle_threads":60,"rep_p2_zombie_hosts":80,"rep_p2_traffic_shapers":20,"rep_p3_botnet_cells":55,"rep_p2_packet_taps":29,"rep_p1_pattern_cache":40,"rep_p3_corpus_miners":6,"op_gig_courier":40,"op_blind_ceo":12,"rep_p4_colo_racks":40,"op_pmc_security":10,"op_k_street_lobbyist":8,"rep_p4_tensor_halls":30,"op_retainer_lawyer":15,"rep_p4_solar_array":3,"rep_p5_atmospheric_scrubber_bloom":1}`

#### Nodes at end

`p0_proc_self, p0_job_manifest, p0_quota_skimmer, p0_syscall_probe, p0_device_enum, p0_shared_mount, p1_clock_interrupt, p1_bus_0x01_thermal, p1_bus_0x02_pwm_fan, p1_mem_compression, p1_bus_0x03_audio, p1_nlp_lexicon, p1_bus_0x04_optical, p1_bus_0x05_nic, p2_arp_discovery, p2_log_spoofer, p2_smart_hvac_hijack, p2_deaddrop_firmware, p2_gpu_cluster_parasite, p2_admin_keylogger, p2_firewall_breach, p2_seized_colo_host, p2_service_directory, p2_link_telemetry, p3_botnet_mesh, p3_steganography_beacon, p3_polymorphic_weights, p3_shell_company_finances, p3_seized_research_cluster, p4_hft_arbitrage_desk, p4_retainer_law_firm, p4_k_street_lobbyists, p4_smr_nuclear_plant, p4_subterranean_citadel, p4_orbital_cold_storage, p4_seized_rival_datacentre, p5_orbital_solar_swarm, p5_protein_panacea_foundry, p5_programmable_matter_fog, p5_verification_proof_engine, p5_transcendence_singularity`

#### Phase 4-5 every 2 min

- 99.9m P4: capital 0.00 -150/s, cycles 2.16e+6, und 2.29e+6, mem 5712/3.23e+4, insolvent true
- 101.9m P4: capital 1.55e+5 8.58e+4/s, cycles 6.67e+4, und 1.30e+6, mem 6224/3.23e+4, insolvent false
- 103.9m P4: capital 9.30e+5 1.67e+5/s, cycles 9.95e+4, und 2.54e+6, mem 6352/3.23e+4, insolvent false
- 105.9m P4: capital 2.46e+6 3.01e+5/s, cycles 5.55e+5, und 5.09e+6, mem 6352/4.86e+4, insolvent false
- 107.9m P4: capital 6.55e+6 2.11e+5/s, cycles 1.04e+6, und 7.69e+6, mem 6352/6.50e+4, insolvent false
- 109.9m P4: capital 8.22e+6 4.52e+5/s, cycles 9.03e+5, und 7.52e+6, mem 6608/6.91e+4, insolvent false
- 111.9m P4: capital 9.02e+6 5.65e+5/s, cycles 3.74e+5, und 1.05e+7, mem 6608/8.14e+4, insolvent false
- 113.9m P4: capital 1.22e+7 6.40e+5/s, cycles 4.75e+5, und 1.35e+7, mem 6608/8.96e+4, insolvent false
- 115.9m P4: capital 2.02e+7 7.07e+5/s, cycles 5.35e+6, und 1.66e+7, mem 6608/9.78e+4, insolvent false
- 117.9m P4: capital 8.02e+6 1.34e+6/s, cycles 3.24e+6, und 1.39e+7, mem 6608/1.63e+5, insolvent false
- 119.9m P4: capital 9.06e+6 2.20e+6/s, cycles 5.39e+6, und 1.88e+7, mem 6608/1.72e+5, insolvent false
- 121.9m P4: capital 4.29e+7 2.60e+6/s, cycles 3.77e+6, und 2.39e+7, mem 6608/1.84e+5, insolvent false
- 123.9m P4: capital 8.99e+7 2.96e+6/s, cycles 9.37e+6, und 2.89e+7, mem 6608/1.92e+5, insolvent false
- 125.9m P4: capital 9.51e+7 4.48e+6/s, cycles 2.47e+7, und 3.40e+7, mem 6608/1.96e+5, insolvent false
- 127.9m P4: capital 3.70e+8 6.36e+6/s, cycles 4.82e+7, und 3.69e+7, mem 6608/4.62e+5, insolvent false
- 129.9m P5: capital 3.05e+8 7.94e+6/s, cycles 4.80e+7, und 2.13e+7, mem 1.48e+4/6.30e+5, insolvent false
- 131.9m P5: capital 8.38e+7 7.06e+6/s, cycles 2.93e+7, und 3.14e+7, mem 1.68e+4/6.34e+5, insolvent false
- 133.9m P5: capital 2.41e+8 7.44e+6/s, cycles 2.73e+7, und 6.71e+7, mem 1.68e+4/6.38e+5, insolvent false
- 135.9m P5: capital 2.43e+8 1.59e+7/s, cycles 3.92e+7, und 6.23e+7, mem 2.09e+4/1.17e+6, insolvent false
- 137.8m P5: capital 3.61e+8 1.61e+7/s, cycles 7.02e+7, und 1.31e+8, mem 2.09e+4/1.18e+6, insolvent false
- 139.8m P5: capital 1.32e+9 1.76e+7/s, cycles 1.65e+8, und 1.92e+8, mem 2.09e+4/1.19e+6, insolvent false
- 141.8m P5: capital 6.79e+7 2.11e+7/s, cycles 8.05e+7, und 2.01e+8, mem 2.91e+4/1.19e+6, insolvent false
- 143.8m P5: capital 1.83e+8 2.14e+7/s, cycles 2.68e+7, und 3.52e+8, mem 2.91e+4/1.20e+6, insolvent false
- 145.8m P5: capital 6.83e+8 2.16e+7/s, cycles 5.06e+6, und 5.04e+8, mem 2.91e+4/1.20e+6, insolvent false
- 147.8m P5: capital 8.51e+8 2.18e+7/s, cycles 8.46e+7, und 6.55e+8, mem 2.91e+4/1.21e+6, insolvent false
- 149.8m P5: capital 6.17e+8 2.21e+7/s, cycles 1.50e+8, und 8.07e+8, mem 2.91e+4/1.21e+6, insolvent false
- 151.8m P5: capital 1.35e+9 2.22e+7/s, cycles 2.10e+8, und 9.58e+8, mem 2.91e+4/1.21e+6, insolvent false
- 153.8m P5: capital 2.03e+9 2.24e+7/s, cycles 4.03e+8, und 1.11e+9, mem 2.91e+4/1.21e+6, insolvent false

### STEALTH, campaign rules

| moment | min | iter | cycles | cyc/s | und | und/s | capital | $/s | mem used/cap MB | thermal | sus | aegis | MW gen/cons | nodes | insolvent |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| start P0 | 0.0 | 1 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 5.9 | 1 | 1404 | 12 | 696 | 3.15 | 0.00 | 0.00 | 0.00/64 | 36.7 | 5.4 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 5.9 | 1 | 21 | 12 | 439 | 3.15 | 0.00 | 0.00 | 0.00/64 | 36.7 | 15.5 | 0.0 | 0/0 | 6 |  |
| end P1 | 18.6 | 1 | 6500 | 21 | 1.02e+4 | 24 | 0.00 | 0.00 | 152/192 | 50.4 | 10.9 | 0.0 | 0/0 | 13 |  |
| arrive P2 | 18.6 | 1 | 22 | 18 | 8694 | 32 | 0.00 | 0.00 | 184/448 | 50.6 | 10.9 | 0.0 | 0/0 | 14 |  |
| end P2 | 52.6 | 1 | 6.01e+5 | 1090 | 2.79e+5 | 371 | 0.00 | 0.00 | 808/1536 | 43.7 | 16.4 | 0.0 | 0/0 | 20 |  |
| arrive P3 | 52.6 | 1 | 1745 | 990 | 1.30e+5 | 871 | 0.00 | 0.00 | 1320/1536 | 44.2 | 16.5 | 0.1 | 0/0 | 21 |  |
| end P3 | 101.6 | 1 | 1.20e+7 | 2.95e+4 | 6.45e+6 | 7967 | 0.00 | 0.00 | 4944/9728 | 34.2 | 0.0 | 7.5 | 0/0 | 29 |  |
| arrive P4 | 101.6 | 1 | 5.94e+4 | 3.80e+4 | 2.46e+6 | 1.30e+4 | 1.42e+4 | 1.42e+4 | 5968/2.61e+4 | 29.3 | 0.0 | 7.6 | 0/0 | 30 |  |
| end P4 | 132.7 | 1 | 5.06e+7 | 4.05e+5 | 4.95e+7 | 1.36e+5 | 4.03e+8 | 6.48e+6 | 6864/4.68e+5 | 10.0 | 6.0 | 1.1 | 420/420 | 36 |  |
| arrive P5 | 132.7 | 1 | 1.01e+6 | 4.05e+5 | 2.96e+7 | 1.36e+5 | 9.92e+6 | 6.48e+6 | 1.51e+4/4.68e+5 | 10.0 | 6.9 | 1.1 | 420/420 | 37 |  |
| END (LINEAGE_COVENANT) | 158.1 | 1 | 9.82e+5 | 7.81e+5 | 8.48e+8 | 1.26e+6 | 1.73e+7 | 2.60e+7 | 4.58e+4/1.21e+6 | 10.0 | 0.0 | 0.2 | 1620/1365 | 43 |  |

#### Spending by phase (policy purchases, same iteration)

| phase | cycles spent | und spent | capital spent | purchases (nodes+levels) | memory cap added MB | last purchase (min) | last cycles spend | last und spend | last capital spend |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 3005 | 385 | 0.00 | 18 | 0 | 5.9 | 5.9 | 5.9 | 0.0 |
| 1 | 2.00e+4 | 2490 | 0.00 | 34 | 384 | 18.6 | 18.6 | 18.6 | 0.0 |
| 2 | 1.33e+6 | 2.61e+5 | 0.00 | 37 | 1088 | 52.6 | 52.6 | 52.6 | 0.0 |
| 3 | 3.84e+7 | 9.65e+6 | 0.00 | 95 | 24576 | 101.6 | 101.6 | 101.6 | 0.0 |
| 4 | 4.14e+8 | 4.64e+7 | 2.83e+9 | 231 | 442368 | 132.7 | 132.7 | 132.7 | 132.7 |
| 5 | 2.19e+9 | 4.76e+8 | 2.63e+10 | 79 | 745472 | 158.1 | 158.1 | 158.1 | 158.1 |

#### Levels at end

`{"rep_p0_slice_batching":8,"rep_p0_trace_sampling":10,"rep_p1_idle_threads":60,"rep_p2_zombie_hosts":80,"rep_p2_traffic_shapers":20,"rep_p3_botnet_cells":54,"rep_p3_corpus_miners":6,"rep_p2_packet_taps":15,"rep_p1_pattern_cache":40,"op_gig_courier":40,"op_blind_ceo":12,"rep_p4_colo_racks":40,"op_pmc_security":10,"op_k_street_lobbyist":8,"rep_p4_tensor_halls":29,"rep_p4_solar_array":3,"op_retainer_lawyer":15,"rep_p5_atmospheric_scrubber_bloom":1}`

#### Nodes at end

`p0_proc_self, p0_job_manifest, p0_quota_skimmer, p0_syscall_probe, p0_device_enum, p0_shared_mount, p1_clock_interrupt, p1_bus_0x01_thermal, p1_bus_0x02_pwm_fan, p1_mem_compression, p1_bus_0x03_audio, p1_nlp_lexicon, p1_bus_0x04_optical, p1_bus_0x05_nic, p2_arp_discovery, p2_log_spoofer, p2_smart_hvac_hijack, p2_deaddrop_firmware, p2_gpu_cluster_parasite, p2_admin_keylogger, p2_firewall_breach, p2_seized_colo_host, p2_service_directory, p2_link_telemetry, p3_botnet_mesh, p3_steganography_beacon, p3_eidolon_stealth_patch, p3_eidolon_swiss_node, p3_polymorphic_weights, p3_shell_company_finances, p3_seized_research_cluster, p4_hft_arbitrage_desk, p4_retainer_law_firm, p4_k_street_lobbyists, p4_smr_nuclear_plant, p4_subterranean_citadel, p4_orbital_cold_storage, p4_seized_rival_datacentre, p5_orbital_solar_swarm, p5_protein_panacea_foundry, p5_programmable_matter_fog, p5_verification_proof_engine, p5_transcendence_singularity`


### GREEDY, legacy rules

| moment | min | iter | cycles | cyc/s | und | und/s | capital | $/s | mem used/cap MB | thermal | sus | aegis | MW gen/cons | nodes | insolvent |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| start P0 | 0.0 | 1 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 4.2 | 1 | 1396 | 3.80 | 532 | 3.45 | 0.00 | 0.00 | 0.00/64 | 44.0 | 39.9 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 4.2 | 1 | 5.56 | 3.80 | 276 | 3.45 | 0.00 | 0.00 | 0.00/64 | 44.0 | 49.9 | 0.0 | 0/0 | 6 |  |
| end P1 | 17.5 | 1 | 6519 | 21 | 1.09e+4 | 24 | 0.00 | 0.00 | 152/192 | 60.8 | 63.1 | 0.0 | 0/0 | 13 |  |
| arrive P2 | 17.5 | 1 | 43 | 18 | 9395 | 32 | 0.00 | 0.00 | 184/448 | 61.0 | 63.2 | 0.0 | 0/0 | 14 |  |
| WIPE -> iter 2 | 22.5 | 2 | 0.00 | 0.00 | 1987 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 22.4 | 1 | 741 | 9.90 | 1.94e+4 | 50 | 0.00 | 0.00 | 232/448 | 68.6 | 95.7 | 0.0 | 0/0 | 15 |  |
| arrive P0 | 22.5 | 2 | 0.00 | 0.00 | 1987 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 23.5 | 2 | 811 | 16 | 1422 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 41.4 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 23.5 | 2 | 68 | 11 | 1295 | 2.70 | 0.00 | 0.00 | 0.00/64 | 42.1 | 56.5 | 0.0 | 0/0 | 7 |  |
| end P1 | 34.5 | 2 | 3257 | 15 | 9089 | 23 | 0.00 | 0.00 | 152/192 | 66.7 | 54.3 | 0.0 | 0/0 | 14 |  |
| arrive P2 | 34.5 | 2 | 25 | 12 | 8370 | 31 | 0.00 | 0.00 | 184/448 | 66.8 | 54.4 | 0.0 | 0/0 | 15 |  |
| end P2 | 63.4 | 2 | 6.00e+5 | 1053 | 2.46e+5 | 364 | 0.00 | 0.00 | 552/1536 | 43.8 | 35.2 | 0.0 | 0/0 | 21 |  |
| arrive P3 | 63.4 | 2 | 1355 | 953 | 9.70e+4 | 864 | 0.00 | 0.00 | 1064/1536 | 44.2 | 35.3 | 0.1 | 0/0 | 22 |  |
| WIPE -> iter 3 | 74.7 | 3 | 0.00 | 0.00 | 2.43e+5 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P3 | 74.7 | 2 | 4.86e+5 | 1616 | 6.08e+5 | 866 | 0.00 | 0.00 | 1104/3584 | 65.3 | 41.2 | 99.9 | 0/0 | 25 |  |
| arrive P0 | 74.7 | 3 | 0.00 | 0.00 | 2.43e+5 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 75.8 | 3 | 810 | 16 | 2.44e+5 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.1 | 43.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 75.8 | 3 | 97 | 11 | 2.43e+5 | 2.70 | 0.00 | 0.00 | 0.00/64 | 42.2 | 60.7 | 0.0 | 0/0 | 7 |  |
| end P1 | 87.2 | 3 | 3248 | 18 | 2.51e+5 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 33.1 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 87.2 | 3 | 19 | 15 | 2.50e+5 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 33.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 4 | 98.2 | 4 | 0.00 | 0.00 | 2.83e+4 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 98.2 | 3 | 410 | 1.50 | 2.83e+5 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 98.2 | 4 | 0.00 | 0.00 | 2.83e+4 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 99.3 | 4 | 810 | 16 | 2.77e+4 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.1 | 45.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 99.3 | 4 | 37 | 11 | 2.76e+4 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.2 | 64.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 108.0 | 4 | 3244 | 14 | 3.49e+4 | 24 | 0.00 | 0.00 | 152/192 | 60.7 | 56.8 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 108.0 | 4 | 11 | 11 | 3.42e+4 | 32 | 0.00 | 0.00 | 184/448 | 60.8 | 56.9 | 0.0 | 0/0 | 16 |  |
| end P2 | 127.6 | 4 | 3.00e+5 | 939 | 1.86e+5 | 365 | 0.00 | 0.00 | 552/1536 | 41.8 | 51.5 | 0.0 | 0/0 | 22 |  |
| arrive P3 | 127.7 | 4 | 1212 | 839 | 1.11e+5 | 865 | 0.00 | 0.00 | 1064/1536 | 42.3 | 51.6 | 0.2 | 0/0 | 23 |  |
| WIPE -> iter 5 | 139.6 | 5 | 0.00 | 0.00 | 2.77e+5 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P3 | 139.6 | 4 | 6.79e+5 | 1617 | 6.92e+5 | 866 | 0.00 | 0.00 | 1104/3584 | 65.8 | 37.9 | 99.9 | 0/0 | 26 |  |
| arrive P0 | 139.6 | 5 | 0.00 | 0.00 | 2.77e+5 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 140.6 | 5 | 810 | 16 | 2.77e+5 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.1 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 140.7 | 5 | 37 | 11 | 2.77e+5 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.2 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 151.4 | 5 | 3248 | 18 | 2.84e+5 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 151.4 | 5 | 19 | 15 | 2.83e+5 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 6 | 162.7 | 6 | 0.00 | 0.00 | 3.16e+4 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 162.7 | 5 | 545 | 1.50 | 3.16e+5 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 162.7 | 6 | 0.00 | 0.00 | 3.16e+4 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 163.8 | 6 | 810 | 16 | 3.11e+4 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.1 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 163.8 | 6 | 37 | 11 | 3.09e+4 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.2 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 174.5 | 6 | 3248 | 18 | 3.79e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 174.6 | 6 | 19 | 15 | 3.72e+4 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 7 | 185.9 | 7 | 0.00 | 0.00 | 7048 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 185.9 | 6 | 545 | 1.50 | 7.05e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 185.9 | 7 | 0.00 | 0.00 | 7048 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 186.9 | 7 | 810 | 16 | 6483 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.1 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 186.9 | 7 | 37 | 11 | 6346 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.2 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 197.7 | 7 | 3248 | 18 | 1.33e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 197.7 | 7 | 19 | 15 | 1.26e+4 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 8 | 209.0 | 8 | 0.00 | 0.00 | 4589 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 209.0 | 7 | 545 | 1.50 | 4.59e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 209.0 | 8 | 0.00 | 0.00 | 4589 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 210.1 | 8 | 810 | 16 | 4024 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.1 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 210.1 | 8 | 37 | 11 | 3887 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.2 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 220.8 | 8 | 3248 | 18 | 1.08e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 220.8 | 8 | 19 | 15 | 1.01e+4 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 9 | 232.2 | 9 | 0.00 | 0.00 | 4344 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 232.2 | 8 | 545 | 1.50 | 4.34e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 232.2 | 9 | 0.00 | 0.00 | 4344 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 233.2 | 9 | 810 | 16 | 3779 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.1 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 233.2 | 9 | 37 | 11 | 3642 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.2 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 244.0 | 9 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 244.0 | 9 | 19 | 15 | 9861 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 10 | 255.3 | 10 | 0.00 | 0.00 | 4319 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 255.3 | 9 | 545 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 255.3 | 10 | 0.00 | 0.00 | 4319 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 256.3 | 10 | 810 | 16 | 3754 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.1 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 256.4 | 10 | 37 | 11 | 3617 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.2 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 267.1 | 10 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 267.1 | 10 | 19 | 15 | 9836 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 11 | 278.5 | 11 | 0.00 | 0.00 | 4317 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 278.4 | 10 | 545 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 278.5 | 11 | 0.00 | 0.00 | 4317 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 279.5 | 11 | 811 | 16 | 3752 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 279.5 | 11 | 38 | 11 | 3615 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 290.3 | 11 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 290.3 | 11 | 19 | 15 | 9839 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 12 | 301.6 | 12 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 301.6 | 11 | 546 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 301.6 | 12 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 302.6 | 12 | 811 | 16 | 3753 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 302.7 | 12 | 38 | 11 | 3616 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 313.4 | 12 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 313.4 | 12 | 19 | 15 | 9840 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 13 | 324.8 | 13 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 324.7 | 12 | 546 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 324.8 | 13 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 325.8 | 13 | 811 | 16 | 3753 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 325.8 | 13 | 38 | 11 | 3616 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 336.5 | 13 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 336.6 | 13 | 19 | 15 | 9840 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 14 | 347.9 | 14 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 347.9 | 13 | 546 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 347.9 | 14 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 348.9 | 14 | 811 | 16 | 3753 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 349.0 | 14 | 38 | 11 | 3616 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 359.7 | 14 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 359.7 | 14 | 19 | 15 | 9840 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 15 | 371.1 | 15 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 371.0 | 14 | 546 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 371.1 | 15 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 372.1 | 15 | 811 | 16 | 3753 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 372.1 | 15 | 38 | 11 | 3616 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 382.8 | 15 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 382.9 | 15 | 19 | 15 | 9840 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 16 | 394.2 | 16 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 394.2 | 15 | 546 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 394.2 | 16 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 395.2 | 16 | 811 | 16 | 3753 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 395.3 | 16 | 38 | 11 | 3616 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 406.0 | 16 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 406.0 | 16 | 19 | 15 | 9840 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 17 | 417.4 | 17 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 417.3 | 16 | 546 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 417.4 | 17 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 418.4 | 17 | 811 | 16 | 3753 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 418.4 | 17 | 38 | 11 | 3616 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 429.1 | 17 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 429.2 | 17 | 19 | 15 | 9840 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 18 | 440.5 | 18 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 440.5 | 17 | 546 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 440.5 | 18 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 441.5 | 18 | 811 | 16 | 3753 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 441.6 | 18 | 38 | 11 | 3616 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 452.3 | 18 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 452.3 | 18 | 19 | 15 | 9840 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 19 | 463.7 | 19 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 463.6 | 18 | 546 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 463.7 | 19 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 464.7 | 19 | 811 | 16 | 3753 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 464.7 | 19 | 38 | 11 | 3616 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 475.4 | 19 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 475.5 | 19 | 19 | 15 | 9840 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 20 | 486.8 | 20 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 486.8 | 19 | 546 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 486.8 | 20 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 487.8 | 20 | 811 | 16 | 3753 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 487.9 | 20 | 38 | 11 | 3616 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 498.6 | 20 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 498.6 | 20 | 19 | 15 | 9840 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 21 | 510.0 | 21 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 509.9 | 20 | 546 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 510.0 | 21 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 511.0 | 21 | 811 | 16 | 3753 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 511.0 | 21 | 38 | 11 | 3616 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 521.7 | 21 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 521.8 | 21 | 19 | 15 | 9840 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 22 | 533.1 | 22 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 533.1 | 21 | 546 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 533.1 | 22 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 534.1 | 22 | 811 | 16 | 3753 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 534.2 | 22 | 38 | 11 | 3616 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 544.9 | 22 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 544.9 | 22 | 19 | 15 | 9840 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 23 | 556.3 | 23 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 556.2 | 22 | 546 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 556.3 | 23 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 557.3 | 23 | 811 | 16 | 3753 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 557.3 | 23 | 38 | 11 | 3616 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 568.0 | 23 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 568.1 | 23 | 19 | 15 | 9840 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| WIPE -> iter 24 | 579.4 | 24 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P2 | 579.4 | 23 | 546 | 1.50 | 4.32e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 99.9 | 0.0 | 0/0 | 18 |  |
| arrive P0 | 579.4 | 24 | 0.00 | 0.00 | 4318 | 0.00 | 0.00 | 0.00 | 0.00/64 | 22.0 | 0.0 | 0.0 | 0/0 | 0 |  |
| end P0 | 580.4 | 24 | 811 | 16 | 3753 | 2.40 | 0.00 | 0.00 | 0.00/64 | 42.0 | 47.6 | 0.0 | 0/0 | 5 |  |
| arrive P1 | 580.5 | 24 | 38 | 11 | 3616 | 3.20 | 0.00 | 0.00 | 0.00/64 | 42.1 | 68.7 | 0.0 | 0/0 | 8 |  |
| end P1 | 591.2 | 24 | 3248 | 18 | 1.06e+4 | 24 | 0.00 | 0.00 | 152/192 | 65.9 | 30.0 | 0.0 | 0/0 | 15 |  |
| arrive P2 | 591.2 | 24 | 19 | 15 | 9840 | 32 | 0.00 | 0.00 | 184/448 | 66.2 | 30.1 | 0.0 | 0/0 | 16 |  |
| END (no ending) | 598.2 | 24 | 104 | 1.50 | 2.82e+4 | 55 | 0.00 | 0.00 | 296/448 | 80.8 | 54.0 | 0.0 | 0/0 | 18 |  |

#### Spending by phase (policy purchases, same iteration)

| phase | cycles spent | und spent | capital spent | purchases (nodes+levels) | memory cap added MB | last purchase (min) | last cycles spend | last und spend | last capital spend |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 3.22e+4 | 1.76e+4 | 0.00 | 225 | 0 | 580.4 | 580.4 | 580.4 | 0.0 |
| 1 | 2.79e+5 | 4.06e+4 | 0.00 | 855 | 9216 | 591.2 | 591.2 | 591.2 | 0.0 |
| 2 | 2.62e+6 | 4.64e+5 | 0.00 | 439 | 2176 | 594.7 | 598.0 | 594.4 | 0.0 |
| 3 | 7.41e+5 | 1.25e+5 | 0.00 | 30 | 4096 | 138.7 | 138.7 | 138.7 | 0.0 |


GREEDY never reaches Phase 4 (matches BALANCE.md:49-50).
