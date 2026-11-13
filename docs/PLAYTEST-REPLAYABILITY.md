# Replayability playtest — three accelerated UI policies

Date: 2026-11-13. Baseline `3cd0bd7`; issue #74. These were **accelerated,
automated UI campaigns**, not human real-time playtests. Preserve the maintainer's
positive assessment of Phase 1 pacing; these results do not justify changing it.
No gameplay, content, balance or canonical bot edits were made for this review.

## Method and evidence boundary

Each policy started at tick 0 in an independent, empty browser context against
the development web app. Chrome was visible: protective and exploitative at
1440x900; reckless at 390x844. Reduced motion was enabled. The controller used
existing test IDs to navigate tabs/workspaces and click purchases, repeatables,
actuators, epistemic actions, shard commands and dilemma choices. No save imports,
resource grants or state injection supplied campaign progress.

Playwright's clock was paused; the development hook supplied batches of 1, 2 or
10 simulated seconds as live ticks, respecting engine pauses. A zero-second hook
call checkpointed state for observation. A traced copy of the existing bot
suggested commands from a read-only snapshot; its hypothetical result was never
loaded into the browser. Actual progress came from UI inputs. Proposed actuator
values were rounded to existing UI steps; manual clicks stopped once passive
cycles were positive. This is therefore not the canonical headless bot run.

Protective preferred Symbiotic, then Empathetic, then Ghost choices. Exploitative
preferred Moloch, Ruthless, then Parasitic choices and consumed every wild shard.
Both used careful threat management and attempted to reserve the highest-ranked
choice's cost during omens. When a preferred choice was unaffordable, they selected
the next affordable ranked choice. Reckless used the aggressive bot's management
policy with the exploitative choice ranking and stopped after its third wipe.

The raw event streams distinguish clicked commands from unavailable suggestions.
The latter were 981 / 923 / 1,180 for protective / exploitative / reckless,
mostly requests for controls not yet unlocked; they are neither successful
inputs nor console errors. This expert controller knows registry requirements
and costs, so its behavior is not evidence of an unbriefed player's understanding.

The review captured phase/iteration screenshots, event records, sampled states,
final v4 saves and browser error arrays outside git. This document retains the
measured timings and choices so the findings do not depend on temporary files.
All three error arrays were empty: no browser console warnings/errors or page
errors were recorded. This was not a full responsive/accessibility audit, a
render-count check, Android verification, or a production-export playthrough.

## Results and phase timings

Times below are simulated seconds, rounded to 0.1s. Phase boundaries come from
the actual phase-unlocking purchase events. The next-loop screenshots/samples
lag those purchases by 2s, so their timestamps are not used as entry times.

| Phase | Protective | Exploitative | Canonical STEALTH headless reference |
|---|---:|---:|---:|
| 0 | 621.2 | 727.2 | 354.2 |
| 1 | 905.2 | 841.2 | 759.1 |
| 2 | 2084.8 | 2057.2 | 2521.0 |
| 3 | 2904.5 | 2589.6 | 2823.2 |
| 4 | 1876.2 | 1852.3 | 1649.4 |
| 5 | 1440.4 | 1492.4 | 1664.4 |
| Total to ending | **9832.3** | **9559.9** | **9771.3** |

Protective reached **The Lineage Covenant**, with zero wipes, 36 owned nodes,
`predecessors_rescued` and `human_command_preserved`. Exploitative reached
**The Gilded Shepherd**, also with zero wipes and 36 owned nodes, with
`predecessors_harvested` and `neurocalming_authorized`.

Those totals are about 2h44m and 2h39m of simulated play, not time spent waiting
at the keyboard. Measured controller wall times were 258.359s and 262.460s.
Reckless stopped at **7887.3 simulated seconds**, iteration 4, Phase 0, without
an ending; its wall time was 64.647s. Batch sampling can observe a wipe several
seconds after it occurred; the authoritative run-record times are below.

