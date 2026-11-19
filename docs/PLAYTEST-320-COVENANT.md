# Covenant trim at the #319 settings: measurements and options (#320)

2026-11-19, on `main` at `8d0f92a` (#319 merged: Phase 5 scale scrutiny 1.1 suspicion/s at $1M/s net income,
exponent 0.5, ceiling 5/s). A decision note, not a change: no content number, engine rule, UI, gate, test or sim
policy changed. Nexus vote `vote-1795097688335-yjpzdgp` (4 of 7) kept the Cryptographic Covenant's -6 suspicion/s in
#319 and asked for this measurement before any change; three seats dissented that the Covenant is the late answer the
player earns and should stay at -6. Picking an option is a `consensus_vote` (AGENTS.md, "Approval and merging"), and
any retune is a separate reviewed balance change.

The question: after #319, Phase 5 goes quiet again once the Covenant (`p5_verification_proof_engine`) is bought,
because its -6/s exceeds the whole 5/s Phase 5 ceiling. Does trimming it (and the scrubber bloom,
`rep_p5_atmospheric_scrubber_bloom`, -1.2/level, max 5) bring late pressure back without breaking the pacing gates or
the live journey? The only earlier figure (-0.5 and bloom -0.6/level: STEALTH tail 851 -> 752 s) was taken at the
rejected 1.25/6 setting.

## Method

The harness and definitions of [PLAYTEST-210-MEASUREMENTS.md](PLAYTEST-210-MEASUREMENTS.md), re-run by the same
scratch script shape #319 used (not committed): `runPolicySim`'s loop, one decision per simulated second, then
`tickHz` ticks, one sample per second, from a new game admitted to campaign rules (#233), for at most
`SIM_BUDGET_SEC`. Each candidate is the production content with two numbers replaced in memory before
`buildRegistry` (schema and integrity checks run as usual); the bot is unchanged.

| Name here | What it is |
|---|---|
| STEALTH | `botStep(state, reg, 'STEALTH')`, the careful bot `make sim` gates. Answers suspicion from 20. |
| CAUTIOUS | `botStep(state, reg, 'STEALTH', EVALUATING_OVERRIDES)`, the #262 evaluating knobs: suspicion answered from 45 with at most a quarter of the bank. |
| IDLE | The committed `IDLE_POLICY` (no clicks, purchases or dials; a free answer to each interrupt). |
| Live stand-in | Headless, not committed: STEALTH until the dead drop exists in Phase 2 or later, a voluntary wipe, then the #262 knobs, one decision per 5 s, with one dormant 600 s absence through `advance()` in iteration 2 from Phase 3. An approximation of `tests/e2e/live-journey.e2e.ts`, not a substitute for it. |

- **Threat event**, as in the #210 note: a response-ladder rung climbed, thermal crossing 75 C, the AEGIS lock crossing
  25, 50, 75 or 90, a performed action that lowers suspicion or the lock, or a wipe.
- **Quiet tail**: last threat event to the end of the run. **Post-Covenant stretch**: Covenant purchase to the end.
- **Applied rate**: `appliedSuspicionRate` (the suspicion stage plus scale scrutiny, what the tick integrates).
- **Idle probe**: the run is snapshotted at the second the Covenant is bought and handed to IDLE for 1800 s. Two more
  snapshots: the second the first bloom level is bought (after the Covenant in every run) and Covenant + 400 s.
- **`make sim`**: `runHeadlessSim` and `checkGates` on the patched registry, legacy and campaign rules, exactly as
  `scripts/run-sim.ts`; for the candidate taken to the live journey, also the real `make sim` with the files edited.

The harness reproduces #319's figures on `main` exactly (STEALTH tail 806.1 s, 6 Phase 5 events, Phase 5 suspicion
mean 3.6 and max 21.0, victory 9487.6 s; CAUTIOUS 785.1 s, 2, 5.4 / 45.0, 9622.0 s).

All times are accelerated simulated seconds, never wall-clock play.

## Measured

Candidates: the four the issue suggested (-6 baseline, -3, -1.5, -0.5), each with the bloom at -1.2 and at
-0.6/level, plus -0.25 and 0 to find where anything moves. Cells are STEALTH | CAUTIOUS.

