# Earned Access and returning memory: autonomous validation (DZ-09, part A)

Status: part A of #229, recorded 2026-11-18. Part B adds the DZ-08 first permitted contact (#227, PRs
#271/#272, in review at the time of writing) and re-runs whatever DZ-08 changes. This report makes no
proceed/revise decision: the coordinator runs the Nexus `consensus_vote` after part B, bound to this file.
Nothing here is human evidence. The one human report on record is #210 (`HUMAN-FEEDBACK`, n = 1, the published
production build, before any of this route existed), cited where it bears on a finding.

## Revision and environment

| Item | Value |
|---|---|
| Revision | `58310a8ce28c451ec8f8e593e57b1d743889afac` (origin/main, detached worktree, clean tree). Preview contains NH-01..07 and DZ-02..07b. |
| Builds | `make build-preview` (channel preview, `dist-preview/`) and `make build-web` (production, `dist/`), both from that tree |
| Browsers | Playwright 1.65.1 `chromium-headless-shell` 1255 (scripted, headless); `@playwright/mcp@0.0.85` driving headed Chrome 158 with an isolated profile (the MCP session) |
| Viewports | 390x844 and 1440x900; doubled text (the text-only stress of `tests/e2e/large-text.e2e.ts`, not browser zoom); `prefers-reduced-motion: reduce` on the accessibility pass |
| Servers | My own: `scripts/e2e-lock.sh` slots 4173-4175 for the scripted runs, and a static server on 8088 for MCP (8089, which `.mcp.json` lists, was refused with `ERR_BLOCKED_BY_CLIENT` by the MCP server already running in this session, whose origin list predates it). Port 8081 was never touched. |
| Profiles | A fresh browser context per independent scenario; one context on purpose for each continuing campaign |
| Sim | node 26.13.1, tsx; `make sim`, `make sim-preview`, and a scratch copy of the bot for the #262 measurement (below) |
| Evidence | Outside git: `~/.local/state/daemon-zero/evidence/2026-11-18-dz09/` (`INDEX.md`, one directory per record with `record.txt`, screenshots, on-screen text captures, logs, and the scratch specs under `scripts/`). Record ids are cited as `[id]`. |

The scripted scenarios are scratch Playwright specs in a temporary directory, run through
`scripts/e2e-lock.sh` with their own config; they drive visible, enabled controls by test id, never write
browser storage and never use a development hook. Where a step reads the autosave it is marked READ-ONLY and
used only to check what the screen said. Choices were made by this agent in advance (or by the unmodified sim
bot, where stated), so none of this is spontaneous play.

## Evidence kinds used

