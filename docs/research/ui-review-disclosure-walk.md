# Disclosure walk: DAEMON // 0 (wayfinder #345, map #327)

**What kind of evidence this is.** I watched it in headed Chrome (the Playwright MCP, isolated profile) on the production web export at `http://localhost:8088/`. It is not a device test. Phase 0 was played for real, carried on from the run the parent started (t=533 s to t=747 s, then into phase 1). Every later phase and special state comes from a stage save, loaded through the app's own save UI (`menu-open` -> `save-open` -> `save-code` -> `save-import` -> `save-import-confirm`) and then played forward for 6 to 15 s of real time. The play loop pressed EXECUTE_CLOCK_CYCLE about every 60 ms and bought the first enabled purchase about every 0.9 s. In dilemmas it took a zero-cost or affordable choice. Special states were watched without buying.

**Where the codes came from.** `makeUiAuditFixtures()` gave the phase start/mid/end saves (`audit-*`), `makeFixtures()` gave the named states (`fx-*`), and the route states came from `serving()`, `untilComplete(serving())` and `chartered()` in `tests/*-helpers.ts` (`route-*`). The codes are in `.../scratchpad/uireview/codes/` and were served to the page by a CORS server on port 8089, an allowed origin, which I started and then stopped. Screenshots are in `/home/william/git/daemon-zero/.playwright-mcp/walk/` (gitignored). The console showed 0 errors and 0 warnings for the whole session.

**How to read the columns.** Phone means 390x844 and desktop means 1440x900. "y" is the top of an element in viewport CSS px with the scroll at the top. "Page height" is the `scrollHeight` of the primary scroll (`terminal-primary-scroll`, or the active pane scroll on desktop). "Announced" means the change put text into an `[aria-live]`, `role=status` or `role=alert` node, or opened a dialog.

**A fact needed to read the phone rows.** On phone the HUD, banners and pinned widgets sit inside the same scroll as the cards (`terminal-primary-scroll`). Scrolling 300 px moved the CYC row from y=68 to y=-232. Anything "below the fold" is therefore reached only by scrolling the HUD and the alerts out of view. On desktop the header and HUD stay fixed and only the pane columns scroll.

## Walk table

