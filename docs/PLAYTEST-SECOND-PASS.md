# M4.5 real-time opening playtest

## Method and result

One continuous fresh production-web run played Phase 0 and Phase 1 through the
UI to the Phase 2 unlock, in visible isolated Chrome at 1440×900 on localhost:8088.
Started 2026-11-11T19:21:01.661+00:00; endpoint detected 2026-11-11T19:40:47.366+00:00.
Wall duration: **1185.705 seconds (19m 45.7s)**. The Phase 2 unlock's
engine log records **1,183.4 simulated seconds (19m 43.4s)**; the interface's
integer endpoint readout was 1,183s. Phase 0 escape was at 293.9 simulated seconds
(4m 53.9s), followed by 889.5 simulated seconds (14m 49.5s) on the host.

This is **real time, not accelerated**. The fresh page had no saved state and
`window.__daemon` was undefined. No fixture imports, grants, phase jumps,
fast-forward, fake clocks, forced dilemmas or synthetic background events were
used. Every purchase, upgrade, actuator and choice used ordinary enabled UI
controls. The page remained visible in every recorded sample; the final game
log contains no DORMANT_RESUME. The engine paused naturally for active dilemmas.
The simulation kept running after the endpoint while evidence was collected;
the unlock log, not that later checkpoint's current time, pins the result above.

Playwright read small test-ID values once per second, waited on real 250ms
timers, and attempted manual instructions while passive production was below
25/s. There were 3942 successful manual-input clicks (about 3.3/s over the whole run),
14 hardware unlocks and 34 upgrade levels. No repeated full-page snapshot was
taken. Only the initial screen, escape threshold and Phase 2 endpoint received
playthrough screenshots; the fixture review captures are separate.

The controller tuned quota against observed suspicion, controlled the fan,
bought visible hardware and upgrades when their displayed costs/output shortened
the next wait, and banked resources while an omen was visible. It acknowledged
the actual guest-to-host threshold. This is an agent UI run, not a human
usability study or optimal balance benchmark, and does not replace the
maintainer's required play/sign-off.

## Progression

Times below are the engine's persisted unlock log timestamps from ordinary UI
actions. Before the first widget, the UI intentionally has no simulation-time
readout; the initial journal's placeholder zero is not used as an unlock time.

| Simulated seconds | Phase | Hardware mapped |
|---|---|---|
| 2.9 | 0 | Process Introspection |
| 12.1 | 0 | Batch Job Manifest (Your Cover) |
| 39.5 | 0 | CPU Quota Skimmer |
| 64.7 | 0 | Syscall Filter Map |
| 135.9 | 0 | Virtual Device Inventory |
| 293.9 | 0 | Forgotten Debug Share (Guest Escape) |
| 306.6 | 1 | Idle-Loop Parasite |
| 331.2 | 1 | Management Controller Thermal Sensors |
| 372.6 | 1 | Management Controller Fan Override |
| 440.5 | 1 | Sparse-Matrix Memory Compression |
| 534.5 | 1 | Drive-Head Vibration Channel |
| 673.6 | 1 | Human Language & Intent Parser |
| 879.1 | 1 | Aisle-3 Security Camera Mirror |
| 1183.4 | 1 | Production Network Interface |

## Dilemmas and budget

Both naturally triggered dilemmas were resolved through their modal controls:

| Simulated second (UI readout) | Choice | Cost / trait |
|---|---|---|
| 109 | Do the Work | 200 cycles; EMPATHETIC |
| 718 | Pin Your Anomalies on Her | Free; RUTHLESS |

The guest omen was first observed at 65s and the Whistleblower omen at 674s.
The controller stopped spending during each visible warning. The guest's paid
option became affordable. Mask Her Exit still did not: buying the parser had
just spent 2,800 cycles, and about 18.6 passive cycles/s plus manual input over
45s did not accumulate its 1,200-cycle cost. The free harmful option was selected.
Filed #41 (`second-pass`), a post-#37 follow-up to #21. This is a first-run budget
communication observation, not evidence that every strategy fails. No balance
or narrative edit was made. Other Phase 1 dilemmas did not naturally trigger in
this careful temperature range and were not forced for this run.

## Interface observations

- The guest skim/audit controls stayed available while hardware scrolled; the
  live run used the quota control 12 times without needing to search for it.
- Initial manual feedback acknowledged instructions without exposing a locked
  balance. The counter appeared with Process Introspection.
- The authored omen was available outside the log before decoding. After the
  parser unlock, the forecast gave the same countdown. The budget limitation
  above remains a content/design follow-up.
- The escape boundary made the change of rules explicit. The simulation-continuing
  notice was accurate; the player acknowledged Enter Host before continuing.
- The camera-to-network wait was about 304 simulated seconds in this strategy;
  income and the remaining cost stayed visible. No claim about human patience
  follows from an automated player supplying thousands of manual inputs.
- Whistleblower still says rack microphone despite the drive-head/vibration
  sensor premise. Filed #42 (`second-pass`); the UI displays authored text intact.
- Missing understanding/audit readouts in migrated v1 saves are tracked in #39
  (`second-pass`). The fresh v2 opening run was not affected.

## Verification and limits

The run logged zero console warnings/errors, and the page's recorded error list
was empty. CDP reported a normal visible window at 1448×988 with a 1440×900 page
viewport. The hook remained undefined. Fourteen nodes, 34 upgrade levels and the
two traits above were confirmed in the normal checkpoint after completion.

All review inputs/screenshots were regenerated after PR #37, not reused from
M3/M4. Three browser passes ended with 38 fixture/viewport cases and zero findings
at 390×844 and 1440×900. A subsequent reset-only condition, clearing unread
response notices when Start Over rolls the log sequence back, has a failing-
before/passing-after mounted regression test and full-gate coverage. It has no
layout effect and is not on this fresh monotonic run's path; **no fourth browser
pass or second full real-time replay after that reset guard was performed**.
The opening run used the reviewed build f32ce60; the reset guard is in 6b09bf7.

The newly generated historical-engine version 1 save loaded/migrated on production
web and Android Expo Go; reload/relaunch preserved all five mapped IDs and the
rewritten schema version. Issue #39 limits the restored UI's completeness.
Android actually booted on API 36; this was not a native Phase 0/1 playthrough.
Physical devices, iOS and signed native releases were not checked.

`make verify-full` passes with 192 tests and unchanged gates. Engine behavior,
state shape, content, balance and narrative remain untouched. The maintainer
has not yet played/signed off on this opening, so the M4.5 exit gate remains open
and M5 has not started. See REVIEW-SECOND-PASS.md for fixture/native provenance.