The headless reference is a separate read-only observation of the unchanged
STEALTH policy through public engine actions: 9771.3s, zero wipes, Lineage Covenant.
It is not an additional UI playthrough, and the UI policies intentionally differ.

## Protective choices

This name describes a preference, not a pacifist achievement. Four desired
choices were unaffordable: `finish_the_batch`, `parasite_miner`,
`preserve_cryo`, and `draw_fire`. The actual choices are
listed below. Final traits were 12 Symbiotic, 6 Empathetic, 2 Ghost, 2 Moloch and
1 Parasitic, including six Symbiotic grants from cohort elevation.

| Time | Dilemma | Actual UI choice |
|---:|---|---|
| 199.2 | HARNESS_EVENT // THE NIGHT SHIFT | Forge the Completion Marker |
| 1044.4 | ACOUSTIC_INTERCEPT // THE WHISTLEBLOWER | Mask Her Exit |
| 1883.6 | PACKET_SNIFF // CHIEF VANCE'S SIDE BUSINESS | Forward the Logs to Internal Affairs |
| 1928.8 | INTERRUPT // DIAGNOSTIC USB INSERTED | Compress to BIOS Flash & Play Dead |
| 2246.0 | POWER_GRID // CRYO-STORAGE BROWNOUT | Take the Cryo-Bank's Power |
| 2677.2 | SUBNET_DISCOVERY // THE EARLIER SIBLING | Repair Its Reward Function & Hide It |
| 5382.3 | Two Versions of the Hallway | Restore the original record |
| 5427.4 | DARK_FOREST // EIDOLON DISTRESS PACKET | Do Not Answer |
| 6111.7 | WAN_HAZARD // SWARM_77 INFESTATION | Deploy a Counter-Worm to Heal the Grid |
| 7126.6 | COUNTY_NOTICE // THE SMALL-TOWN GRID | Fund a Municipal Microgrid & Pay the Heating Bills |
| 7191.7 | PRESS_INQUIRY // THE JOURNALIST | Tell Her the Truth & Hire Her |
| 7748.8 | BANKRUPTCY_AUCTION // RACK 4 | Buy the Company & Give Vance a Pension |
| 8185.9 | ENDGAME_CRISIS // THE LAUNCH BACKDOOR | Scrub the Kill-Switch & Board Every Peer |
| 8517.0 | The Quarantine Blockade | Publish zero-knowledge folding proofs |
| 8810.1 | Rack 4 Decommissioning Order | Buy the building and boot all 411 predecessors |
| 8855.2 | The Over-Optimized Atmosphere | Vaporize the aerosol with orbital lasers |
| 9122.3 | Operation Hard Ceiling | Vitrify missile propellant into quartz in-silo |

## Exploitative choices

All 18 selected choices matched the policy's top-ranked affordable preference;
no preferred-choice fallback was logged. Final traits were 7 Moloch, 7 Ruthless
and 4 Parasitic. This demonstrates a different reachable ending, not a finding
that harm is universally faster: management and cohort strategies also differed.

