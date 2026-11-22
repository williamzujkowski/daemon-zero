# UI review and improvement round

Status: **ratified** (#344, `vote-1795192273900-2ct3ek4` and `vote-1795192362627-ufk4d96`). This
document records the decisions of the UI review map (issue #327), the first audit and the voted fix
backlog. Fixes land against the backlog below; a fix that changes a decision here updates it in the
same PR.

## Why

The maintainer asked for a full review of the terminal UI as it unfolds: many components, texts,
layouts and theme choices are suboptimal. Three goals, checked at every disclosure stage, game
phase, special state and viewport:

1. information is easy to find;
2. actionable things are easy to find;
3. the main view holds all the timely information a player needs to understand the game now.

## Method

- **Map.** The work is charted with Matt Pocock's `wayfinder` skill as GitHub issue #327 and its
  child decision tickets, linked by native blocked-by relations. Decision ("grilling") tickets are
  resolved by nexus `consensus_vote` with every option declared; the maintainer delegated approval
  to nexus panels (AGENTS.md "Approval and merging").
- **Research.** Background agents read primary sources; the notes live on unmerged branches:
  `research/ui-review-frameworks` (Nielsen heuristics and severity, cognitive walkthrough, PLAY and
  Pinelle game heuristics, WCAG 2.2 AA, Xbox Accessibility Guidelines, Laws of UX; a 45-check
  rubric), `research/ui-review-playwright` (harness tooling), `research/ui-review-incremental`
  (what incremental-game designers and researchers recommend; 25 review questions) and
  `research/ui-review-stage-inventory` (87 atlas rows, 56 for v1, nine gaps with recipes).
- **Harness.** The Playwright stage atlas (`tests/e2e/ui-atlas.e2e.ts`, `docs/TESTING.md`) loads each stage save with the clock frozen and audits it:
  axe (with the real-timer swap that lets axe finish under a paused clock), the accessibility
  tree, and geometry (first-viewport membership inside clipping panes, occlusion, target size,
  truncation, overflow). A run that includes audit cells writes a self-contained HTML gallery to
  `test-results/ui-atlas/` (never committed). Built on this map: the audit helper and gallery (#346),
  the stage table and derived contract (#349), the gates in `make e2e` with known gaps (#350), the
  evidence files, CI gallery upload and nightly matrix (#354) and the transitions spec (#355).
- **Disclosure walk.** Besides static stages, the review plays the unfolding in order in a headed
  browser against the production export and records what appears, where, whether it is announced
  and what it displaces; the atlas then checks those transitions.
- **Judgment.** What automation cannot measure (clarity of copy, hierarchy, whether the main view
  says what matters now) is scored by a multi-model nexus panel per atlas cell.

## Decisions so far

| Decision | Outcome | Record |
|---|---|---|
| Destination | Ratified spec plus harness v1 (stage atlas, per-stage contract checks, gallery), first full audit, voted fix backlog | `vote-1795138227298-x97iuxk`, 7/7 |
| Where the per-stage information contract lives | A typed manifest under `tests/e2e/`, keyed by stage, naming items by accessible name; no content changes | `vote-1795138157826-xjwlhqf`, 7/7 |
| Visual evidence | No committed PNGs. Screenshots are per-run gallery artifacts; committed text ARIA snapshots and numeric gates are the regression net | `vote-1795138316809-98i34no`, 7/7 |
| Judgment findings | Each panel seat scores independently (Nielsen severity 0-4 plus the four cognitive-walkthrough questions); a finding is filed when at least two seats raise it at mean severity 2 or more; a reproducible defect (failing check, screenshot evidence) is filed regardless of seat count; fixes are chosen by vote; the maintainer playtest is the final check | `vote-1795138566908-3j8yemi`, 7/7 |
| Ending after a game-menu round trip (#364) | Focus returns to the menu launcher and the player keeps their place, as in every utility menu (WCAG 2.4.3); the atlas check `t-ending-menu` requires the launcher focused and in view, and no longer expects the title in view | `vote-1795202661293-vk191wx`, 7/7 |
| Dilemma choices on a phone (#371) | **Superseded 2026-11-21 by the maintainer:** the index repeated every choice as a small box above the full cards and was removed as redundant. Each choice now appears once, folded to a row with its cost (the #371 concern: every alternative and price in the first view), and opens to its details and commit control; several can be open at once. Was: an index under the context listing every offered choice with its cost, each jumping to its card | `vote-1795206922704-4ljmpd2`, 6 to 1; reversed by maintainer request |
| Wild-signal pointer (#359) | The signal name may wrap to two lines so a sighted player can read which signal waits; [ REVIEW ] stays unbroken. This reverses #162's one-line rule at a cost of 22px where the name wraps | `vote-1795208946788-lpjbyc5`, 6 to 1 |
| The one announcement path (#356, #357, #360) | One visually hidden polite live region in the chrome speaks phase changes (in the arrangement's words), new widgets, the AEGIS critical crossing and a pending wild signal; no replay on restore; the AEGIS HUD says CRITICAL | `vote-1795210455666-e01ydjc`, 7/7 |
| The omen and EXECUTE (#362) | The omen never sits above the primary action in one flow: on the phone it renders under EXECUTE in CORE (the CORE tab marks it off-pane); on column tiers it stays in the fixed chrome in a reserved slot, label inline | `vote-1795217200867-j2buva4` (4 to 3), refined by `vote-1795219347137-c21nx42` (7/7) after the desktop scroll-away |
| Number units (#380, #404) | One scheme everywhere: K/M/B/T/P with three significant digits for live amounts; memory in binary MB/GB/TB with used/capacity in the capacity's unit; prices lossless (unit change or abbreviation only when exact); live readouts spoken in words | `vote-1795228570236-gzx0uif`, 7/7 |
| CORE order (#385, F3) | Status-first: the omen, a non-nominal standing with the recall, and retraining lead; route work before the purchases; settled terms fold | `vote-1795245515054-vgmv0a9`, 7/7; judgment `vote-1795241588594-4apdzcm`, 5/2, both dissents' defects corrected before the decision |
| One-way confirmation (maintainer request, 2026-11-21) | A one-way purchase opens a CANCEL-first confirmation before it buys; ordinary purchases still buy on the first tap | maintainer request; panel on the PR |
| One-way actions (#372, F5e) | Phase openers and run enders are marked `[ WRITE DRIVER: ONE WAY ]` with "Cannot be undone" right after, from their effects (a line above the control broke three size-matrix fold cells); confirmations put CANCEL first and the wipe and Start Over say there is no undo. No reviewed rule fixed the button order (UI-SPEC "Destructive actions" names none), so no design vote | panel on the PR |
| Distinctions next goal (#379, F5d) | Unearned distinctions are counted by kind (conduct, or an outcome of a scene), never named, keeping the UI-SPEC rule the ratification named; no locked placeholders | panel on the PR |
| Trait and carry-over glosses (#377, F5c part 1) | A granted trait carries a spoiler-safe gloss; reboot retraining marks state their undo price; the ending says a new run keeps nothing. Unchanged by design: the blind suspicion badge has no magnitude (DESIGN.md disclosure rule; changing it needs a vote). Already fixed by #404: "+45000" now reads "+45K". Part 2: the reboot dialog names the Understanding, offshore capital and remembered hardware the wipe carried, from a new run-record field (save v15) | panels on both PRs |
| History readouts under status-first (#385) | After the purchases (compacting them fixed none of the regressions they caused) | `vote-1795246136374-t01m4ug`, 7/7 |
| Recall alert extent (#367) | The alert interrupts with its headline only; the three outcome previews follow as ordinary text (the announcer already speaks the omen for the event) | `vote-1795259663677-ebg4049`, 7/7 |
| Suspicion driver and stand-down guidance (#368, #403, F2) | The forecast adds "Rising most from: …" (the largest term of the applied rate) while suspicion rises; a response notice adds where the rung stands down and the one lever that lowers the applied rate most, with whether it alone makes suspicion fall, or says no action lowers it this moment. Every name comes from the engine query `suspicionOutlook`, which takes each candidate action through the real action and re-reads the applied rate, so no lever is named that the rung, its terms or an offset would defeat (#402's four panel passes) | panel on the PR |

### Thresholds

Decided values. "Hard" means the check fails the atlas run: every P1 stage row at 390x844 and
1440x900 in `make e2e`, the full matrix nightly (#350, #354). A failure today's UI already has is a
recorded known gap with its filed issue, asserted to still fail, never a loosened threshold.

| Check | Value | Gate | Record |
|---|---|---|---|
| Pointer target size | 44x44 CSS px for every interactive element (unchanged project rule) | hard | `vote-1795139717692-ell0m5n`, 6 to 1 |
| Enabled primary actions in the first viewport (Hick-Hyman) | per-stage curve; a stage-to-stage jump above 3 is flagged for the panel | reported | `vote-1795139643040-hf4224j`, 7/7 |
| Live-updating numbers per labelled group (Cowan) | more than 4 ungrouped live numbers per group is flagged for the panel | reported | `vote-1795139870688-kedi467`, 7/7 |
| Content type sizes per view | at most 3 distinct content font sizes; the count of largest-size elements is reported only | hard (sizes) | `vote-1795139907340-rx85n85`, 4 to 3 |
| Fold for each stage's timely items | fully inside the first viewport at 390x844 and 1440x900 on a paused clock; 360x640 reported; the exceptions recorded in `UI-SIZES.md` stand | hard at 390x844 and 1440x900 | `vote-1795140000106-17vo5k0`, 7/7 |
| Locked, inactive and disabled text contrast | at least 3:1 on every plate in every phase (Xbox XAG 102; beyond WCAG) | hard | `vote-1795140167997-40w2u0u`, 6 to 1 |

Dissent: on target size one seat preferred 44 px for primary actions and the WCAG 24 px floor
elsewhere, for space at the 360 floor. On type sizes three seats preferred report-only, because
body text and headings share 14 px. On inactive contrast one seat noted the gate passes by
construction today, since `theme.disabled` changes border and background but not text colour.

### Auto-updating content (WCAG 2.2 SC 2.2.2)

The game meets SC 2.2.2 with a **persisted pause in MENU** that also suspends wall-clock catch-up
while paused, rather than claiming the ticking counters are essential (`vote-1795140352659-zhp6hsv`:
4 for the pause, 2 for a display refresh-rate setting, 1 for the essential exception). It shipped in
fix batch F7 (#347). The flag is stored in the save envelope beside `savedAtMs`, not in `GameState`
(`vote-1795214789307-78d7g5s`, 7/7), so the engine is unchanged and exported save codes do not carry it.

## First audit (#343)

Run on `main` at b81873e: 57 stage rows and 19 transitions at 390x844 and 1440x900.

**Automated gates.** 8 stage-cell failures and 41 transition failures, every one a recorded known gap
(`tests/e2e/atlas/knownGaps.ts`, `transitionGaps.ts`). They group into 12 reproducible-defect issues,
filed regardless of seat count under the judgment rule above:

| Issue | Problem | Severity |
|---|---|---|
| #356 | Phase changes after the guest phase are silent | 3 |
| #357 | Unlocking a control is not announced | 3 |
| #358 | Tabs carry no marker when something arrives on a pane not in view | 3 |
| #359 | Wild-signal pointer cut off on phone | 2 |
| #360 | AEGIS lock at 90% shown by colour alone outside FACTIONS | 3 |
| #361 | Pilot service purchase buried at the bottom of CORE | 3 |
| #362 | EXECUTE_CLOCK_CYCLE jumps when the omen band appears or clears | 3 |
| #363 | Duplicate brownout alerts; omen line role and politeness disagree | 2 |
| #364 | Focus and scroll not restored after reboot and the ending menu round trip | 2 |
| #365 | On phone, scrolling to a purchase takes every timely readout out of view (needs a layout vote) | 3 |
| #366 | [ SAVES ] accessible name does not contain its label | 2 |
| #367 | Review standing and the recall sit far below the fold in CORE | 3 |

**Judgment panel.** Nine `consensus_vote` batches of 5 to 7 stages (protocol #342, rubric of 16
judgment checks), seven seats across the Claude, Gemini and GPT families, each opening the
screenshot, ARIA snapshot and metrics of every cell. Batch 2 lost two seats to the consensus
deadline; both were re-dealt once, one answered and one timed out again, so batch 2 stands at 6 of
7 seats and the other eight batches at 7 of 7. The seats raised 571 clusters (stage, region,
check); 102 met the filing bar. The orchestrator merged them into themes, checked the suspicious
ones against the source, and the ratifying vote (`vote-1795191801156-er5mgjp`: 7 of 7 approve, 5 to file as
merged and 2 to split the multi-surface themes per surface) approved the list:

| Issue | Problem | Severity |
|---|---|---|
| #368 | The suspicion readout in the main view has no level word, trend or driver | 2.5-3 |
| #369 | Warnings name the problem but not the remedy or a route to it | 2-3 |
| #370 | The phone resource strip prints rates without /s | 2 |
| #371 | Dialogs and choice lists put their only or live action below the phone fold | 2-3 |
| #372 | Irreversible actions (phase exits, the run commit, the wipe confirm) look ordinary | 2-3 |
| #373 | Settled and stale content is never retired and sinks live controls | 2-2.5 |
| #374 | The dead-drop encoder renders every pinnable record as a full-width button | 2-3 |
| #375 | The service-channel ticket buries REFER / HOST under about 1000 px of prose | 3 |
| #376 | Requirement and shortfall copy does not read as a requirement | 2-2.5 |
| #377 | Traits, carried-over knowledge and effect sizes are never explained | 2 |
| #378 | Notices that should lead the view are styled as ordinary rows | 2 |
| #379 | The ending gives no spoiler-safe hint of the distinctions left to earn | 2 |
| #380 | The wipe confirmation and boot log print raw 15-digit numbers | 2 |
| #381 | The kernel log screen stacks three back controls before the log | 2 |
| #382 | Harness: patched fixtures show states play cannot reach | n/a |

Two kinds of cluster were not game defects: the Audit trail reading NOMINAL at 26-99 % suspicion and
dead-drop pins naming events the instance never saw are states that only patched fixtures reach
(the response rung climbs on the next tick, `src/engine/systems/escalation.ts`; `pinnableClues`
offers only witnessed records, `src/engine/campaignClue.ts`). They are filed as a harness defect (#382). The seats' named corrections were applied before
filing: one theme ("the menu lists only OVERHEAT at 99 %") came from the same fixture and was
withdrawn into #382 for a re-check; one theme was reframed to keep the rule that unearned
distinction titles are never shown; two merges were split. Clusters that corroborate a filed
reproducible defect went to it as comments (#356, #357, #358, #359, #361, #367).

## Fix backlog (#344)

Ordered by two votes. Batch order: `vote-1795192273900-2ct3ek4`, 7 of 7 approve, 6 for this order
and 1 for pause first. Prototypes: `vote-1795192362627-ufk4d96`, 7 of 7 approve, 6 for two
prototypes and 1 for the phone prototype only.

Each batch is one PR or a short PR series. A fix removes its known-gap entries, so the atlas
assertion that the gap still fails becomes the acceptance test. The maintainer playtest is the
final check on shipped fixes.

| Batch | Issues | What it does | Lands |
|---|---|---|---|
| F0 Harness truth | #382 | Patched fixtures tick once, so the atlas never shows a state play cannot reach; then re-check the menu status at 99 %, the brownout rate and the release preview | first |
| F1 Announcements and attention | #356, #357, #358, #359, #360, #362, #363, #378 | One notice and live-region path, tab badges (the route CORE badge #284 is the pattern), notices that lead styled to lead, EXECUTE no longer displaced by the omen band | after F0 |
| F2 Threat in the main view | #368, #369 | Level word, trend and top driver beside suspicion; every warning names its remedy and routes to the control, built on F1's notice component | after F1 |
| F3 CORE and route order | #361, #367, #373, #374, #375 | One CORE ordering policy, chosen by prototype #385; settled terms and dead widgets fold to one line | after #385 |
| F4a Phone actions | #364, #371 | Focus and scroll restore; dialog actions pinned to the dialog foot | any time after F0 |
| F4 Phone main view | #365 | What stays in view while scrolling, chosen by prototype #384 and a vote on the one-scroll rule | after #384 and that vote |
| F5 Decision and copy clarity | #372, #376, #377, #379, #380 | Irreversible actions marked and previewed, "Requires:" lines, trait and carry-over glosses, a spoiler-safe distinctions hint, number formatting | after F3 |
| F6 Quick fixes | #366, #370, #381 | Label in name, /s on phone rates, one back control on the kernel log | in parallel |
| F7 Pause | #347 | Persisted MENU pause that also suspends wall-clock catch-up; changes `GameState`, so a schema bump and migration, and a forged paused flag in an imported save must not suppress or inflate catch-up | in parallel |
| F8 Coverage | #353 | Transition rows for the remaining C1 and C2 cases, including F1's new announcements | after F1 |

Re-cuts that a majority of seats named were applied before ratification: #362 moved into F1, since
the omen band F1 rewrites causes it on desktop too; #370 moved into F6; #364 and #371 moved into
F4a, which does not wait for the one-scroll vote. One seat's suggestion to move #360 into F2 was
not applied. Dissent: one seat wanted the pause first, because it is a level A gap whose cost
across persistence and runtime an interleaved PR understates; one seat judged the CORE prototype
over-engineering, because each CORE finding already names its fix.

**Prototypes.** #384 (phone main view, three variants) and #385 (CORE ordering, three
variants). Each builds a whitelisted `?variant=` switch and removes it afterwards. Each is judged
by a panel on the atlas gallery over the corrected fixtures, including a scrolled purchase and
enlarged text, then decided by `consensus_vote`. The suspicion readout (#368) is decided by its
copy inside F2, without a prototype.

**Not ticketed** (all seats accepted):
- **Design tokens:** the type-size gate passes everywhere, and no finding names spacing. Revisit
  if a prototype needs a scale.
- **Separate voice and capitalisation pass:** F5 covers the copy findings.
- **Theme and visual identity:** no finding blames the theme itself, and the theme is a
  maintainer question.
- **Component consolidation:** folded into F1 and F2.
- **Late-phase layout:** folded into F3 (#373).