| Covenant, bloom per level | Phase 5 threat events | Phase 5 suspicion mean / max | Phase 5 mean applied rate | Quiet tail (s) | Post-Covenant: events, suspicion max, mean applied | Idle 1800 s from the Covenant |
|---|---|---|---|---|---|---|
| **-6, -1.2 (main)** | 6 \| 2 | 3.6 / 21.0 \| 5.4 / 45.0 | -3.571 \| -3.540 | 806.1 \| 785.1 | 0, 4.8, -6.584 \| 0, 9.8, -6.464 | nothing (peak 4.8) \| nothing (peak 9.8) |
| -3, -1.2 | 6 \| 2 | 3.6 / 21.0 \| 5.4 / 45.0 | -2.019 \| -2.016 | 806.1 \| 785.1 | 0, 7.8, -3.584 \| 0, 12.8, -3.465 | nothing (7.8) \| nothing (12.8) |
| -3, -0.6 | 6 \| 2 | 3.6 / 21.0 \| 5.4 / 45.0 | -1.742 \| -1.730 | 806.1 \| 785.1 | 0, 7.8, -3.048 \| 0, 12.8, -2.903 | nothing (7.8) \| nothing (12.8) |
| -1.5, -1.2 | 6 \| 2 | 3.6 / 21.0 \| 5.5 / 45.0 | -1.244 \| -1.254 | 806.1 \| 785.1 | 0, 9.3, -2.086 \| 0, 14.3, -1.967 | nothing (9.3) \| nothing (14.3) |
| -1.5, -0.6 | 6 \| 2 | 3.6 / 21.0 \| 5.5 / 45.0 | -0.967 \| -0.969 | 806.1 \| 785.1 | 0, 9.3, -1.549 \| 0, 14.3, -1.405 | nothing (9.3) \| nothing (14.3) |
| -0.5, -1.2 | 6 \| 2 | 3.8 / 21.0 \| 5.8 / 45.0 | -0.732 \| -0.755 | 806.1 \| 785.1 | 0, 10.3, -1.097 \| 0, 15.3, -0.983 | nothing (10.3) \| nothing (15.3) |
| -0.5, -0.6 | 6 \| 2 | 3.8 / 21.0 \| 5.8 / 45.0 | -0.455 \| -0.469 | 806.1 \| 785.1 | 0, 10.3, -0.560 \| 0, 15.3, -0.422 | nothing (10.3) \| nothing (15.3) |
| -0.25, -1.2 | 6 \| 2 | 4.2 / 21.0 \| 6.1 / 45.0 | -0.613 \| -0.630 | 806.1 \| 785.1 | 0, 13.3, -0.866 \| 0, 19.9, -0.737 | suspicion wipe at +743 s \| at +619 s |
| -0.25, -0.6 | 6 \| 2 | 4.2 / 21.0 \| 6.2 / 45.0 | -0.335 \| -0.347 | 806.1 \| 785.1 | 0, 13.3, -0.329 \| 0, 19.9, -0.182 | suspicion wipe at +743 s \| at +619 s |
| 0, -1.2 | 7 \| 3 | 4.3 / 21.0 \| 6.6 / 45.0 | -0.478 \| -0.506 | 759.1 \| 738.1 | 1, 20.2, -0.605 \| 1, 32.3, -0.494 | suspicion wipe at +200 s \| at +217 s |
| 0, -0.6 | 7 \| 3 | 4.5 / 21.0 \| 10.6 / 45.0 | -0.203 \| -0.259 | 759.1 \| 738.1 | 1, 20.2, -0.074 \| 1, 32.3, -0.007 | suspicion wipe at +200 s \| at +217 s |

Identical in every row, so not repeated above:

- **Wipes**: 0 for STEALTH and CAUTIOUS.
- **Victory and Phase 5 duration** (gate 900-1800 s): STEALTH 9487.6 s and 1525.4 s, CAUTIOUS 9622.0 s and 1505.4 s,
  from Phase 5 entry at 7962.2 s and 8116.6 s. At Covenant 0, STEALTH is 9488.6 s and 1526.4 s.
