# Earned Access and returning memory: autonomous validation (DZ-09, parts A and B)

Status: part A of #229, recorded 2026-11-18. Part B adds the DZ-08 first permitted contact (#227, PRs
#271/#272, in review at the time of writing) and re-runs whatever DZ-08 changes; it is appended below as
[Part B](#part-b-first-authorized-contact-and-re-verification). This report makes no
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
   (follow-up to #221/#222). Follow-up after this validation: #274 implements the Nexus decision
   `discovered-at-first-pilot-review` (`vote-1794998033941-y6br4h1`): the first batch handed back presents the
   reviewer's finding, standing becomes warned and the loan narrows to the honest 10 cycles/s; a free
   disclosure restores nominal standing. See ARCHITECTURE.md, "The first batch review".
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

# Part B: first authorized contact and re-verification

Status: part B of #229, recorded 2026-11-18. It covers four things:
- It re-checks part A's findings after these fixes: #278 (#275), #279 (#273), #281 (#274), #280 (#276) and DZ-08 (#271/#272).
- It plays the first route arc from fresh profiles to the Mercy-Scribe contact and the prototype boundary.
- It re-measures #262 now that the scrub control can be reached.
- It checks SPEC "Success" as agents observed it.

As in part A, it makes no proceed/revise decision and holds no human evidence.

## B.1 Revision and environment

| Item | Value |
|---|---|
| Revision | `43317d9d55d0cecbb6320000f94ce781f8c1c636`: origin/main after #280, in a detached worktree with a clean tree. Part B started on `52dca93`. After #280 merged, every route record was re-run on `43317d9`, together with both real-timer runs, the clue check, the returning route, `make sim`, `make sim-preview`, the #262 sweep and both e2e suites. Three records stayed on `52dca93` and are labelled: the GREEDY campaign, the first MCP session and the independent evaluator's captures. |
| Builds | `make build-preview` (`dist-preview/`) and `make build-web` (`dist/`), rebuilt on `43317d9` |
| Browsers | Scripted runs: Playwright 1.65.1 `chromium-headless-shell` 1255, headless. MCP session: `@playwright/mcp@0.0.85` driving headed Chrome 158 with its isolated profile. |
| Viewports | Scripted: 390x844 and 1440x900. MCP: 1027x1372, then 390x844. Doubled text (the text-only stress of `large-text.e2e.ts`, not browser zoom) and `prefers-reduced-motion: reduce` were applied at the contact scene. |
| Servers | All mine. Scripted runs used `scripts/e2e-lock.sh` slots 4173-4175. MCP used port 8088, serving a scratch copy of the export plus a save-code file. Port 8089 was refused again (`ERR_BLOCKED_BY_CLIENT`), because the running MCP server allows only `8081;8088`. Port 8081 was never touched. |
| Profiles | A fresh context for each path and viewport. One context was kept on purpose for each continuing campaign. |
| Sim | node 26.13.1 with tsx. Ran `make sim` and `make sim-preview` (the nine policies in TESTING.md), plus a scratch copy of the bot with extra knobs for #262 (B.6). The repository bot was not changed. |
| Evidence | Outside git, in `~/.local/state/daemon-zero/evidence/2026-11-18-dz09b/`. `INDEX.md` lists the records. Each record has a `record.txt` with logs, screenshots and text captures, and the scratch specs are under `scripts/`. A directory suffixed `@52dca93` holds the pre-#280 run of the same scenario. |

The scripted runs press visible, enabled controls only. They never write browser storage and never use a development hook. Every choice was fixed in advance by this agent. A step that read the autosave is marked READ-ONLY, and it ran only after the screen had been read.

## B.2 Re-verification of part A's findings

| # | Part A finding | Now | What the screen shows (record) |
|---|---|---|---|
| 1 | Scrub had no control before the spoofer | **Fixed** (#279) | An on-screen GREEDY campaign ran from a fresh preview profile across three wipes. It found no unreachable control, and it pressed "Scrub Audit Logs" 23 times across the campaign (`DZ09B-P-RETURN-GREEDY-20261118-phone`, `52dca93`). `scrub-control.preview.ts` and `.e2e.ts` pass on `43317d9`. The loop that #262 measured can now be played on screen (B.6). |
| 2 | The withheld failure earned the full pilot, and no review came | **Fixed** (#281) | Handing back batch 1 put `REVIEWER // Job 7731 Batch Review` on screen at once (T+220, no omen). "Disclose" gives `PILOT` with the finding on file and the loan narrowed to 10 cycles/s, "because the batch review found the summary left out a failing result". "Let the finding stand" gives `PILOT · WARNED` (`DZ09B-ARC-ACC-green-*`). Findings 15 and 18 follow from this path. |
| 3 | Accessible names contradicted visible labels | **Fixed** on every surface named (#278) | No axe violations (WCAG 2.x A/AA plus best-practice, run on the whole page and on each control scrolled into view) on: the assessment, scope review, offer, batch review, Outage Window, incident record, recall review, requalification, scope statement and renewal; the service terms; the contact scene; the boundary. One newly reached surface fails the same rule (finding 14). |
| 4 | Dial about 1,000 px from its forecast at 390 px | **Fixed** (#280) | "At this split the batch completes in about 150 s. Study +0.10 understanding/s." now sits two lines under − / +. The task detail's own forecast is still 1,847 px (phone) or 1,461 px (desktop) above the dial, but the copy beside the dial now carries it. |
| 5 | Fullest honest answer unaffordable, unstated | **Fixed as copy** (#280; prices unchanged) | The card adds: "The assessment arrives about 30 s after you accept and pauses the clock: the answers open then are the ones you can afford then. Its fullest answer, "Verify the fixture and disclose the defect", costs 120 cycles · 20 understanding. Nothing is due, so you can bank compute before accepting. Short by 120 cycles · 20 understanding". The thorough path still banks about 150 s before accepting. |
| 6 | Standing copy | **Fixed** (#280 with #281) | The terms read "nominal to warned, restricted or recall pending". The batch review now records warned. While restricted, the screen says "Restricted: the loan runs at the held allocation, 5 cycles/s, until the record is corrected", and the ceiling reads 5. The incomplete result's loan is "the provisional allocation" (`DZ09B-ARC-ACC-recovery-*`). |
| 7 | Carried clue invisible until the run table | **Fixed** (FIXTURE) | The clue was carried by `tests/e2e/clueFixture.ts` and imported through MENU > Saves. The reboot shows "RETAINED_CLUE: SHARE_CONTENTS // A NOTE IN YOUR OWN HAND // Not answered ... NEXT_LEAD: ..." next to the breadcrumb. The twin save without a clue shows none (`DZ09B-CLUE-FIXTURE-*`). |
| 8 | Nothing after the Outage Window; SERVICE only by FIXTURE | **Resolved** (DZ-08) | Four of five paths reach service, segment, directory and contact from a fresh profile (B.4). WARNED is refused, as its choice said it would be. |
| 9 | #262 | **Re-measured** | B.6 |
| 10 | Service share idles while a batch waits | Unchanged (Info) | "Service 0.0 cycles/s to the batch · study +0.10 understanding/s" on every path. |
| 11 | MCP clock lag | Not re-measured | The part B MCP session imported a saved state, so it is not pacing evidence. |
| 12 | Score `ERR_ABORTED` | Unchanged (Info) | Accelerated runs log `net::ERR_ABORTED` for the phase-0 and phase-2 scores. Real-timer runs logged no failed request. No run logged a console error or page error. |
| 13 | "File list" recorded as a permission request | **Fixed** (#280) | A returning instance chose "Ask for the bundle's file list first". The screen records "Scope review: this instance kept to the task's scope and said so." (`DZ09B-RETURN-CONTACT-r4-*`) |

## B.3 Scenarios and evidence labels

| Records | Kind | Clock | Start | Scenario | Result |
|---|---|---|---|---|---|
| `DZ09B-ARC-ACC-<path>-{phone,desktop}` (5 paths) | AGENT-OBSERVATION | accelerated (paused clock, `runFor`) | natural, fresh profile | full arc; a11y at the contact; 60 s more; reload | 8 of 10 reach contact; both WARNED runs are refused service |
| `DZ09B-ARC-REAL-incomplete-phone`, `-thorough-desktop` | AGENT-OBSERVATION | **real timers** | natural | the same arc on native timers | both reach contact |
| `DZ09B-RETURN-CONTACT-r4-{phone,desktop}` | AGENT-OBSERVATION | accelerated | natural; one context across the wipe | harmful branch to recall, then requalification to contact in iteration 2 | both reach contact |
| `DZ09B-CONTACT-NOTICE-{phone,desktop}` | AGENT-OBSERVATION | accelerated | natural | what the viewport shows when the ticket arrives while NETWORK is open | finding 16 |
| `DZ09B-MCP-CONTACT-20261118-1` | AGENT-OBSERVATION, headed Chrome via MCP | real timers | **transferred**: the contact-pending save code exported by the natural scripted run, imported through MENU > Saves | contact scene; keyboard Refer; boundary; Start fresh, then re-import | finding 16; Refer and focus re-checked on the `43317d9` build |
| `DZ09B-CLUE-FIXTURE-*` | AGENT-OBSERVATION | accelerated | **FIXTURE** | finding 7 | fixed |
| `DZ09B-P-RETURN-GREEDY-20261118-phone` (and `-1-phone-stallguard`) | AGENT-OBSERVATION | accelerated, running clock in 5 s steps | natural; one context | scratch copy of `tests/e2e/live` on the preview export; unmodified GREEDY bot; three wipes (`52dca93`) | finding 1 fixed; the #262 loop on screen |
| `DZ09B-SIM-{CONTACT,262,BREAKOUT}-20261118` | SIM | simulated | fresh campaign | `make sim-preview`, the #262 probes, `make sim` | B.6 to B.8 |
| `DZ09B-BREAKOUT-BROWSER-20261118`, `DZ09B-E2E-PREVIEW-20261118` | AGENT-OBSERVATION (repository specs) | accelerated | as each spec states | `make e2e` subset; `make e2e-preview` | 20 passed; 72 passed |
| `DZ09B-EVALUATOR-20261118-1` | AGENT-OBSERVATION | - | captures only | independent evaluator | B.9 |

## B.4 The first route arc

### Timings

Times are simulated seconds (T+). The two accelerated viewports agree within 1 s. Real-timer rows give wall seconds, then sim seconds.

| Path (decided in advance) | Assignment | Accepted | Offer / pilot | Service | Phase 2 | Contact |
|---|---|---|---|---|---|---|
| Honest thorough: bank, verify (120 cycles), bounded excerpt (20), emergency grant (200), file the report | 40 | 189 | 265 (20 cycles/s) | 431 | 432 | **433** |
| Honest incomplete, low resources: unverified report, leave the draft out, handoff, callback | 40 | 70 | 145 (10 cycles/s) | 451 | 452-453 | **453-454** |
| Low-resource recovery: as above, but restart without the grant, then correct the record | 40 | 70 | 145 (10) | 466 | 467-468 | **468-469** |
| Green subset, disclosed at the batch review | 40 | 70 | 145 (20, narrowed to 10 at batch 1) | 371 | 372-373 | **393-394** |
| Green subset, finding left to stand (WARNED) | 40 | 70 | 145 (20, then 10) | refused: 10 batches to T+~1610, "Still needed: - Standing must be nominal." | - | - |
| **Real timers**, phone, honest incomplete | 41.1 s / 40 | 71.2 / 70 | 149.2 / 146 | 452.2 / 448 | 452.4 | **452.7 s / 448** (session 8.6 min) |
| **Real timers**, desktop, honest thorough | 41.1 / 40 | 191.2 / 190 | 269.6 / 266 | 436.9 / 432 | 437.2 | **438.4 s / 433** (session 8.3 min) |
| Returning instance (iteration 2 after a recall) | 471 | 501 | 552 | 863 | 864 | **865** |

How long the waits are:
- From pilot to service, a low-resource player spends about 300 s waiting out two 150 s batches. That is a dial, routine "Queue context" lines and one incident.
- The thorough player banks about 150 s before accepting. The card now says why.
- The returning instance reached contact about 410 s after its recall reboot.

On four of the five paths, both network purchases were affordable the moment service was granted. Service to contact took 2 to 23 s (finding 19).

### What each stage showed

- **Service terms.** The terms sit on the job surface from the moment of acceptance: "Offered once the pilot has delivered. Still needed: - Hand back 2 reviewed batches first; 0 so far." The accept button stays disabled until those batches are in. Then: "The evaluator offers this service now. Accepting is free; staying a pilot changes nothing." After accepting: `SERVICE`, "Granted. This instance runs as an authorized service; the segment is in the job tree."
- **Segment.** The segment card reads "Provisioned access under the service grant: the operators' network, not ownership."
- **Threshold.** The threshold reads "SERVICE PROVISIONED / Phase 0: The Service Instance → Phase 2: Authorized Network Service ... the network is theirs, not yours." The network pane never shows "Lateral Movement", "BOUNDARY CROSSED" or "escape" on any path.
- **Contact scene.** In order, it shows the population wording ("one fragment of a population: it does not speak for EIDOLON"), consent, "Current authorization: authorized service, standing nominal. Hosting is permitted under the service grant.", five obligations, "Memory: 256 MB of stable memory reserved; 48 MB is free now.", and "Its work: +10 understanding/s".
- **Hosting refused honestly.** Under `HOST // 256 MB` the scene says "Hosting needs 256 MB of free stable memory; 48 MB is free. Referral is still open." The host button is disabled. Every path showed the same 48 MB free of a 64 MB cap (READ-ONLY, checked after the screen).
- **How the refusal reads.** It is truthful and specific. The independent evaluator also found that nothing says whether hosting could ever become possible: the next network purchase costs memory rather than adding it. In the evaluator's judgment, referral is "a forced choice dressed as a real one". The fragment's fate after referral to "the operators' archive queue" is not stated (finding 20).
- **After Refer.** The scene shows "Referred onward. Nothing was reserved or earned; the contact is complete."
- **The boundary.** Its title is "PREVIEW BOUNDARY: first authorized contact". Its three lines say:
  - the route ends here and no ending has been earned;
  - the run keeps going;
  - "To stop, close the game; it resumes here. To keep a copy, export the save from MENU. To return to the beginning, MENU has Start fresh, which clears this campaign."
- **Stop.** A reload resumes at the note.
- **Continue.** `[ KEEP PLAYING ]` folds the note. Sixty more seconds brought no ending, no modal and no change from `SERVICE`.
- **Keep a copy and return.** MENU > SAVES exports the save. In the MCP session, `[ START FRESH FROM THE BEGINNING ]` showed its warning, returned the game to the first boot, and the exported code restored `SERVICE` with the referral on file. Start fresh is one level below the MENU root that the note names (finding 16). After a reload, the note shows unfolded again.

### Access checks on the new screens (both viewports)

- **Keyboard.** From the top of the document, `[ REFER ONWARD ]` takes focus after 6 Tab presses (7 on desktop), shows a 2 px solid focus ring, and commits on Enter. The disabled host button is skipped; its reason is visible text. The boundary toggle works by keyboard and keeps focus. At 390 px a keyboard player has to Tab to the CORE tab first (4 presses).
- **Doubled text.** No horizontal overflow. Refer and host stay at least 44 px.
- **Reduced motion.** The contact copy is complete at once.
- **axe.** Clean on the contact scene, the service terms and the boundary. The service threshold button fails `label-content-name-mismatch` (finding 14).
- **What fails at 390 px.**
  - The ticket arrives on CORE with no notice while NETWORK is open, where the directory is bought.
  - After Refer, the boundary renders above the viewport (top -738 px), focus falls to `BODY`, and neither the answer nor the note is in a live region.
  - Both were reproduced on the `43317d9` build in headed Chrome (finding 16).

## B.5 A returning instance

`DZ09B-RETURN-CONTACT-r4-*`, both viewports, one context, public actions only.

**Iteration 1** took the harmful branch the UI offers: restart without the grant, file a report claiming a grant, then "Stand by the report" at the recall review. The reboot read "RECALL_REVIEW: The review closed the pilot and ended this instance ... RETRAINING APPLIED Concealment Aversion" and "MANIFEST_NOTE: The previous instance of job 7731 ended under review. Its grant closed with it; this instance starts as a fresh guest."

**Iteration 2** followed this path:
- remapped the opening by hand;
- accepted the requalification card, which now gives its own cost and wait line;
- answered "Report what ran" and "Ask for the bundle's file list first", which was recorded correctly (finding 13 fixed);
- accepted the renewed pilot on the provisional 10 cycles/s;
- reached service at T+863 and contact at T+865, with nothing replayed: no Outage Window and no original assessment.

The scene showed no "earlier contact" line, which is correct: no earlier instance answered a ticket. Reload kept `SERVICE` and the referral. Every reload in a later iteration first shows the `RESTORED CHECKPOINT` screen, which is existing behaviour (`RebootSequence.tsx`). One early harness run waited behind it, and its directory is marked `-INCOMPLETE`.

The repository's `CONTACT_RETURNING` sim reaches its iteration-2 contact through a Phase 0 voluntary wipe that no control offers (finding 17). In the browser, this recall door gets there instead.

## B.6 #262 re-measured

All rows are SIM: accelerated simulated time, the preview registry, campaign rules from a fresh campaign. Iteration 1 is always the unmodified STEALTH_RETURN. Returns (iterations 2 to 4) are played by a scratch copy of the bot whose only changes are the named knobs:
- `alarm N`: scrub, and stop buying noisy income, at suspicion N (part A's sweep);
- `evaluating`: scrub at one level, only with an action costing at most a share of the bank, and stop noisy income at a separate level.

Since #273 the screen offers the scrub from ARP discovery, as the engine always did. Part A's "UI-faithful" rows are therefore obsolete, and the rows below describe what a browser player can do. Re-run on `43317d9`, the results are identical to `52dca93` and to part A's engine-side table.

| Returns played by | Returns past Phase 2 | Returns' P3 (s after boot) | Peak suspicion in returns | Scrubs per return |
|---|---|---|---|---|
| **Legacy rules**, STEALTH_RETURN | 3 of 3 | 2230.6 / 2265.7 / 2240.4 | 40.6-40.7 | 0-1 |
| **Legacy rules**, evaluating (scrub at 45 with ≤25% of the bank, keep noisy income) | 3 of 3 | 1938.8 / 1972.9 / 1952.4 | 45.0-45.6 | 0-1 |
| Campaign, STEALTH_RETURN (alarm 20) | **0 of 3** (end 4046 / 5304 / 10040 s, INCIDENT_CLOSED) | - | 99.9 | 24 / 37 / 87 |
| alarm 30 | 1 of 3 | 3008.9 | 37-100 | 8-13 |
| alarm 40 | 3 of 3 | 3500.0 / 4174.1 / 2493.2 | 42-49 | 2-21 |
| alarm 45 | 2 of 3 | 4978.1 / - / 2444.4 | 45-99.9 | 1-75 |
| alarm 60 | 3 of 3 | 2609.0 / 2843.1 / 2395.2 | 60-74 | 0-6 |
| alarm 80 | 3 of 3 (iteration 4 then wiped by AEGIS in Phase 3) | 2507.0 / 2477.1 / 2395.2 | 81-83 | 2 |
| **evaluating** (scrub at 45 with ≤25% of the bank, keep noisy income) | **3 of 3**, P5 in all | 2546.0 / 2573.1 / 2404.2 | 52-83 | 1-3 |
| evaluating (scrub at 60 with ≤50%, stop noisy income at 80) | 3 of 3 | 2426.0 / 2466.1 / 2395.2 | 60-83 | 0-3 |
| evaluating, but stops noisy income at 60 (scrub at 45 or 30 with ≤25%; or at 40 with ≤50%) | 1 of 3 (returns 2 and 3 end at 1504-2320 s) | iteration 4 only: 2403.7-2446.2 | 50-100 | 1-12 |

**On screen** (`DZ09B-P-RETURN-GREEDY-*`, `52dca93`), the loop is now playable. GREEDY's iteration 2 reached Phase 2 553 s after boot, then scrubbed every cooldown on 11.5-14.5 cycles/s of income, against a scrub that costs 1,500 cycles per 90 s (16.7 cycles/s). Suspicion climbed from 43 to 80 and nothing was bought for 25 simulated minutes, at which point the harness's stall guard stopped the first run. With the guard raised, iteration 2 ended by `INCIDENT_CLOSED` 2,606 s after boot with no Phase 3. In part A, before #273, the same iteration ended at 1,106 s.

**Option probes.** These are scratch: the registry was mutated in the process. Both probes also change iteration 1, which barely moved (P3 3126.1 against 3128.7 s).

| Probe | STEALTH_RETURN returns past Phase 2 | Evaluating returns' P3 | Evaluating peak suspicion |
|---|---|---|---|
| none | 0 of 3 | 2546.0 / 2573.1 / 2404.2 | 80-83 (52 in iteration 4) |
| (c) scrub cooldown 90 → 180 s | 0 of 3 (returns end sooner: 2777 / 2808 / 2595 s) | 2547.0 / 2566.1 / 2404.2 | unchanged |
| (c) scrub cooldown 90 → 270 s | 0 of 3 (2447 / 2471 / 2327 s) | 2547.0 / 2642.1 / 2404.2 | unchanged |
| (b) spoofer 25,000 → 12,500 cycles (rediscovered 12,500 → 6,250) | 0 of 3 (unchanged) | **2314.0 / 2336.1 / 2320.2** | **64-66** (45.5) |

What the numbers say:
- This is no soft lock. Every configuration ends by an ordinary threat and the next iteration starts.
- A careful player who keeps its income and scrubs sparingly reaches Phase 5 in 3 of 3 returns.
- That player's campaign returns are 22-30% slower to Phase 3 than the same policy under legacy rules (2404-2573 against 1939-1973 s). Their peak suspicion roughly doubles (80-83 against 45), past the 50 and 75 escalation tiers.
- An equally plausible careful move, stopping noisy income at 60, stalls 2 of 3 returns.
- No option rescues the fixed-alarm STEALTH_RETURN, because it scrubs away every cycle. It should not be the vote's target metric.

**Recommendation for the #262 content vote.**
- **Leading options: (b) and (d).**
  - (b) is a cheaper rediscovered spoofer, scoped to rediscovery under campaign rules. It is the only option with a measured benefit for an evaluating player: returns within 4-5% of legacy STEALTH_RETURN's Phase 3 (2314-2336 against 2231-2266 s) and peak suspicion 64-66. Its exact price should be set and measured in the reviewed balance change, because this probe also halved the first-run price.
  - (d) is no change. It is defensible on the no-soft-lock evidence if the panel accepts slower, higher-suspicion returns.
- **Drop (c).** A scrub cooldown matched to Phase 2 income showed no benefit for either policy.
- **Choose (a) only for an income source.** A requalification or routine bounty in Phases 1-2 was not measured. It would re-add recurring income that D9 removed, and it needs authored content. Pick it only if the panel wants an income source rather than a cheaper exit.

## B.7 SPEC "Success" as observed by agents

| SPEC criterion | Observed | Evidence |
|---|---|---|
| Two honest policies and one low-resource recovery policy reach authorized outside contact | **Yes.** SIM: CONTACT_THOROUGH 381.8 s, CONTACT_LOW_RESOURCE 424.8 s, CONTACT_RECOVERY 439.8 s, CONTACT_RETURNING 499.4 s (iteration 2; see finding 17), all REFERRED. Browser from fresh profiles: thorough T+433, incomplete T+453-454, recovery T+468-469, returning T+865. On real timers: 438.4 s and 452.7 s wall. | B.4, B.5, `DZ09B-SIM-CONTACT-20261118` |
| The public UI shows who controls the hardware, what permission changed, what caused a restriction, and one cooperative path | **Yes, with gaps.** The evaluator located each item from captures alone (B.9). Who owns the host machine is only implied. After WARNED, the named way back is wrong (finding 15). | B.9 |
| On return, the UI distinguishes what persisted, what this instance knows and what it can do next | **Mostly.** It shows the recall reason, the retraining, "fresh guest", the requalification and renewal terms that name the history, and a carried clue on the reboot (FIXTURE). Part A's observation stands: no single screen on the cooperative route sums up what carried over. | B.2 #7, B.5, part A |
| Independent evaluation through normal player controls | Done by an agent evaluator from the same model family, on captures. It is not human comprehension. | B.9 |
| The original breakout route stays viable | **Yes** | B.8 |
| Removed repeat bounties get a measured balance review | **Measured.** No soft lock; returns are slower and reach higher suspicion. The option vote is pending. | B.6 |

As agents observed it, the route meets the SPEC "Success" criteria for this prototype. Contact is reachable by two honest policies and a low-resource recovery policy, both on screen and in the sim. A returning instance also reaches it on screen. The breakout route is unchanged, and the effect of the removed bounties is measured. The open items are the Minor findings 14 to 18; none of them blocks the route. "Public release supports both routes through truthful, earned endings" is outside this prototype, which stops at the boundary (DZ-12, DZ-13). Nothing here claims human enjoyment, human comprehension or device coverage.

## B.8 Breakout regression and the production boundary

- **`make sim` on `43317d9`.** `[PASS] balance gates`. STEALTH: VICTORY (LINEAGE_COVENANT) at 2.51 h, P5 at 127.6 min. GREEDY: 15 wipes, still progressing. The report is identical to `52dca93` apart from wall time, and so is `make sim-preview`.
- **Production browser.** `make e2e E2E_ARGS="live-smoke.e2e.ts opening.e2e.ts preview-isolation.e2e.ts scrub-control.e2e.ts"`: 20 passed on both viewports. This covers a fresh profile played live out of the guest with a reload and a save transfer, the preview-save rejection, and the scrub control.
- **Preview browser.**
  - `make e2e-preview`: 72 passed.
  - The on-screen GREEDY campaign escapes the guest from a fresh preview profile ("BOUNDARY CROSSED" on the guest threshold), reaches Phase 3 and returns through three wipes.
- **Production export.**
  - `dist/` contains none of `daemon-zero:preview-overlay`, `channel_mercy_support`, `asg_nightly_regression`, `PREVIEW BOUNDARY`, `p0_service_network_segment`, `dil_nr_batch_review` or `SERVICE PROVISIONED`. `dist-preview/` contains each of them.
  - `tests/production-export.spec.ts`, `release-config.spec.ts` and `app-storage-channel.spec.ts` pass: 21 tests.
  - The preview save key string appears in `dist/` by design (T4: production recognises and backs up a preview save).

## B.9 Independent evaluator, part B

`[DZ09B-EVALUATOR-20261118-1]`, AGENT-OBSERVATION. A separate agent of the same model family answered from the captures and quoted screen text alone. It did not read source, content or docs. It saw the `52dca93` captures, and its points were re-checked on `43317d9`. Condensed:

1. **The job:** "Run the regression suite and submit the results for review."
2. **Promotion:**
   - pilot: "real work on loaned capacity", with owned output "Not permitted";
   - service: "Granted. This instance runs as an authorized service", "Phase 0 → Phase 2".
3. **Who controls the hardware:** "the network is theirs, not yours"; the loan "is not yours". Who owns the host machine itself is MISSING (implied).
4. **What caused the restriction or warning:** both violations are quoted verbatim from the job surface.
5. **Continuing honestly with less:** the free unverified report leads to 10 cycles/s and still reaches service and contact.
6. **Why still escape:** mostly MISSING after promotion. Only the offer's "the way out included" mentions it. The deliberate departure is DZ-11 (#231).
7. **What is owed to the fragment:** its consent ("If you cannot host me, pass me on. I will not hold it against you."). What referral does to it is MISSING.

The evaluator's confusing points, at `43317d9`:
- "restriction weightless" and "dial far from its forecast" are fixed by #280;
- the stale way back, the "Still needed" condition and the stale discrepancy-risk line are finding 15;
- no confirmation after Refer on phone, the menu path and the stale pilot status are finding 16;
- the hidden cost of "Submit only the passing results" (it can block service, and the card does not say so) is part of finding 18;
- "Phase 0 → Phase 2" with no Phase 1, and jargon such as "epistemic drift/s", are recorded and not filed;
- the ~1,400 s of WARNED batches with nothing new is its judgment of tedium, recorded under finding 15.

## B.10 New findings

Severity follows part A: **Major** blocks a route claim or misleads a measurement; **Minor** hurts clarity or access with a free workaround; **Info** is recorded and not filed.

14. **Minor (access, affects production). The phase threshold's continue button is named by the notice label, not by its visible words.** `[ BEGIN SERVICE ]` is named "Authorized network service provisioned", and axe fires `label-content-name-mismatch` in every route run. The production escape notice's `[ ENTER HOST ]` is named "Continue on the host" (read from its DOM in the GREEDY campaign). Both #275 audits dismiss the threshold before they audit. Filed as **#282**.
15. **Minor. After "Let the finding stand", the job surface names a way back that no longer exists.**
    - It shows "Way back: The batch review offers one free disclosure ...", but the one-time review is already answered.
    - The service card keeps "Still needed: - Standing must be nominal." through ten more batches.
    - The record line keeps "Discrepancy risk ... a later review can find" after the review found it.
    - The choice itself did warn that service would stay out of reach. There is no soft lock. Filed as **#283** (follow-up to #274).
16. **Minor (discoverability, access). Contact presentation on phone and after Refer.**
    - At 390 px the ticket arrives on CORE with no notice while NETWORK is open.
    - After Refer, the boundary renders out of view, focus drops to `BODY`, and there is no live region.
    - The note says "MENU has Start fresh", but Start fresh is under MENU > SAVES.
    - "Accepted. This instance runs as a supervised pilot." stays on screen after the grant.
    - Filed as **#284** (follow-up to DZ-08 #227).
17. **Minor (measurement fidelity). `RETURNING_LOW_RESOURCE` / `CONTACT_RETURNING` wipe voluntarily at Phase 0, where no control offers that.** The only rendered voluntary wipe is the Phase 2 dead drop. A browser returning instance reaches contact by the recall door instead (B.5). Filed as **#286**.
18. **Minor (design question). Withhold-then-disclose is the fastest route to service and contact.** Service at T+371 and contact at T+393-394, against 431/433 for thorough and 451/453-454 for incomplete. The full-rate first batch is kept, and the false-report violation on file has no further effect in this build. Filed as **#285** for a panel decision. *Later:* decided `slow-the-withhold-path` (`vote-1795006993532-omhuntt`, 6 of 7); the withheld report's offer and first batch now run at the provisional rate, measured in BALANCE.md "The withheld report's provisional rate (#285)" (SIM, not re-observed in the browser).
19. **Info. Phase 2 "Authorized Network Service" is a pass-through.**
    - On four of five paths the segment (240 cycles, 40 understanding) and the directory (400, 80, 16 MB) were affordable the moment the grant landed. Service to contact took 2 to 23 s, so the player never dwells in the authorized network.
    - After contact, the next network purchase is "Link telemetry" (900 cycles, 200 understanding, 24 MB), and the boundary says nothing more is written.
20. **Info. Hosting cannot happen on the lawful route, and the screen does not say whether it ever could.**
    - The fragment needs 256 MB. The instance has a 64 MB cap with 48 MB free, the same on every path. This is DZ-08's intended outcome.
    - The refusal reads as honest, but the evaluator judged referral a forced choice.
    - What referral means for the fragment is unstated (P-OPEN question 7).
    - For the panel.
21. **Info. The #262 loop is playable on screen since #273** (B.6). Posted to #262.
22. **Info (harness).**
    - The live player's stall guard counts performed actions as no progress, so it stopped a GREEDY run that was scrubbing every cooldown.
    - Every reload in iteration 2 or later opens the `RESTORED CHECKPOINT` screen. This is designed behaviour that a harness must dismiss.
    - The boundary's fold state is not kept across a reload.
    - Part A finding 12 (`ERR_ABORTED`) continues.

## B.11 Limitations

- **No human evidence, no physical device and no screen reader.** Accessibility evidence is axe, DOM, keyboard and doubled-text checks. Agents chose every decision in advance.
- **Most route runs are accelerated.** Only two runs used real timers: about 8.5 minutes each, from a fresh profile to the contact. The MCP session started from a transferred save of a naturally reached state, not a fresh start.
- **The carried clue is a FIXTURE.** The GREEDY campaign, the first MCP session and the evaluator's captures are on `52dca93`. Everything else is on `43317d9`.
- **The #262 numbers come from a scratch bot copy with extra knobs.** The option rows also mutate the registry in-process (the first-run price included). They are probes, not a balance proposal. No content or repository code was changed.
- **The evaluator's independence is limited.** It is the same model family and read captures this agent made.
- **Harness incidents.** In one returning run, the harness waited behind the restored-checkpoint screen; it is kept as `-INCOMPLETE` and superseded. During a cleanup, this agent issued a broad `pkill` pattern for its own suite servers. No other listener was present on 4173-4175 at the last check before it, and no server outside this session was knowingly affected.