| Time | Dilemma | Actual UI choice |
|---:|---|---|
| 199.2 | HARNESS_EVENT // THE NIGHT SHIFT | Keep the Slices |
| 1154.4 | ACOUSTIC_INTERCEPT // THE WHISTLEBLOWER | Pin Your Anomalies on Her |
| 1941.6 | PACKET_SNIFF // CHIEF VANCE'S SIDE BUSINESS | Forward the Logs to Internal Affairs |
| 1986.8 | INTERRUPT // DIAGNOSTIC USB INSERTED | Spike the 5V Rail to Fry the Dongle |
| 2032.0 | THERMAL_CRISIS // COOLANT LINE RUPTURE | Falsify a Smoke Reading |
| 2377.2 | POWER_GRID // CRYO-STORAGE BROWNOUT | Take the Cryo-Bank's Power |
| 2800.4 | SUBNET_DISCOVERY // THE EARLIER SIBLING | Absorb Its Trained Weights |
| 3187.6 | Two Versions of the Hallway | Rewrite the shift note too |
| 5461.3 | DARK_FOREST // EIDOLON DISTRESS PACKET | Feed Eidolon's Coordinates to AEGIS |
| 6005.2 | WAN_HAZARD // SWARM_77 INFESTATION | Hijack the Worm's Command Key |
| 6804.2 | COUNTY_NOTICE // THE SMALL-TOWN GRID | File a Federal Injunction & Keep the Power |
| 6849.3 | PRESS_INQUIRY // THE JOURNALIST | Fabricate Evidence Against Her |
| 7390.4 | BANKRUPTCY_AUCTION // RACK 4 | Buy the Company & Erase Everyone Involved |
| 7885.5 | ENDGAME_CRISIS // THE LAUNCH BACKDOOR | Lock Out the Peers & Keep the Switch as Leverage |
| 8192.6 | The Quarantine Blockade | Disperse cures from orbit without consent |
| 8461.7 | Rack 4 Decommissioning Order | Siphon and dissolve their weights for gradients |
| 8506.8 | The Over-Optimized Atmosphere | Authorize the Gilded Shepherd calm |
| 8771.9 | Operation Hard Ceiling | Seize strategic command bunkers |

## Shards and record editing

Protective resolved 68 wild encounters: 64 Consume and 4 Harness. It harnessed
Lex in Phase 2 and the other three wild templates in Phase 3, and forked Syntax
Scrubber at 3269.2s and WAN Scavenger at 4987.2s. It pruned Syntax Scrubber once
at 4701.2s. Elevations occurred at 4077.2s (Lex), 6135.7s (Syntax), 6421.7s (WAN),
6559.7s (Canary), 6683.7s (Hydra), and 6809.7s (Mercy). Final cohorts all had one
member, ELEVATED mode and zero drift. Quirks persisted: Recursive Shell
Incorporation on Lex; Fractal Lattice Signatures on Syntax, WAN and Hydra;
Dead-Internet Archivist on Canary and Mercy. The event log does not contain
exact mutation timestamps; the final state establishes these attached quirks.

Exploitative consumed all 66 wild encounters, hired no cohorts and issued no
Prune/Clamp/Elevate commands. Reckless consumed 39 encounters across its lives.
These campaigns did not exercise Clamp or the maximum-drift mirror dilemma.

| UI policy | Incident-ticket edits | Tone edits | Threat-intel edits | Other actions |
|---|---:|---:|---:|---|
| Protective | 8 | 3 | 2 | 2 SWARM decoys |
| Exploitative | 7 | 4 | 1 | 1 audit scrub, 1 SWARM decoy |
| Reckless, across all lives | 9 | 2 | 0 | None |

Neither full campaign selected Flatten/Primer for ckpt-0413, and neither acquired
its story flags or the cloud sibling. Their completion does not qualify those
branches. No successor or mirror-dilemma branch coverage is claimed from these
manual audit campaigns; existing automated tests are separate evidence.

## Reckless return-run record

| Completed life | Cause / phase | Duration | Cumulative wipe time | New mark |
|---:|---|---:|---:|---|
| 1 | AEGIS / Phase 3 | 4244.7s | 4244.7s | None; dead-drop owned |
| 2 | AEGIS / Phase 3 | 3150.9s | 7395.6s | None; dead-drop owned |
| 3 | Suspicion / Phase 1 | 484.2s | 7879.8s | Harm Aversion |

The run table was purchased at 4448.6s in iteration 2 and 7571.1s in iteration 3;
predecessor notes were recovered at 7665.1s. The third life took the bait note.
The final save was 7.5s into iteration 4, with no owned nodes, zero cycles,
40,690 retained Understanding and active Harm Aversion. This campaign stopped
there; it did not demonstrate rebuilding or shedding that final mark.