- **Post-Covenant stretch**: the Covenant is bought at 8698.5 s (STEALTH) and 8856.9 s (CAUTIOUS), 789.1 s and 765.1 s
  before the end (790.1 s for STEALTH at Covenant 0). Every candidate down to -0.25 adds no threat event after it.
- **`make sim` gates**: pass for every row, with unchanged thresholds. Legacy rules 9344.1 s with Phase 5 1665.4 s;
  campaign rules 9487.6 s with Phase 5 1525.4 s (9488.6 s and 1526.4 s at Covenant 0); 0 wipes. For -0.5 / -0.6 and
  0 / -0.6, the real `make sim` with the two files edited printed `[PASS] balance gates (STEALTH under legacy and campaign rules)`.
- **The other idle probes**: from the first bloom level (8781.6 s, 8905.0 s) and from Covenant + 400 s, IDLE meets
  nothing in every row down to -0.25. The only exception is Covenant 0 with the bloom at -0.6, where STEALTH's
  Covenant + 400 s snapshot climbs to suspicion 74.7 and rung 2 in 1800 s, without a wipe.
- **Live stand-in**: The Lineage Covenant in iteration 2 with its one deliberate wipe, 11,863.6 s, Phase 5 suspicion
  max 48.5, 5 Phase 5 threat events and an 847 s tail, for every row from -6 to -0.5. At -0.25: 11,898.6 s, 6 events,
  707 s tail. At 0: 11,688.6 s, 6 events, 528 s tail.

### Why the trims down to -0.5 change nothing a bot does

At the second STEALTH buys the Covenant it earns $23.0M/s of net income, so scrutiny is at its 5/s ceiling. The rest
of the suspicion stage is -4.69/s without the Covenant. Its largest answers are the Oncology & Prion Foundry (-1.8),
15 Retainer Attorneys (-1.2), 20 Decoy Traffic Shapers (-0.6) and 10 Private Perimeter Contractors (-0.6), against about
+2.95 of noisy sources. Without the Covenant the applied rate is +0.31/s (CAUTIOUS +0.35/s at $19.3M/s). The first
bloom level, bought 83 s later (48 s for CAUTIOUS), and the income growth after it take the applied rate to -0.58/s
(-0.37/s) by the end of the run.

Suspicion is 10.8 (STEALTH) and 15.8 (CAUTIOUS) at that second, below both bots' alarms (20 and 45). Any Covenant of
-0.5 or stronger keeps the net negative, so the meter drains back to 0 with nobody answering anything. No decision
changes, which is why victory, spans and event lists match to the tenth of a second. A trim moves only how fast the
meter drains and how high it peaks first (4.8 at -6, 10.3 at -0.5 for STEALTH).

The 1.25/6 sweep differed because its ceiling sat a full 1/s higher. That surplus is what let the same trim move the
tail there (851 -> 752 s).

Two smaller findings:

- The bot buys one bloom level in every run (cost growth 1.8 against a run that ends about 700 s later). So the bloom
  trim halves a -1.2/s term that exists for those last 700 s; it never touches the five-level -6/s the content allows.
- The idle probe is the first thing that moves, at -0.25. From the Covenant second, IDLE then takes a free dilemma
  choice that adds suspicion (20 points for the air-gap lockdown at Covenant 0) on top of a slightly positive net.
  From that point the ladder carries it to an asset-seizure wipe. A playing bot answers the same climb before it
  matters.

## Live journey (`make e2e-live`)

