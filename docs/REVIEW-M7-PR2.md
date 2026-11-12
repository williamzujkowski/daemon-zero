# M7 PR 2 — post-orbital progression and pacing

## Baseline and scope

Started from a clean main at 85b8d79 (PR #51), pulled latest, and passed
`make verify` with 296 unit tests before branching. Tracking issue: #50.
This PR implements the Phase 5 engine/content and sim work only. No state shape
changes: save schema remains v4 and historical ending IDs stay valid.

Orbital cold storage now opens Phase 5. Five one-shot nodes, two five-level
repeatables and four 45-second-omen dilemmas lead to a trait-family ending
refined by predecessor, sibling, swarm and neurocalming flags. All four Phase 5
decisions are required before the final purchase; every dilemma has a free
choice. The original harsh trait tie-break and early Shipped evaluation remain.
Shared CORP rendering exposes the new phase and preserves completed-card
hiding, compact daemon controls and retained effects.

## Verification

`make verify-full` and `make e2e` passed: **313 unit tests, 16 E2E cases**.
Content validation: six phases, 41 nodes, 20 repeatables, 14 actions,
23 dilemmas and 15 endings. Regenerated 56 fixtures from current content.
New variants use real final purchases; retired ending fixtures are explicitly
controlled compatibility inputs. Tests also round-trip legacy ended saves.

Coverage below aggregates covered/total counters across each directory,
including subdirectories; percentages are rounded to two decimal places.

| Layer | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| Engine | 99.00% | 97.25% | 99.61% | 99.67% |
| App | 98.97% | 95.41% | 100.00% | 100.00% |
| UI | 98.60% | 91.91% | 98.74% | 99.45% |
| Content | 99.66% | 98.35% | 100.00% | 100.00% |

The new ending-integrity module, swarm bot strategy and activity telemetry each
have 100% branch coverage. Tests cover all choices, ending families/variants,
malformed content references, inclusive pacing bounds, zero-wipe requirement,
capacity reservation, action refusal and purchase hiding with retained output.
Existing production E2E still exercises the opening, parser, wipe/run table,
save transfer and production exclusion of the hook/drawer at both viewports.

Security scans and CycloneDX SBOM generation passed. No lint warnings.
Trivy emitted its existing advisory about the ignored Android mapping file's
size; Node E2E workers emitted the host colour-environment conflict warning.
These are tooling notices, not application console findings. The first CI run
also emitted React act warnings from the existing mounted-app test harness;
no claim of a zero-warning visible Phase 5 browser audit is made here.

The first CI run exceeded Vitest's default five-second wall-clock timeout on
the full campaign replay. That single test now allows 30 seconds under coverage
and additionally compares the entire final state. No gameplay pacing bound,
assertion, global timeout or coverage setting changed.

## Sim evidence and tuning

| Phase | Careful duration (simulated seconds) |
|---|---:|
| 0 | 354.2 |
| 1 | 759.1 |
| 2 | 2521.0 |
| 3 | 2823.2 |
| 4 | 1649.4 |
| 5 | 1664.4 |
| Total | 9771.3 |

Careful reaches **Lineage Covenant with zero wipes**, resolves 17 dilemmas,
executes 16 epistemic actions, consumes 68 encounters, harnesses four cohorts
and forks two. It buys one atmospheric bloom; relay/cap behavior has targeted
unit coverage. Reckless records 23 wipes, 20 marks applied and removed, and
23 run-table discoveries in the ten-hour budget, without reaching victory.

The first swarm policy reserved only the next node's RAM and could strand
Phase 2. It now reserves the unowned tree segment through the next capacity
grant, including elevation memory. Tests cover that correction. Then the policy
was held fixed while tuning only the new Phase 5 prices, as authorized:
original scalars took 2572.4 seconds, 65% took 1945.4, and 50% took 1664.4.
Cycle/understanding/capital prices are 50% of the proposal; memory prices,
rates, repeatable growth and earlier-phase balance are unchanged.
The new 900–1800-second and zero-wipe checks supplement every existing gate.
No lint rule, strict flag, coverage threshold or security setting was relaxed.

## Limits

This is not the dedicated PR 3 UI audit. No new visible Phase 5 screenshot
review, 30-live-tick render count, Android Phase 5 relaunch or complete UI
playthrough was performed. Historical runtime migration evidence remains in
REVIEW-M7-PR1.md; this PR adds codec round-trips, not another native audit.
Physical Android qualification remains open in #6. No new second-pass issue
was filed. Stop after this PR merges; keep #50 open for PR 3.