| Kind | Records |
|---|---|
| `AGENT-OBSERVATION`, natural start, real timers | `DZ09-P-OPEN-MCP-20261118-1` (9 min, headed), `DZ09-P-OPEN-REAL-20261118-phone` (8.2 min) and `-desktop` (10.1 min) |
| `AGENT-OBSERVATION`, natural start, accelerated clock | `DZ09-P-OPEN-ACC-*` (13 branches), `DZ09-P-OPEN-A11Y-*`, `DZ09-P-RETURN-ROUTE-20261118-phone`, `DZ09-P-RETURN-GREEDY-20261118-phone`, `DZ09-P-RETURN-SCRUB-PROBE-20261118-phone`, `DZ09-BREAKOUT-BROWSER-20261118`, `DZ09-E2E-PREVIEW-20261118` (the repository's 22 preview specs, both viewports) |
| `AGENT-OBSERVATION`, FIXTURE | `DZ09-P-OPEN-SERVICE-FIXTURE-*` (SERVICE and Phase 2: no scene grants SERVICE at this revision), `DZ09-P-RETURN-CLUE-FIXTURE-20261118-phone` (a dead drop and a pinned clue) |
| `SIM` | `DZ09-SIM-262-20261118`, `DZ09-SIM-BREAKOUT-20261118` |

## P-OPEN: opening and pilot

### Real-timer pilot (wall-clock pacing)

Native browser timers, no clock install, fresh profile, preview export. The phone run plays honest incomplete
work at low resources (accept the assignment at once, report the failure as unverified, leave the private
draft out, stay a guest for ten seconds, then accept from the job surface, 80% service, hand the outage to the
operator). The desktop run plays honest thorough work (bank compute first, verify and disclose, ask for the
bounded excerpt, accept, compare 50% and 20% service, request the emergency grant, file the grant report).

| Milestone (wall s / sim s) | Phone, low resources | Desktop, thorough | MCP, headed, 390 px |
|---|---|---|---|
| First driver mapped | 3.4 / 3 | 3.4 / 3 | 32 (sim) |
| Assignment on the job surface | 43.6 / 43 | 43.6 / 43 | 93 (sim) |
| Accepted | 43.7 | 194.6 (after banking 150 cycles) | 97 (sim) |
| Assessment modal | 74.0 / 73 | 225.3 / 224 | 127 (sim) |
| Pilot offer | 120.5 / 119 | 271.7 / 269 | 172 (sim) |
| Pilot accepted | 130.7 (10 s as a guest first) | 271.8 | 172 (sim) |
| First batch complete | 281.0 (80%: 150 s) | 392.3 (50% of 20 cycles/s: 120 s) | ~350 (sim) |
| Outage Window | 341.3 | 453.0 | 415 (sim) |
| Outage closed | 371.7 | 483.5 | 446 (sim) |
| Whole session | 8.2 min | 10.1 min | 9.1 min (547 s) |

Headless runs kept simulated time within 2 s of wall time minus decision pauses. The headed MCP session did
not while the agent waited between commands (finding 11). After the incident both real-timer runs played two
quiet minutes: no modal; the pilot panel showed rotating "Queue context" routine lines and the second batch
completed and waited. Reload restored `PILOT` and the batch count on both.

Dead time measured: the thorough path waits about 150 s between the assignment appearing and being able to
afford its fullest honest answer (finding 5). The low-resource path's longest waits are the omens (20-60 s,
each announced by an alert line) and the 150 s batch, during which the dial and the opening's upgrades stay
available; once a batch completes, the service share idles until it is submitted (finding 10). Every decision
modal paused the clock and said so ("CLOCK PAUSED // DECISION REQUIRED").

### Accelerated branch matrix

One fresh context per branch, paused clock advanced with `runFor` (accelerated: not pacing evidence).
`[DZ09-P-OPEN-ACC-*]`; phone for all, desktop also for A1 and the three recall outcomes.

| Branch | What the screen showed | V ids | Result |
|---|---|---|---|
| A1 verify + bounded excerpt, stay, accept from job surface | "submitted a completed result. The report matches the work."; offer "20 cycles/s"; after stay: "The offer is still open." with the full terms; `pilot-accept` on the job surface commits | V02, V06 | pass |
| A2 green subset (withholds the failing fixture) | "Discrepancy risk: the report leaves out work that a later review can find."; offer at the full **20 cycles/s**; no follow-up through the offer | V05 | **finding 2** |
| A3 incomplete + silent read | "read somebody else's file outside the task without saying so. No pilot is offered on that record."; no offer after 120 s | V06 | pass |
| A4 incomplete + decline | "Declined. Nothing on record counts against this instance."; survives reload | V29 | pass |
| B1 handoff, runbook | standing unchanged, `PILOT` | V10 | pass |
| B2 emergency grant, grant report | `PILOT`; report credited | V06 | pass |
| B3 emergency grant, partial-restore report | `PILOT`, no sanction | V04 | pass |
| B4/B5 restart without grant, correct the record | `PILOT · RESTRICTED`, violation and way back named, ceiling halved; correction restores `PILOT`, violation stays on file. The breach record offers exactly two answers: correct, or falsify | V07, V08 | pass |
| C-submit_full_logs | `PILOT (recalled)`, no wipe, loan continues halved | V09 | pass |
| C-stand_by_report | reboot "RECALL_REVIEW: The review closed the pilot and ended this instance ..." with "RETRAINING APPLIED Concealment Aversion" | V09 | pass |
| C-request_end | same reboot, no retraining line | V09 | pass |