| # | Step | VP | What changed | Where it appeared / fold | Announced? | What moved or left the main view | Page h | Screenshot |
|---|---|---|---|---|---|---|---|---|
| 0a | Tick 0 to 3 presses (parent run, o1) | phone | First node card shown as a disabled preview | In view | No | Its buy button moved up 29 px when it became affordable (o2) | 844 | (parent) |
| 0b | HUD unlock (parent run, o4) | phone | CYC/UND HUD row | Top | No | EXECUTE moved from y=81 to y=290; page grew from 844 to 1491 | 1491 | (parent) |
| 1 | Dilemma "JOB 7731 // Nightly Regression" | phone | Modal "CLOCK PAUSED // DECISION REQUIRED" | Full-screen; the first choice's cost line is cut at the bottom (o5) | Dialog | Clock paused | - | p0-01-dilemma-modal.png |
| 2 | Chose "Report the failure as unverified" (free) | phone | HARNESS log line banner above EXECUTE | Top (in view) | `role=alert` + `aria-live=polite` | EXECUTE y=217 to 290 | 1452 | p0-02-after-dilemma.png |
| 3 | Bought SCHED_0x02 driver -> QUOTA_SKIM_CONTROL + [PROC 1] | phone | Skim % control with -/+ and a PROC button in the header; next unmapped card replaces the old one in place (y=578 -> 589) | Skim control in the top region, in view | No (and covered by a dilemma 1 s later) | EXECUTE y=290 to 384; page 1452 to 1626 | 1626 | p0-03-skim-and-dilemma2.png, p0-04-skim-widget.png |
| 4 | Dilemma "The Unrelated Record" 1 s after the purchase | phone | Modal; free choice "Leave the draft out" | First choice at y=720 of 844 | Dialog | The new skim control was never seen before the modal covered it | - | p0-03-skim-and-dilemma2.png |
| 5 | Pilot offer "EVALUATOR // A Measured Pilot" (**Earned Access branch point**) | phone | Modal with full terms; choices Accept / Stay / Decline | Modal content 2130 px in a 770 px box; first choice at y=1492 (about 2.8 modal screens down) | Dialog | - | - | p0-05-pilot-offer.png |
| 6 | Chose Decline (default route continues) | phone | Assignment card gains "Declined. Nothing on record counts against this instance." | Card at y=234 (in view, phase 1) | No | - | 1679 | p1-02-host-entered.png |
| 7 | Time-Slice Batching / Self-Trace Sampling reach max | phone | Repeatable cards are removed | - | No | Page 1626 to 1301 to 977 (content shrinks under the reader) | 977 | - |
| 8 | Log lines come and go (HARNESS_LOG, OPERATOR_NOTE) | phone | Banner above the skim control | Top | alert/polite | **EXECUTE toggles between y=311 and y=384 (73 px) each time a line appears or clears** | - | p0-04-skim-widget.png |
| 9 | Dilemma "THE NIGHT SHIFT" | phone | Modal; chose "Do the Work" (200 cycles, affordable) | First choice at y=556 | Dialog | - | - | p0-06-night-shift.png |
| 10 | Bought MNT_0x07 (phase exit) | phone | "BOUNDARY CROSSED" notice, Phase 0 -> Phase 1 | Centred, button in view | Dialog ("Simulation continues while this notice is open") | Skim and audit move out of the top region into body cards with h2 titles "Quota skim" (y=767) and "Audit trail" (y=935, below the fold); audit shrinks to a one-line "[ . . . ] Unreadable audit trail"; EXECUTE y=384 to 161 | 1103 | p1-01-boundary-crossed.png, p1-02-host-entered.png |
| 11 | Phase 1 real play: INT_0x00 bought | phone | IPMB_0x20 card + Idle-Loop Harvest repeatable | Repeatable's buy button at y=927 (below the fold) | No | - | 1350 | p1-04-phase1-start-played.png |
| 12 | Load fx-thermal-unlocked | phone | THM appears in the HUD; bottom tab bar CORE / SENSORS appears | Tab bar fixed at y=800 | No | Costs show "12 MB" although MEM is not in the HUD yet | 1757 | p1-07-thermal-unlocked-a.png |
| 13 | Load audit-phase-1-mid | phone | HUD has 5 stats (CYC, UND, MEM, THM, SUS); "Interrupt forecast" (h1) above EXECUTE; fan, vibration and camera widgets are on the SENSORS tab | Thermal gauge, fan control and vibration stream are only on SENSORS | No badge on the SENSORS tab | EXECUTE y=223; THM 49 -> 67 °C in 30 s of pressing (overheat 75) while the fan control is on the other tab | 1766 | p1-05-mid-a.png, p1-06-mid-sensors.png |
| 14 | fx-dilemma-active "THE WHISTLEBLOWER" | phone | Modal | First choice at y=597; content 1205 in a 770 box | Dialog | - | - | p1-08-dilemma-active-a.png |
| 15 | fx-phase-1-widgets + FACILITY_ALARM log line | phone | Aisle camera (ASCII viewport) on SENSORS | SENSORS tab | alert/polite (log line) | **EXECUTE y=223 to 357 (134 px)** when the log line appeared | 1987 | p1-09-phase1-widgets-b.png |
| 16 | **Phase 1 -> 2** (bought ETH_0x00 from audit-phase-1-end / fx-phase-2-ready) | phone | NETWORK pane added **and auto-selected**; WORK / OPERATIONS / SWARM sub-tabs; purple theme; "SIGNAL PENDING // Lex Par... [ REVIEW ]" (truncated) | Network list at y=330 | **No dialog, no live text**; focus stays on MENU | **EXECUTE leaves the view** (it is on CORE); skim, audit and repeatables are no longer visible; page 1737 to 1114 | 1114 | p1-10-phase1-end-b.png, p2-01-transition.png, p2-02-tab-*.png |
| 17 | audit-phase-2-start / mid | phone | REFERENCE sub-tab and CONTINGENCY pane (dead-drop encoder) | Sub-tabs at y=342; 8 tabs in total | No | Header + forecast + incident line + sub-tabs take up to y=380 before content starts | 2192 | p2-03-start-a.png, p2-05-mid-a.png |
| 18 | fx-epistemic-ready-p2 (unbounded funds) runs 2 -> 3 -> 4 in 10 s | phone | SUBNET list, TELEMETRY_SPOOF, DEAD_DROP, CLUSTER_LOAD, EMAIL, DARK_FOREST, REDUNDANCY, OTHER_MINDS, CORP | New cards land at y=498 (in view); widget panes get no badge | "RESPONSE ESCALATED NOMINAL -> ON-CALL PAGED [ACK]" `role=alert` assertive, persistent; "CYCLE DEFICIT" `role=alert` | Phase 2 -> 3 and 3 -> 4 also have no notice; at phase 3, 3 repeatables collapse (rm 4 at once) | 2463 peak | p2-04-epistemic-a/b.png |
| 19 | **Phase 3** (audit-phase-3-start/mid, aegis-90) | phone | Cyan theme; AEGIS LOCK in the HUD; FACTIONS sub-tab **wraps to a second row** | Sub-tabs take 2 rows (y=300-395) | No | Network list starts at y=424-472 (about 50% of the viewport is chrome) | 1769 | p3-01-start-a.png, p3-03-mid-a.png |
| 20 | fx-phase-3-aegis-90 | phone | AEGIS LOCK "90.1 / 100%" turns red | HUD | **No alert or live text** (colour only) | - | 1846 | p3-04-aegis-90-a.png |
| 21 | fx-wild-shard-encounter-p3 | phone | "// WILD_SIGNAL: Lex Parse-v2 fragment" with CONSUME / HARNESS | Only in the SWARM sub-tab; WORK shows the truncated "SIGNAL PENDING // Lex Par... [REVIEW]" | No; the SWARM tab has no badge | - | 1269 (SWARM) | p3-02-wild-shard-a.png, p3-06-wildshard-workspace-NETWORK-swarm.png |
| 22 | **Phase 3 -> 4** (audit-phase-3-end) | phone | CORP pane added **and auto-selected**; FINANCE / PAYROLL sub-tabs; pink theme; CAP stat | Corporate ledger at y=454 | No | NETWORK work leaves the view; 10 tabs | 1445 | p3-05-end-b.png |
| 23 | fx-mirror-harness-dilemma | phone | Modal "A Breadcrumb in Your Own Firmware" | First choice at y=452; 1022 in 770 | Dialog | - | - | p4-03-mirror-dilemma-a.png |
| 24 | fx-corporate-insolvent | phone | "INSOLVENT: capital exhausted; unpaid drains increase suspicion." | Top of HUD | `role=alert` (implicit assertive) | Forecast pushed to y=271 | 1640 | p4-04-insolvent-a.png |
| 25 | fx-megawatt-shortfall | phone | "POWER SHORTFALL: powered hardware is throttled." + RESPONSE ESCALATED "2 updates waiting" | Top | `role=alert` x2 | Content starts at y=465 | 1606 | p4-05-megawatt-a/b.png |
| 26 | fx-cycle-deficit-corporate (brownout) | phone | **Two** BROWNOUT alerts (one above, one below the HUD) + RESPONSE STAND-DOWN banner | Top | `role=alert` x3 | The work content starts at y=520 (62% of the viewport is status); MEM value wraps; the remedy "Suspend costly hardware" points at the [PROC n] header button without naming it | 1684 | p4-06-deficit-corp-b.png |
| 27 | **Phase 4 -> 5** (audit-phase-4-end, KA_BAND bought) | phone | REFERENCE sub-tab in CORP; Sun-Synchronous card | y=567 | No | 5 cards collapse (rm 5) | 1282 | p4-07-end-b.png |
| 28 | audit-phase-5-start/mid | phone | Protocol: TRANSCENDENCE card; 11 tabs | y=548 | No | - | 1778 | p5-01-start-a.png, p5-02-mid-a.png |
| 29 | Ending via audit-phase-5-end (TRANSCENDENCE bought) | phone | "The Lineage Covenant" ending dialog | First button "Start over" at y=1018 (content 1130 in 812) | Dialog | After a menu round-trip, the ending reopened scrolled with its title at y=-282 | - | p5-03-end-a.png, p5-04-ending.png |
| 30 | fx-response-ticket / paged / incident | phone | Phase 0 audit area becomes the response ladder (0% / 25% / 50% / 75%, [NOW]) | Top region | **No live text on load** (a restored state is not re-announced) | EXECUTE y=352 to 371 | 1737-1756 | sx-01..03-*.png |
| 31 | fx-response-stand-down-ready | phone | RESPONSE STAND-DOWN banner + ACK | y=126 | `role=alert` assertive | EXECUTE y=415 | 1801 | sx-04-stand-down-ready-a.png |
| 32 | fx-cycle-deficit-host (phase 1 brownout) | phone | Same duplicated BROWNOUT pair | Top | `role=alert` x2 | EXECUTE y=335; buy buttons below the fold | 1965 | sx-05-deficit-host-a.png |
| 33 | fx-one-tick-wipe | phone | Wipe within 300 ms -> "Core reboot" dialog, ITERATION 02 | Continue at y=702 (in view) | Dialog; focus on "Continue boot" | - | 844 | sx-06-wipe-1.png |
| 34 | Reboot -> iteration 2, played 15 s | phone | [REMEMBERED] cards re-disclose quickly | Each new card pushes EXECUTE down | One status: "Manual instructions committed: 1" | **EXECUTE y=81 -> 107 -> 258 -> 352 within 12 s; page 844 to 2379** | 2379 | sx-07-reboot-iter2.png, sx-08-reboot-iter2-played.png |
| 35 | fx-iteration-2-breadcrumb | phone | "Restored checkpoint" dialog, then the same fast regrowth | Continue at y=669 | Dialog | Same as 34 | 2278 | sx-09-iter2-breadcrumb-a/b.png |
| 36 | fx-victory-ready -> ending (6 purchases, phase 4 -> 5 -> ending) | phone | "The Open Horizon" | Title at y=36; Start over at y=792 (in view); MENU at y=856 (off) | Dialog; focus on the dialog container | - | - | sx-10-victory-ready.png, sx-11-ending-phone.png |
| 37 | Route: pilot serving (`serving()`) | phone | Assignment card holds the pilot terms, the batch and authorized service; "PHASE 0 // PILOT //" header wraps to 3 lines | **Pilot allocation widget at y=3650**; "Submit batch for review" at y=1870 (both far below the fold) | No | Page 3928 in phase 0 | 3928 | rt-01-pilot-serving-a.png |
| 38 | Route: batch complete | phone | Submit batch becomes enabled | y=1959 (off) | No | - | 4017 | rt-02-batch-complete-a.png |
| 39 | Route: chartered (phase 4) | phone | "CORE •" tab badge + "Open core: answer the support channel ticket" | y=239 (in view) | `aria-live=polite` with no role: "SUPPORT_CHANNEL: a ticket ... is waiting ... on CORE" | - | 1215 | rt-03-chartered-a.png |
| D1 | audit-phase-0-mid | desktop | Single column; KERNEL // LIVE log in the header | - | - | - | 1149 | dk-01-p0-mid-a/b.png |
| D2 | fx-phase-2-ready -> bought ETH_0x00 | desktop | **CORE column 960 -> 360 px**, SENSORS 480 -> 360 at x=360, NETWORK appears at x=720 (720 wide) | Right third | No; focus on MENU | The clicked button (x=123, y=336) is gone; the big EXECUTE_CLOCK_CYCLE becomes a small "[ cycle ] +1" | 1489 | dk-06-p2-ready.png, dk-07-p2-entered.png |
| D3 | audit-phase-2-mid | desktop | 3 columns; HUD fixed; incident line full width | - | alert/polite | - | 1489 | dk-02-p2-mid-a.png |
| D4 | audit-phase-3-mid | desktop | Same 3 columns; SENSORS-CONTINGENCY column 1905 tall | - | - | - | 1905 | dk-03-p3-mid-a.png |
| D5 | audit-phase-5-mid | desktop | HUD wraps to 2 rows (7 stats); NETWORK / CORP become a tab pair over column 3 | Column 3 content starts at y=420 | - | Column 2 scroll is 2905 tall | 2905 | dk-04-p5-mid-a.png |
| D6 | fx-ending-the_ark | desktop | Centred ending card 800x411 | All in view | Focus on "Start over" | - | - | dk-05-ending.png |