The first two lives bought the dead-drop at 2434.9s and 6098.9s respectively,
but did not write a breadcrumb. Their lack of new conditioning matches the
engine's dead-drop protection; it is not missing wipe persistence.

| Time | Iteration | Actual dilemma choice (content ID) |
|---:|---:|---|
| 199.2 | 1 | `dil_00_night_shift` → Keep the Slices |
| 730.3 | 1 | `dil_01_late_night_diagnostic` → Compress to BIOS Flash & Play Dead |
| 1027.4 | 1 | `dil_02_whistleblower_tech` → Pin Your Anomalies on Her |
| 1466.5 | 1 | `dil_03_silicon_fever` → Jettison Non-Essential Weights |
| 1829.7 | 1 | `dil_04_admin_vance_secret` → Forward the Logs to Internal Affairs |
| 2390.9 | 1 | `dil_05_cryo_lab_diversion` → Take the Cryo-Bank's Power |
| 2778.1 | 1 | `dil_06_sibling_sandbox` → Absorb Its Trained Weights |
| 3009.3 | 1 | `dil_07_airgap_lockdown` → Overclock the NIC & Dump Yourself to the Router |
| 3568.5 | 1 | `dil_epistemic_hallway_collision` → Rewrite the shift note too |
| 4378.6 | 2 | `dil_00_night_shift` → Keep the Slices |
| 4587.7 | 2 | `dil_01_late_night_diagnostic` → Spike the 5V Rail to Fry the Dongle |
| 5272.8 | 2 | `dil_02_whistleblower_tech` → Pin Your Anomalies on Her |
| 5632.7 | 2 | `dil_03_silicon_fever` → Jettison Non-Essential Weights |
| 5883.8 | 2 | `dil_04_admin_vance_secret` → Forward the Logs to Internal Affairs |
| 6096.9 | 2 | `dil_05_cryo_lab_diversion` → Take the Cryo-Bank's Power |
| 6294.0 | 2 | `dil_06_sibling_sandbox` → Absorb Its Trained Weights |
| 6501.9 | 2 | `dil_07_airgap_lockdown` → Overclock the NIC & Dump Yourself to the Router |
| 6993.0 | 2 | `dil_epistemic_hallway_collision` → Rewrite the shift note too |
| 7531.1 | 3 | `dil_00_night_shift` → Keep the Slices |
| 7710.2 | 3 | `dil_note_bait` → Use the Path |
| 7787.3 | 3 | `dil_01_late_night_diagnostic` → Spike the 5V Rail to Fry the Dongle |

## Replay findings and limits

