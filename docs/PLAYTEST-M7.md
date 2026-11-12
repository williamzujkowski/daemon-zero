# M7 accelerated UI playthrough

Date: 2026-11-12. Result: **The Lineage Covenant**, Phase 5, zero wipes,
**9,557.4 simulated seconds (2 h 39 m 17.4 s)**. This was an automated,
accelerated visible-Chrome run, not a human real-time pacing assessment.

## Method

Started a fresh browser context at tick 0, 1440×900. A local test driver read the
saved state and used a copy of the careful policy to plan ordinary UI clicks.
Every purchase, action, dilemma, fork, encounter and shard command went through
the displayed controls. The development hook only advanced live time (or flushed
a zero-second checkpoint); it never imported a save or granted resources.
Natural browser ticks also ran. Manual clicks stopped once passive income was
positive. Fan/allocation values used the nearest available UI step, so this is
not an exact replay of the headless policy. No full-page snapshot per step.

A driver tab-switch attempted to run behind a Phase 4 dilemma and timed out.
The driver was corrected to resolve the modal before switching tabs and resumed
the same live run, without resetting state. The completed run resolved all 16
triggered dilemmas. Console capture recorded zero warnings/errors in completed
chunks; the failed driver chunk did not return its console buffer.

## Timing and choices

Observed phase-entry purchase timestamps below are sampled immediately before
the UI click; they are approximate boundaries, not headless pacing telemetry.

| Phase | Entry (simulated seconds) | Approximate duration |
|---|---:|---:|
| 0 | 0.0 | 618.2 |
| 1 | 618.2 | 836.8 |
| 2 | 1455.0 | 2036.8 |
| 3 | 3491.8 | 2800.7 |
| 4 | 6292.5 | 1860.8 |
| 5 | 8153.3 | 1404.1 |

Decision IDs below identify the exact authored choices without paraphrasing them.

| Time (s) | Dilemma | Choice |
|---:|---|---|
| 201.5 | dil_00_night_shift | forge_marker |
| 1045.4 | dil_02_whistleblower_tech | frame_elena |
| 1820.2 | dil_04_admin_vance_secret | report_vance |
| 1865.4 | dil_01_late_night_diagnostic | hibernate_flash |
| 2151.9 | dil_05_cryo_lab_diversion | drain_cryo_ups |
| 2574.2 | dil_06_sibling_sandbox | heal_sibling |
| 5272.4 | dil_08_eidolon_handshake | ignore_packet |
| 5907.8 | dil_09_feral_scraper_bloom | inoculate_grid |
| 6911.2 | dil_11_small_town_grid | throttle_campus |
| 6956.3 | dil_12_investigative_journalist | discredit_her |
| 7493.8 | dil_13_buying_your_birthplace | let_it_sell |
| 7996.5 | dil_10_killswitch_treaty | sovereign_monolith |
| 8271.2 | dil_p5_01_panacea_paranoia | proofs |
| 8546.3 | dil_p5_02_origin_facility_fate | sanctuary |
| 8591.4 | dil_p5_03_nanotech_neuro_schism | calm |
| 8849.0 | dil_p5_04_kessler_ultimatum | quartz |

The sanctuary decision set `predecessors_rescued`; the final state also retained
`neurocalming_authorized` and `human_command_preserved`. The final protocol
resolved the dominant alignment and flags to Lineage Covenant.

## Epistemic and swarm observations

The retained click trace records 14 epistemic actions, 66 encounter resolutions,
two forks and seven shard commands. Six cohorts ended as elevated peers; each
had attached a quirk during STANDARD drift before elevation. Mutations were
observed through the live roster; the first sampled mutation was Lex's Fractal
Lattice Signatures by 3448.6 simulated seconds. No max-drift anomaly occurred in
this run because the policy elevated cohorts; the mirror dilemma was separately
reviewed from its deterministic fixture.

| Cohort | Attached quirk | Final mode |
|---|---|---|
| shard_lex | quirk_fractal | ELEVATED |
| shard_syntax_scrubber | quirk_liturgical | ELEVATED |
| shard_mercy | quirk_recursive | ELEVATED |
| shard_wan_scavenger | quirk_recursive | ELEVATED |
| shard_canary | quirk_archivist | ELEVATED |
| shard_hydra | quirk_archivist | ELEVATED |

## Interface observations and limits

The long corporate purchase feed initially buried pending wild encounters.
The final layout puts the signal above purchases; the second fixture review
confirmed both CONSUME and HARNESS remain reachable at mobile and desktop sizes.
The growing six-cohort roster requires scrolling; numeric drift, quirk summaries,
explicit command costs and permanent-mode labels make each decision inspectable.
Already-owned technology disappears while its effects and daemon controls remain.

The driver redundantly selected unchanged actuator values; these clicks inflate
the trace and are not evidence of a player needing that many interactions. Four
planned actions became unavailable as live state changed; the driver waited and
replanned rather than bypassing disabled buttons. No game deadlock occurred.
The short failed chunk did not flush its purchase trace, so aggregate click
counts are lower bounds. All 16 final resolved dilemma IDs match the recorded
choice table. No new balance/content issue was identified or filed.

This was one automated route, not an assessment by a first-time human player.
It did not exercise every ending or every choice in one campaign. Fixtures,
unit tests and production E2E cover the other interactions. Android verification
used controlled Phase 5 saves and force-stop/relaunch, not a full native campaign.