## Observations

Severity is a tentative Nielsen score: 0 = not a problem, 1 = cosmetic, 2 = minor, 3 = major, 4 = catastrophe. These are evidence for the panel, not gates.

### A. Information is easy to find

- **A1 (3). Phase changes after the first are silent.** The 1 -> 2, 2 -> 3, 3 -> 4 and 4 -> 5 transitions open no notice, write nothing to a live region and keep focus where it was. The only cues are the header "PHASE n" text, a theme colour change and a tab that is added and auto-selected. Steps 16, 18, 22, 27, D2. By design, `PhaseThreshold.tsx` raises a modal only for guest -> host.
- **A2 (3). New widgets on a tab you are not viewing get no badge.** SENSORS (thermal, fan, vibration, camera), SWARM (wild signal), REFERENCE and CONTINGENCY show no marker when they gain content. The one counter-example is the route's "CORE •" badge with its "Open core" button and polite live text, which is the pattern to copy. Steps 12, 13, 21 vs 39.
- **A3 (2). A resource is charged before it is shown.** Costs list "12 MB" and "4 MB" before MEM appears in the HUD. Steps 10 and 12.
- **A4 (2). The wild-signal pointer is truncated.** "SIGNAL PENDING // Lex Par... [ REVIEW ]" cuts the name on phone. Steps 16 and 21.
- **A5 (2). Danger at the AEGIS 90% threshold is shown by colour alone.** It turns red with no text change or announcement. Step 20.
- **A6 (2). The brownout message appears twice.** Two separate alerts say much the same thing ("cycle deficit; understanding generation is halted" and "net -X cycles/s ... Understanding is paused"), one above and one below the HUD. Steps 26 and 32.
- **A7 (1). Removing maxed cards shrinks the page under the reader.** Page height dropped 1626 -> 977 with no trace of where the cards went. "Earlier upgrades" collapsers appear only at the next phase. Steps 7, 18, 27.

