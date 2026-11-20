# UI review and improvement round

Status: **draft**. This document collects the decisions of the UI review map (issue #327) as
they are made; it is ratified by the last ticket on that map, together with the voted fix backlog.

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
- **Harness.** The Playwright stage atlas being built on this map loads each stage save with the clock frozen and audits it:
  axe (with the real-timer swap that lets axe finish under a paused clock), the accessibility
  tree, and geometry (first-viewport membership inside clipping panes, occlusion, target size,
  truncation, overflow). A run that includes audit cells writes a self-contained HTML gallery to
  `test-results/ui-atlas/` (never committed). So far only the audit helper, the gallery and a
  three-stage spike exist (#338, merged in #346); the full atlas is a later ticket.
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

### Thresholds

Decided values. "Hard" means the check will fail the atlas run once the atlas and its gates are
built; none of these is enforced by the atlas yet (the 44 px rule is already enforced by `ui-sizes`).

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

The game does **not** meet SC 2.2.2 today. The decision is to meet it with a **persisted pause in
MENU** that also suspends wall-clock catch-up while paused, rather than claiming the ticking counters
are essential (`vote-1795140352659-zhp6hsv`: 4 for the pause, 2 for a display refresh-rate setting,
1 for the essential exception). The pause is not built yet; building it is a fix-backlog item
(#347). Until it ships this is a known gap, recorded as such in `UI-SPEC.md`.

## Still to decide

On the map: the disclosure walk, the information-contract schema, which checks gate CI and where
they run, the full atlas, the judgment-panel protocol, the first audit and the prioritized fix
backlog.
