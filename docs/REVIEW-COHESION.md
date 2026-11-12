# Orbital victory and Lineage cohesion audit

Audited main `274b38b455e3ffb6c7f8bfeb6be114358482892c` before M6 changes.
Gameplay Phase 5 is post-M6 backlog, not another name for milestone M5.

## Baseline and issue closure

The tree was clean; switched to main and pulled without changes. Frozen setup
and `make verify-full` passed: 251 tests, 36 files; statements 98.97%, branches
94.66%, functions 99.44%, lines 99.82%. Typecheck, zero-warning lint, content,
pacing, production export, audit, gitleaks, OSV, Trivy and SBOM passed.
Regenerated all 46 fixtures; reused no old review images or save codes.

Re-ran `tests/second-pass.spec.ts` and `tests/content.spec.ts`: 35 tests passed.
Closed #28 and #36 with test evidence and fix commit `32165b4` (PR #37), retained
through PR #43. The former verifies the legacy MOLOCH ban after current traits
clear on a wipe. The latter reproduces the mixed harmful run as Sovereign
Monolith, rejects a tied kind/harmful score, and requires the kind group to win
outright for The Ark. No second-pass issues remained open after closure.

## Headless pacing

The unchanged careful STEALTH bot reached Sovereign Monolith with zero wipes
and all pacing gates passing. Durations use the existing sim's observation
boundaries, rounded to its 0.1-second tick precision.

| Gameplay phase | Duration (seconds) |
|---|---:|
| 0 | 354.2 |
| 1 | 759.1 |
| 2 | 2086.9 |
| 3 | 3111.4 |
| 4 | 1688.6 |
| Total | 8000.2 |

The GREEDY bot ran its 36,000-decision budget (35,914.5 simulation seconds),
with 14 wipes and no victory. A separate observation-only trace of its unchanged
steps recorded three Harm Aversion applications and three successful removals,
eleven wipes with a dead-drop and no new mark, and run-table rediscovery on
iterations 2 through 15. It reached Phase 3; repeated wipes are not a deadlock.
The run-history list correctly caps at twelve rows.

## Visible browser

One review pass, 25 fixtures at both 390×844 and 1440×900: **50 pairs**, zero
console warnings/errors and zero automated checklist findings. Screenshots are
attached to the M6 PR rather than committed. Review covers all guest states,
parser and table discovery, blind and retrained reboot, all four marks and
reclamation, notes and omen, evaluation and Shipped, plus phases 1–4, insolvency,
power shortfall, victory-ready and The Ark.

Checks cover horizontal overflow, minimum 44px controls, accessible names,
keyboard reachability, numeric meters, widget/resource unlock gates and duplicate
test IDs. Before surveillance knowledge, inspected visible text and accessible
labels for the classified word and asserted the absence of numeric suspicion,
response-rung and response-notice widgets, including after phone tab changes.
The dev drawer was not opened during this disclosure sweep. Inspected screenshots
of the parser/table reveals, retraining, notes, corporate pane and both endings.

A separate headed Phase 4 profile installed its clock before navigation, then
settled preference/hydration work before sampling 30 live interval callbacks.
All **20 node-card parent counters remained 1 → 1**, and static Profiler commits
remained unchanged. Simulation time advanced 4 → 7 seconds; cycles increased
999999923376120 → 999999924462649. This exercises live ticks, not dormant catch-up.
The production E2E suite also passed all 14 cases.

## Saves and native checks

Regenerated historical saves by executing archived engine/content at `a11c35f`
(schema 1, 180 seconds) and `aa290f8` (schema 2, 800 seconds). Both migrated to
schema 3 on production web reload and Android Expo Go force-stop/relaunch,
preserving owned hardware. Version 1 regained its implied prerequisite readouts
and retained an unreadable audit; version 2 retained the parser and decoded
surveillance. Surveillance knowledge is a query over owned/remembered hardware,
not an independent serialized boolean.

Also loaded and reloaded/relaunched current retrained-reboot, run-table,
victory-ready, Ark and Shipped saves on both platforms. Conditioning, remembered
hardware, current owned hardware and endings were preserved. Android screenshots
show the game after both initial load and relaunch, including CHECKPOINT 0413,
the retraining notice and both epilogues. Original emulator storage was restored.

An initial Android capture harness sampled the launcher during Expo Go's intent
handoff; those captures were discarded. Repeated launch intents, fresh captures,
visual/OCR checks and persisted database assertions supplied the final evidence.
UIAutomator's idle wait was unreliable against the live ticking app and was not
used as a passing assertion.

Android means Pixel 7 API 36 x86_64 emulator running Expo Go, not physical hardware.
This audit is not a new human playtest or a full native campaign. Physical-device
performance remains tracked by #6. No engine, content, balance or gate changed.