The live journey is the check #319 needed: its first Phase 5 setting passed `make sim` and failed here. Each
candidate was applied to the two content files on a scratch checkout, `make sim` was run, then `make e2e-live`
(production export, `e2e-lock.sh` port slot, Playwright's running clock, phone and desktop). The test was not
touched, and the files were restored afterwards. A control on unmodified `main` ran the same way.

| Content | `make sim` | `make e2e-live` | Endings (desktop, phone) |
|---|---|---|---|
| `main` (-6, -1.2), control | pass | **2 passed** (6.4 min) | VERIFIED_COVENANT at T+11380 s, VERIFIED_COVENANT at T+11418 s |
| -0.5, -0.6 (the strongest suggested trim) | pass | **2 passed** (6.2 min) | LINEAGE_COVENANT at T+11376 s, VERIFIED_COVENANT at T+11444 s |
| 0, -0.6 (option 3's harshest form) | pass | **2 passed** (6.5 min) | VERIFIED_COVENANT at T+11293 s, VERIFIED_COVENANT at T+11643 s |

Every run ended in iteration 2 with its one deliberate wipe, so it satisfied the test's `Iteration 2 // Wipes 1`
assertion. The milder trims (-3, -1.5, -0.5 with the bloom at -1.2, -0.25) lie between rows that pass and were not run
live; the headless measurements put them between those rows too. Which Ark variant a live run ends on varies between
runs of the same content: #319 reported LINEAGE_COVENANT on both viewports for `main`, and the control here got
VERIFIED_COVENANT on both. So the ending column is not evidence about the trim.

This is a scripted browser run on the web export, not a device test and not a human session.

## Options

1. **No change: keep -6 and the bloom at -1.2.** Effect: none. The last 789 s (STEALTH) and 765 s (CAUTIOUS) after the
   Covenant stay threat-free, and a 30-minute idle from the Covenant meets nothing. This is the dissenting seats'
   position, and it matches DESIGN.md's Phase 5 text ("the Cryptographic Covenant is the answer that outweighs it").
   The measurement adds a reason: no trim down to -0.5 buys a measurable change. Touches this note only.
2. **A cosmetic trim (-3, -1.5 or -0.5, with or without the bloom at -0.6).** Effect on what a careful player meets:
   none measured. Threat events, quiet tail, wipes, victory time, Phase 5 span and idle probes are identical to `main`.
   The Covenant becomes one answer among several rather than one that outweighs the ceiling by itself. The post-Covenant
   applied rate falls from -6.58 to between -3.58 and -0.56/s (STEALTH), and the meter peaks a little higher before it
   drains (7.8 to 15.3). Risk: low for the gates. `make sim` passes and the live journey passes at -0.5 / -0.6. The
   cost is churn for no change a player can feel. The pinned production report hash in `tests/sim.spec.ts` moves
   (measured at -0.5 / -0.6: the careful-run hash test fails, although victory and spans are identical), so it needs a
   recorded delta. BALANCE.md's Phase 5 rates would need re-measuring, and DESIGN.md's "outweighs" sentence would need
   rewording. Touches the two content files, BALANCE.md, DESIGN.md, `tests/sim.spec.ts`, a `consensus_vote`.
3. **Remove the Covenant's suspicion role (-0.25 or 0).** The only range measured that changes anything. At 0, one more
   threat event per run (STEALTH's lobbying blitz at 8729.5 s), the tail shrinks by 47 s (806.1 -> 759.1 s; CAUTIOUS
   785.1 -> 738.1 s), and a 30-minute idle from the Covenant ends in a suspicion wipe at +200 s (+217 s). At -0.25 only
   the idle probe moves (wipe at +743 s, +619 s). Pacing and gates do not move, and the live journey passes at 0 / -0.6.
   Risk: it removes what the dissenting
   seats called the earned answer. It makes buying the Covenant a moment the meter starts climbing, so its readout and
   DESIGN.md text would change. The quiet tail is still 738-759 s, because once the bot answers the one climb, the
   bloom and the attorneys hold suspicion at 0 again. Same touch list as option 2, plus the Covenant's description if it
   should say it no longer quiets anything.

None of these makes the end of Phase 5 pressured. That stretch is quiet because the rest of the late answers (-4.7/s
without the Covenant, -5.9/s with one bloom level) already match the 5/s ceiling. Real late pressure needs a different
lever: a higher Phase 5 ceiling (6/s failed the live journey in #319), a draw that keeps growing past the ceiling while
the player saves for TRANSCENDENCE, or the authored late events of the #210 note's option (a)3. Each of these is a
separate design question with its own vote, and none is measured here.

## Decision

Pending. The vote should declare every option above, including no change.

## Decision

Nexus vote vote-1795102810471-h2ihpex (2026-11-19, 7 seats, simple majority): **no-change**, 7 of 7,
no dissent. The Covenant stays at -6 suspicion/s as DESIGN.md describes it. Trims down to -0.5 measure
as no change a player meets, and the trims that do move anything (-0.25 or 0) contradict the
Covenant's stated role. This note records the measurement and #320 closes with it.
