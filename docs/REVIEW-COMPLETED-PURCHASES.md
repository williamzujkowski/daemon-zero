# Completed purchase tiles — review

Issue #48, based on clean `main` at `866d280` (`v0.1.0-rc.1`). Baseline
`make verify-full` and production E2E passed: 255 unit tests, 14 E2E cases.
Fixtures were regenerated for this review.

Owned nodes leave the purchase feed without changing ownership, tick deltas,
widgets or engine state. Costly daemons retain compact suspend/resume controls;
a disabled passive from an older save retains a resume control until restored.
Capped operatives retain compact dismissal controls and regain their purchase
tile when dismissed. Current actions are reusable cooldown actions, not capped
purchases; faction and corporate one-time offers use node ownership.

## Verification

- `make verify-full`: passed; 262 unit tests. Coverage: statements 98.94%,
  branches 94.55%, functions 99.46%, lines 99.82%.
- Production Playwright: 16 cases passed across both viewports. Tests explicitly
  cover disappearance with retained rates/widgets and compact suspension/resume.
- Component tests cover capped upgrades, payroll dismissal, faction purchases,
  empty network headings and recovery of legacy disabled passive upgrades.
- Balance gates passed unchanged: stealth victory in 2.22 simulated hours;
  greedy run produced 14 wipes. Engine/content and all gate configurations unchanged.
- Security scanners passed; SBOM generated. Trivy advised about the size of an
  existing ignored Android mapping artifact. Playwright's Node workers emitted
  environment colour-variable warnings; browser consoles had no warnings/errors.

Visible Chrome review passed on the first pass at 390×844 and 1440×900 for:
`tick-0`, `guest-skimmer`, `phase-1-widgets`, `phase-2-unlocked`,
`deaddrop-breadcrumb`, `phase-3-aegis-90`, `eidolon-trust-85`,
`corporate-insolvent`, `victory-ready`, `lineage-parser-ready`, and an additional
capped-purchases fixture derived from the fresh victory-ready save. Checked
resource/widget disclosure, the parser reveal, horizontal overflow, text layout,
44 px controls, accessible names and keyboard reachability. No open findings.
Screenshots are attached to the PR, not committed. Long daemon names wrap on
phones while their toggle stays reachable.

## Phase 4 counts

Fresh `victory-ready` fixture, Corporate tab selected. Counts include mounted
purchase cards in the selected panes, including cards below the fold.

| Viewport / panes | Full node cards before → after | All purchase cards before → after |
| --- | --- | --- |
| 1440×900 / Core and Corporate | 20 → 1 | 35 → 16 |
| 390×844 / Corporate | 6 → 1 | 16 → 11 |

All purchase cards includes node cards, repeatables and reusable actions. The
remaining node is the unpurchased victory node. Compact daemon rows are controls,
not purchase cards (10 desktop, 1 phone). Uncapped repeatables remain available.

Native Android/iOS builds and device interactions were not rerun for this UI
change. No new full real-time playthrough was performed; verification used fresh
fixtures, live engine tests and production browser interactions.