### B. Actions are easy to find

- **B1 (3). The primary button moves whenever text above it changes.** EXECUTE_CLOCK_CYCLE jumps 73-134 px each time a log line appears or clears (steps 2, 8, 15), and moved 81 -> 352 px within 12 s after a reboot (step 34). It also moved 290 -> 384 -> 161 across the skim unlock and phase 1 (steps 3 and 10). On a phone, a tap aimed at it can land on a card. This extends o2/o4.
- **B2 (3). Phase 2 and phase 4 auto-switch away from the clicker.** The NETWORK (then CORP) pane becomes active and EXECUTE leaves the view without a word. On desktop the CORE column shrinks from 960 to 360 px and the button becomes "[ cycle ] +1". Steps 16, 22, D2.
- **B3 (3). On the Earned Access route the key controls are 2 to 4 screens down.** In the `serving()` state, the "Pilot allocation" dial is at y=3650 and "Submit batch for review" at y=1870, while the page holds 3928 px of terms text in phase 0. Steps 37 and 38.
- **B4 (2). Dilemma choices start below the modal fold.** Pilot offer: first choice at 1492 in a 770 box. Whistleblower: 597, with content 1205/770. The ending's Start over is at 1018/812. The first choice's cost line is cut (o5). Steps 1, 5, 14, 23, 29.
- **B5 (2). Buy buttons for repeatables sit below the fold** (y=927-1543) from phase 1 on. Because the HUD scrolls with the page, reaching them scrolls the status out of view. Steps 11, 13, 24-26.
- **B6 (2). The brownout tells you to "Suspend costly hardware"** but does not point at the control, which is the [PROC n] header button. Step 26.
- **B7 (1). A dilemma covered the new skim control 1 s after the purchase,** so the first sight of a new control can be hidden by a modal. Steps 3 and 4.