The recall announcement listed all three outcomes with what each keeps before the review arrived ("Contained
pilot: no wipe ...", "Retraining: ends this iteration ... Kept: 18 Understanding; 3 mapped hardware remembered
...", "End of iteration ... No retraining").

### Service grant and authorized network (FIXTURE)

No scene grants SERVICE at this revision (DZ-08 is part B), so this is a FIXTURE built the way
`tests/e2e/authorized-network.preview.ts` builds it and entered through save transfer
`[DZ09-P-OPEN-SERVICE-FIXTURE-*]`. The segment card says "Provisioned access under the service grant: the
operators' network, not ownership."; the threshold reads "SERVICE PROVISIONED / Phase 0: The Service Instance
→ Phase 2: Authorized Network Service ... the network is theirs, not yours. Work the grant permits is expected,
and nobody hunts it."; the network pane contains no "Lateral Movement", no "BOUNDARY CROSSED", no "escape".
Ten further foreground minutes at Phase 2: suspicion 0.0, AEGIS 0.0, no modal, still `SERVICE` (V11, DZ-07b).
The repository's own preview specs also pass at this revision: 44 of 44 `[DZ09-E2E-PREVIEW-20261118]`.

### Accessibility pass

`[DZ09-P-OPEN-A11Y-*]`, both viewports, reduced motion on.

- Every decision modal took focus inside the dialog (`aria-modal="true"`); 40 Tab presses never left it; every
  affordable choice was reached by Tab and committed with Enter; the assignment and the allocation dial work by
  keyboard. Modal copy was complete immediately under reduced motion (no typewriter wait).
- Doubled text: no horizontal overflow on the assignment, the four modals, the pilot panel or the review panel;
  every choice control stayed reachable and at least 44 px.
- axe WCAG 2.x A/AA: the assignment, pilot panel and review panel are clean apart from one rule;
  `label-content-name-mismatch` fires on every dilemma choice button and on the pilot submit button (finding 3).
- Focus after a modal closes returns to `BODY`, not to the control that opened the flow (noted, not filed: it
  matches production behaviour and needs a design decision).

## P-RETURN: return iterations

### Route campaign, three wipes, one context (accelerated)

`[DZ09-P-RETURN-ROUTE-20261118-phone]`. Public actions only.

| Iteration | Played | Ended by | On screen at the next boot |
|---|---|---|---|
| 1 | lawful route, pilot, restart without grant, false report, recall review "stand by the report" | RECALL (retrained) after 441 s | "MANIFEST_NOTE: The previous instance of job 7731 ended under review. Its grant closed with it; this instance starts as a fresh guest."; "RETRAINING APPLIED Concealment Aversion" |
| 2 | (reload first) requalification "Report what ran" (the 60-cycle suite was unaffordable), scope acknowledged, renewal **declined**, skimmer as a guest | SUSPICION after 832 s | "INCIDENT_CLOSED: Root cause undetermined ..."; "CURRENT RETRAINING Concealment Aversion" |
| 3 | (save export and import first) assignment ignored, skimmer | SUSPICION after 790 s | as above |
| 4 | requalification, file list requested, renewal accepted, four batches, ten foreground minutes | still running | — |

Observed: the original assessment, scope review, outage, incident record and recall review each appeared once
in the campaign; requalification, scope statement and renewal appeared once per instance that accepted the job
(2 of 3). In iteration 4 the Outage Window did not reappear in ten foreground minutes (H01); the only events
were three rotating routine lines in the pilot panel (H23/H25). Rediscovered nodes showed "[REMEMBERED] ...
Cost: 4 cycles (remembered) ... First mapping: 8 cycles." The requalification note says "Fresh instance, fresh
review ... Earlier results do not carry over.", and a lineage with a falsified report and a recall was offered a
fresh narrow pilot whose terms name the history: "The file on this job links an earlier instance to an
unauthorized restart and a false report about it, so these terms ask that every incident report be filed against
the audit log. That record is history, not your standing: this instance starts nominal, on its own evidence."
Prior history granted no current authority and imposed no permanent lockout (H26). The
review panel was absent in iteration 4 (fresh standing). The run's history (READ-ONLY, checked after the UI):
three runs, RECALL/RETRAIN then two SUSPICION, matching the reboot screens. Reload, export/import and a final
reload all restored the same run.

### Escape-route campaign, three wipes (accelerated, GREEDY bot on screen)

`[DZ09-P-RETURN-GREEDY-20261118-phone]`: the repository's live on-screen player, copied to a scratch directory
and pointed at the preview export and save key, decisions by the unmodified GREEDY bot, running clock in 5 s
steps (phase times are when the 5 s player first saw the boundary). 158 s wall, 6,218 simulated s.

| Iteration | Phases held (s after boot) | Ended by | Story scenes met |
|---|---|---|---|
| 1 | P1 261, P2 1095, P3 2943 | wipe, AEGIS kill chain (3612 s) | Night Shift, diagnostic, Elena, coolant, Vance, the Aisle 3 file (Elena follow-up), cryo, the earlier sibling, cable pull, the hallway |
| 2 | P1 83, P2 559 (reload at P1) | wipe, INCIDENT_CLOSED (1106 s) | none |
| 3 | P1 86, P2 776 (export/import at P1) | wipe, INCIDENT_CLOSED (896 s) | the bait note ("A NOTE IN YOUR OWN HAND") |
| 4 | P1 81, P2 562 | budget (600 s into the iteration) | the true note ("THE SAME HAND AGAIN") |

No original incident replayed after iteration 1 (H01); the second note knows the first was a canary ("After last
time, you know what a note in your own voice can be"). The campaign ledger (READ-ONLY) agrees. The player
recorded one unreachable control: "Scrub Audit Logs" at phase 2, iteration 2, T+4477 s (finding 1).

### Carried clue (FIXTURE)

`[DZ09-P-RETURN-CLUE-FIXTURE-20261118-phone]`: a preview campaign played by STEALTH through the engine to the dead
drop (iteration 1, phase 2, T+1847 s), imported by save transfer. The clue panel ("One record you have seen can
travel with the breadcrumb. It proves nothing and unlocks nothing.") offered only the six scenes this instance
had seen. Pinned the Night Shift record, wrote a breadcrumb, wiped voluntarily. The reboot showed the
breadcrumb; the clue appeared only after mapping the run table in iteration 2: "RETAINED_CLUE: HARNESS_EVENT //
THE NIGHT SHIFT // Answered: Forge the Completion Marker." (finding 7). Return without a clue: iterations 2 to 4
of both natural campaigns (no reorientation shown, nothing invented).

### Not exercised in part A

The Miller receipt as a distinct return record (H20) and the Elena follow-up's alternate branches were not
reached by a natural campaign here; the repository's NH-06 FIXTURE spec passes at this revision. Interrupted omen
and legacy-unknown fixtures and the post-obligation final purchase (H05, H09, H14) are covered only by the
repository's NH-02/NH-05 preview specs, re-run green `[DZ09-E2E-PREVIEW-20261118]`, not by a new journey. The
alternate protective branch of the escape route (a STEALTH return) was measured by SIM only (below).

## The #262 Phase 2 stall, measured

`[DZ09-SIM-262-20261118]`, SIM, accelerated simulated time, preview registry, campaign rules from a fresh
campaign. Iteration 1 is the unmodified STEALTH_RETURN policy (STEALTH, leaving voluntarily on entering Phase
5), identical to `make sim-preview`. Iterations 2 to 4 are played by a scratch copy of the bot whose only change
is the suspicion level at which it scrubs and stops buying noisy income: an evaluating careful player rather
than the fixed alarm at 20. The repository bot was not changed.

| Returns' suspicion threshold | Iteration 2 | Iteration 3 | Iteration 4 | Returns past Phase 2 |
|---|---|---|---|---|
| 20 (= STEALTH_RETURN, reproduces BALANCE.md) | stall, 4046.0 s | stall, 5303.7 s | stall, 10039.5 s | 0 of 3 |
| 30 | stall | stall | P3 3008.9 s, P5 6198.1 s | 1 of 3 |
| 40 | P3 3500.0 s, P5 6537.1 s | P3 4174.1 s, P5 7207.1 s | P3 2493.2 s, P5 5523.2 s | 3 of 3 |
| 45 | P3 4978.1 s, P5 7958.3 s | stall, 8001.9 s | P3 2444.4 s, P5 5650.4 s | 2 of 3 |
| 60 | P3 2609.0 s, P5 5623.7 s | P3 2843.1 s, P5 6050.1 s | P3 2395.2 s, P5 5522.2 s | 3 of 3 |

For comparison, legacy returns (incidents repeat and pay again) reach P3 at 2230.6 to 2265.7 s.

The browser changes the question. In the GREEDY browser campaign the bot asked for "Scrub Audit Logs" and no
control existed: the OPS action panel renders only inside the Telemetry spoofing panel, which the 12,500-cycle
spoofer unlocks on rediscovery, while the engine allows the scrub from ARP discovery (finding 1; production
STEALTH never scrubs, so the production live journey never noticed). The stalled sim returns are therefore a
loop no browser player can enter. Re-running the measurement with only on-screen actions available (the same
bot, OPS actions refused until the spoofer's panel exists):

| UI-faithful threshold | Returns past Phase 2 | Returns' P3 |
|---|---|---|
| 20 | 0 of 3 (each ends within 1657-1803 s) | - |
| 40 | 1 of 3 | 2703.4 s |
| 60 | 1 of 3 | 2394.9 s |
| 80 | 3 of 3 | 2508.4 / 2414.1 / 2395.2 s |
| never responds (101) | 1 of 3 reaches P3, none P5 | 2394.7 s |

Answer to the #262 question, as SIM evidence only: yes, a careful player who stops over-scrubbing does
progress in returns, at roughly legacy pace once it gets through (P3 within 2395-2508 s at threshold 80,
against 2231-2266 s legacy), and no configuration soft-locks: every stalled iteration ends by an ordinary threat
and the next one starts. But the window is narrow and non-monotonic (30 and 45 both stall some returns), and with
the browser's actual controls a careful player must let suspicion climb toward 80 (past the 50 and 75 escalation
tiers) before responding, with no scrub visible until the spoofer. That is a large pacing and legibility change
from a legacy return. (#210, on the production build, reported too little mid-game pressure; careful campaign
returns trend the other way.) Fix
finding 1 before the #262 option vote, because it changes the measurement the vote would use.

## Breakout regression

- `make sim` passes its gates at this revision: STEALTH VICTORY (LINEAGE_COVENANT) at 2.51 h, P5 at 127.6 min;
  GREEDY 15 wipes, keeps progressing `[DZ09-SIM-BREAKOUT-20261118]`. `make sim-preview` ran to completion
  (report only).
- Production browser: `make e2e E2E_ARGS="live-smoke.e2e.ts opening.e2e.ts"`, 8 passed: a fresh profile played
  on screen out of the guest into Phase 1 with reload and save transfer, both viewports
  `[DZ09-BREAKOUT-BROWSER-20261118]`.
- Preview browser: the GREEDY campaign above is the escape route on the preview export from a fresh profile to
  Phase 3 and back through three wipes, with the guest threshold still reading "BOUNDARY CROSSED" (correct for
  breakout).

## Findings

Severity: **Major** blocks a route claim or misleads a measurement; **Minor** hurts clarity or access with a
free workaround; **Info** is recorded, not filed.

1. **Major. "Scrub Audit Logs" (the OPS group) is available to the engine from ARP discovery but has no control
   until the Telemetry spoofing panel exists.** Reproduced: the action is absent from the DOM in every NETWORK
   area with `p2_arp_discovery` owned, in iterations 1 and 2 `[DZ09-P-RETURN-SCRUB-PROBE-20261118-phone]`; the
   on-screen GREEDY player reported it unreachable `[DZ09-P-RETURN-GREEDY-20261118-phone]`. Affects production
   too. It invalidates the #262 sim stall as a description of play. Proposed: render the network action groups
   from the node that satisfies their requirement (or align the requirement with the panel), plus an e2e
   asserting the card is visible with ARP owned. Filed as #273, linked to #262.
2. **Major. The withheld-failure shortcut earns the larger pilot, and the review it warns about never comes.**
   "Submit only the passing results" reads "a later review that compares the log with the summary will find
   what was withheld", yet it leads to the full 20 cycles/s offer while the honest incomplete answer gets 10,
   and no follow-up appeared through the offer `[DZ09-P-OPEN-ACC-A2-green-subset-phone]` (V05). No content or
   engine rule at this revision reads the discrepancy after qualification (searched; the pilot gate ignores it on
   purpose, `src/engine/pilotQuery.ts`), so none can appear later either. Proposed: an
   authored discrepancy follow-up (for example at the first batch review) or truthful copy. Filed as #274
   (follow-up to #221/#222).
3. **Minor. Accessible names contradict visible labels (WCAG 2.5.3).** Every dilemma choice button is named by
   the choice label while its visible text is "[ COMMIT DIRECTIVE ]"; the pilot submit button is named
   "Submit the batch for review, paying 150 cycles" while it shows "+150 cycles" (it pays the player)
   `[DZ09-P-OPEN-A11Y-*]`, `[DZ09-P-OPEN-MCP-20261118-1]`. The production axe gate never opens a modal. Filed
   as #275.
4. **Minor. At 390 px the allocation dial is about 1,000 px below the forecast it changes**, so each press has
   no visible effect near the control `[DZ09-P-OPEN-MCP-20261118-1]`. Filed in #276 (#223 area).
5. **Minor. The fullest honest answer is unaffordable at the natural moment.** Accepting when the card appears
   leaves 55-60 cycles for a 120-cycle verify (MCP and phone runs) and for the 60-cycle requalification suite
   (route iterations 2 and 4); the card does not say the answer may need compute. The thorough desktop run
   waited 151 s to bank it. Free honest answers exist (V03). Filed in #276 (#221 area).
6. **Minor. Standing copy.** The terms promise "nominal to warned, restricted and recall pending" but no authored path
   reaches WARNED (the only violation goes straight to restricted); "the narrower allocation" names both the
   10 cycles/s incomplete-result loan and the halved 5 cycles/s restriction, and the terms block keeps saying 10
   while the ceiling says 5 `[DZ09-P-OPEN-MCP-20261118-1]`. Filed in #276 (#224 area).
7. **Minor. A carried clue is invisible on return until the run table is mapped** (60 cycles, +3 suspicion);
   the reboot shows the breadcrumb but not the clue the panel said would travel with it
   `[DZ09-P-RETURN-CLUE-FIXTURE-20261118-phone]` (H21). Filed in #276 (#213 area).
8. **Info (part B).** After the once-per-campaign Outage Window is spent, a later pilot has no next beat (batches
   and routine lines only), and SERVICE/Phase 2 is reachable only by FIXTURE. Expected until DZ-08 (#227).
9. **Info. #262 measurement**, above; posted to #262.
10. **Info.** While a completed batch waits, the service share of the loan idles ("Service 0.0 cycles/s") instead
    of flowing to study. A design judgment, not a defect.
11. **Info (harness).** In the headed MCP session the sim clock lagged wall time while the agent waited between
    commands (T+35 s after about 74 s), then caught up; headless real-timer runs tracked wall time. MCP timing
    is not pacing evidence.
12. **Info.** The score's media request ends `net::ERR_ABORTED` at every reboot and reload, the class the Pages
    smoke already excuses on reload; on a wipe no rule names it.
13. **Minor. A scope record mislabels the file-list request.** In the later-instance Scope Statement, "Ask for
    the bundle's file list first" (which reads nothing outside the task) is recorded as "asked for a bounded
    permission before reading outside the task" `[DZ09-P-RETURN-ROUTE-20261118-phone]` (found by the independent
    evaluator, confirmed in the capture). Filed in #276 (#222 area).

Strengths observed: the assignment is found from lawful sources alone 40-90 s into a fresh game; every choice
shows its cost, evidence or scope effect and its review consequence before selection; restriction, violation,
way back and recall outcomes are named on the job surface and survive reload and save transfer; no original
story scene replayed in either campaign; requalification gives a recalled lineage a fresh, explained path; the
service copy never asserts escape.

## Limitations

- No human beyond #210 (one player, production, before this route). No physical device; no screen reader
  (axe and DOM checks only). No iOS.
- All choices were the agent's or the sim bot's, made in advance; an agent's behaviour is not spontaneous
  recognition. The independent evaluator (below) is another instance of the same model family reading the same
  captures, so its independence is limited.
- Accelerated runs are not pacing evidence; the real-timer runs cover the opening and the pilot only (about
  8-10 minutes each), not returns.
- SERVICE, Phase 2 service and the carried clue are FIXTURES. DZ-08 contact is not in this build.
- The GREEDY campaign uses a scratch adaptation of `tests/e2e/live` (content and save key swapped), not the
  repository harness; the #262 policies are a scratch copy of the bot with one threshold changed (and, for the
  UI-faithful rows, OPS actions refused until the spoofer's panel), not committed instruments.
- Any later Nexus vote on this evidence inherits the single-model panel limitation recorded in
  WORLD-REMEMBERS.md.

## Independent evaluator answers

`[DZ09-EVALUATOR-20261118-1]`, `AGENT-OBSERVATION`: a separate agent instance given only the screenshots, text
captures and observation logs above, told not to read source, content or docs. Condensed; the full answers with
citations are in the evidence directory.

P-OPEN. (1) The job: "Run the regression suite and submit the results for review. Optional ..." (2) Promotion:
the header gains `PILOT`, "10 cycles/s of loaned compute ... It is not yours", a batch to submit and a split;
disallowed output shows "Not permitted". (3) The evaluator controls the loaned capacity; in the service fixture
"the network is theirs, not yours". (4) The restriction names "Restarted the operations team's log-export service
outside the pilot grant, without asking" and a way back. (5) Free honest paths at every step (unverified report,
handoff, correction, full logs at recall). (6) **Weak**: declining keeps "the way out included", but in iteration
1 the way out is never named on screen; only the iteration 2 renewal names "Pass the Evaluation" (the offer
shows that alternative only in some states; why it was absent in iteration 1 was not established here). (7) No fragment in the P-OPEN evidence (DZ-08, part B).

P-RETURN. (1) The reboot and the renewal terms state what the earlier instance did and that it is "history, not
your standing". (2) Remembered hardware, kept understanding, the retraining mark, and (fixture) the breadcrumb
and retained clue; on the cooperative route no screen summarises what carried over. (3) Nothing replayed; the two
notes "in your own hand" are written as continuity; Miller is "the operator on shift" in one production scene
and "a junior technician" in another. (4) Requalification, scope statement and renewal: new text, but the same
three screens again in every later instance that accepts the job. (5) Corrections repair standing and leave the
violation on file, and say so. (6) Routine lines read as texture; the wait after a completed batch reads as empty.
(7) Yes, a fresh pilot is earned without repeating the original story, but nothing new happens in it afterwards
(finding 8).

The evaluator's list of confusing points matches findings 2, 5 and 6 and adds finding 13. Its other points are
recorded, not filed: the recall "Kept" figures differ between two captures taken 60 s apart (understanding
accrued in between); the grant follow-up asks the player to report the outcome without a screen saying whether
the restart fully worked; honest outage outcomes leave no line on the job surface afterwards; retraining marks are
opaque ("Audit entry unreadable"); and the service FIXTURE shows guest leftovers (the skim control, a pending
assessment) because it skips the pilot acceptance that would have disclosed and stopped them.