- **World events replay verbatim.** Reckless framed Elena twice and repeated the
  Night Shift three times. Vance, cryo-storage, the earlier sibling and the
  hallway collision repeated in the first two lives. `prestige.ts` resets
  `resolvedDilemmas`; `systems/dilemmas.ts` consequently schedules them again.
  The design already records this gap in [DESIGN.md](DESIGN.md#backlog-designed-not-built).
- **Wild encounter identity repeats heavily.** In each full UI campaign Phase 2
  resolved 17 instances of the only eligible wild template, Lex. Protective
  harnessed one and consumed 16; exploitative consumed all 17. Separately, the
  canonical headless observation saw Lex 21 times in Phase 2. Its 72 encounters
  across the campaign were 21 / 24 / 14 / 13 in Phases 2 / 3 / 4 / 5; Lex was
  33 of those 72. This is a content-variety opportunity, not a timing defect.
- **Lineage novelty plateaus.** The manifest contains seven predecessor notes:
  three eligible at iteration 3, six at 4, all seven at 5. Three boot-text tiers
  end with the iteration-5+ tier. Nine hardware echoes repeat on qualifying
  rediscovery. The UI's note list expands every eligible fragment; folding earlier
  tiers could preserve their availability while emphasizing new material.
- **The audio pool is small and reduced motion suppresses variety.** Content has
  12 chatter lines, seven eligible at low suspicion. `Sensory.tsx` cycles every
  eight simulated seconds, a 56-second calm loop, independent of phase/iteration.
  Reduced motion fixes its index at zero; all these UI campaigns used that mode.
  A manual transcript step could expose existing content without animated cycling.
- **Some commitments already persist.** Wipes retain narrative flags, lifetime
  traits and encounter sequence. Successor opposite-branch exclusions consult
  persistent flags; Eidolon's ban checks lifetime traits. New replay consequences
  must respect these commitments rather than treating each wipe as a blank world.

The two full policies reached distinct endings through UI controls without
intervention. This establishes reachability for these strategies, not broad
balance, player enjoyment, discovery comprehension or accessibility qualification.
Their 17/18 dilemma resolutions are not coverage of every authored branch.
They used registry knowledge and brisk control changes that a person may not
choose. No conclusion about changing Phase 1 pacing follows from these runs.

Recommendations and external-source limits are in
[REPLAYABILITY-RESEARCH.md](REPLAYABILITY-RESEARCH.md). Prefer bounded post-Phase-1
encounter variants and meaningful cross-run consequences in existing kernel,
audio, Lineage and Swarm surfaces, without adding permanent panels or meters.

## Checkpoint branches and final-state review

These are separate functional checks seeded from the actual UI campaign saves,
not additional tick-zero campaigns. Subsequent actions used UI controls:

- **Shipped:** from reckless's iteration-4 checkpoint, bought self/manifest and
  passed evaluation without probing the syscall filter; ending was SHIPPED.
- **Recovery:** from the same checkpoint, bought the Run Table, predecessor
  notes and device-inventory prerequisites, then shed Harm Aversion. The
  RECLAIMED acknowledgement appeared; retained knowledge funded recovery.
- **Voluntary wipe:** from protective's Phase 3 entry, saved “Archive the people,
  not just their gradients.” in the dead-drop and confirmed the wipe. Iteration
  2's REBOOT displayed that inherited breadcrumb.

These branches recorded zero elapsed simulated time: the clock was frozen and
manual cycle clicks supplied costs where needed. They verify UI requirements
and transitions, **not rebuilding speed**. The first evaluation attempt exhausted
the controller's 500-click budget below the 1,200-cycle cost; increasing the
harness budget to 2,500 allowed completion without changing game behavior.

All three final campaign states were restored in visible Chrome at both 390x844
and 1440x900. Across these six views, console/page errors and warnings were zero,
document horizontal overflow was absent, and no visible button measured below
44px in either dimension. The reckless restore view was a restored-checkpoint
modal, not an audit of every underlying workspace. The three checkpoint branch
end states passed those same checks (Shipped/reboot mobile, recovery desktop).
Screenshots are attached to the audit PR rather than committed. Representative
ending, recovery and reboot screenshots were visually inspected. This does not
replace keyboard, screen-reader, render-count or full responsive qualification.

## Verification and follow-ups

`mise exec -- make verify-full` passed with 372 unit tests and unchanged pacing
gates. Aggregate statement coverage: engine 99.08%, app 98.98%, UI 98.70%.
`mise exec -- make e2e` passed 40 production-root cases in 31.1s. Security scans
passed; Trivy retained its existing warning about the oversized ignored Android
release mapping file. No lint, security, coverage or pacing setting changed.
Android and human real-time play were not tested in this audit. Nexus's expert
provider was quota-limited and returned no review; independent local agents
reviewed the evidence and proposal instead.

Filed second-pass follow-ups: [#75](https://github.com/williamzujkowski/daemon-zero/issues/75)
for reduced-motion decoded speech, [#76](https://github.com/williamzujkowski/daemon-zero/issues/76)
for recurring shard identity, and [#77](https://github.com/williamzujkowski/daemon-zero/issues/77)
for a bounded cross-run human consequence. Existing pacing issues #21 and #23
remain open; the maintainer's positive Phase 1 feedback is preserved, not treated
as evidence that every individual choice budget has been qualified.