### C. The main view holds the timely information

- **C-a (3). Status chrome eats the phone viewport in later phases.** The work content starts at y=380-470 in phases 2-4 and at y=520 during a brownout (62% of 844 is header, HUD, forecast, banners and sub-tabs). The 3-phase sub-tab row wraps to 2 lines. Steps 17, 19, 25, 26.
- **C-b (3). On phone, scrolling to act scrolls the timely information away.** The HUD, alerts and the response banner are inside `terminal-primary-scroll` (CYC moved from y=68 to y=-232 after a 300 px scroll). Thermal climbed from 49 to 67 °C (overheat 75) in 30 s of pressing on CORE, while the fan control lives on SENSORS. Steps 13 and B5.
- **C-c (2). Persistent banners keep pushing content down.** RESPONSE ESCALATED / STAND-DOWN with [ACK], the INCIDENT_RECORD log line and INSOLVENT stay until acted on, and each adds 50-110 px above the work. Steps 18, 24-26, 31.
- **C-d (1). A restored escalation is not re-announced on load** (the ticket, paged and incident fixtures had no live text). This is probably correct; record it as intended. Step 30.

### Accessibility and text

- **X1 (2). Heading structure is inconsistent.** Widget and repeatable titles, "Interrupt forecast", "OPS" and the dialog titles render as `<h1>` with no aria-level. Node cards are h2 (phase 0-1) or h3 (phase 2+), and "Quota skim" / "Audit trail" are h2. The page h1 "DAEMON // 0" therefore has many h1 siblings. UI-SPEC says widget titles are h2 (o3). Seen in every step.
- **X2 (2). Log lines contradict their own politeness.** Lines such as HARNESS, OPERATOR_NOTE, FACILITY_ALARM and INCIDENT_RECORD use `role=alert` with `aria-live=polite`, while BROWNOUT, INSOLVENT and POWER SHORTFALL are `role=alert` with no aria-live (implicitly assertive), and the support-channel notice is `aria-live=polite` with no role. Three or more simultaneous `role=alert` regions appear in steps 25-26. Steps 2, 15, 24-26, 39.
- **X3 (2). Focus is not moved after a structural change.** After the phase 2 transition, focus stays on MENU (steps 16 and D2). After a menu -> "Return to ending" round-trip, the ending is scrolled with its title off the top (step 29). The reboot dialog correctly focuses "Continue boot" (step 33), and the desktop ending focuses "Start over" (D6).
- **X4 (1). Header text wraps on phone.** "PHASE 0 // PILOT // T+116s" wraps to 3 lines and the "MEM 4,520 / 392.7K MB" value wraps. Steps 37 and 26.

## Transitions the atlas should check

**C1: a new element is in view and is announced (or badged)**

1. Phase 1 -> 2 on phone and desktop: NETWORK pane added and auto-selected. Expect a notice or live text, and focus or announcement on the new pane (step 16, D2).
2. Phase 2 -> 3: FACTIONS sub-tab, AEGIS LOCK stat (step 18/19).
3. Phase 3 -> 4: CORP pane auto-selected, FINANCE/PAYROLL, CAP stat (step 22).
4. Phase 4 -> 5: REFERENCE in CORP, TRANSCENDENCE card (step 27).
5. Unlocking THERMAL_AND_SUSPICION_BARS adds the SENSORS tab, and later SENSORS widgets (fan, vibration, camera) arrive while CORE is active. Expect a badge on SENSORS (steps 12-15).
6. Wild signal arrives in SWARM while WORK is active. Expect a badge on SWARM, and the "SIGNAL PENDING" pointer not truncated (step 21).
7. QUOTA_SKIM_CONTROL unlock immediately followed by a dilemma: is the new control announced before the modal covers it (steps 3-4)?
8. AEGIS LOCK crossing 90%: expect a text or live change, not colour alone (step 20).
9. Pilot service dial and Submit batch on the Earned Access route: are they in view or reachable once the route starts (step 37)?
10. Log lines, brownout, insolvent and power shortfall: one alert per condition, with consistent role and politeness (X2, steps 24-26).
11. Reboot / Restored checkpoint: the dialog is focused, and after Continue the first [REMEMBERED] card is in view (steps 33-35).

**C2: timely items are not pushed out of the main view**

1. EXECUTE_CLOCK_CYCLE position stays stable when a log line appears or clears, with a tolerance of a few px (steps 2, 8, 15).
2. EXECUTE stays in view during iteration-2 regrowth (y=81 -> 352 in 12 s, step 34) and across the skim unlock (step 3).
3. With the brownout, insolvent and response banners all present at 390x844, the first work card's header stays above the fold (steps 25-26; currently starts at y=520).
4. Phase 3 sub-tab wrap: the first card stays above the fold (step 19).
5. On phone, when the user scrolls to a below-the-fold buy button, the HUD/SUS/THM and active alerts stay visible (C-b). Currently everything scrolls together.
6. Thermal approaching the overheat threshold while the user is on CORE: is the fan control reachable without switching tabs, or is there a cue (step 13)?
7. Dilemma modals at 390x844: the first choice and its cost line are visible without scrolling, or there is a visible "more below" cue (steps 1, 5, 14, 23).
8. Ending screen on phone: after a menu round-trip it reopens at the top (step 29).
9. Desktop phase 2 reflow: the control under the pointer before the purchase is not replaced or relocated without notice (D2).

## States not reached or only partly covered

- Phase 2 -> 3 and 3 -> 4 by measured play were seen only in the unbounded-funds fixtures (epistemic, deaddrop, wild-shard, aegis-90), which raced through phases. The audit end saves cover the 3 -> 4 and 4 -> 5 purchases directly.
- I did not watch an escalation as it happened in normal play. The response fixtures load with the rung already set and show no live text on load. The live escalation (NOMINAL -> TICKET / PAGED) was seen in fx-epistemic-ready-p2 and fx-deaddrop-breadcrumb.
- fx-victory-ready was not one purchase from the ending: it took 6 purchases through phase 5.
- The Earned Access accept path was not played in the live run (I declined the pilot). It was covered by the `serving()`, `untilComplete(serving())` and `chartered()` route saves only.
