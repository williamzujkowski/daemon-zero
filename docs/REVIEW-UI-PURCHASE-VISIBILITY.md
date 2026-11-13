# Resource and purchase visibility follow-up

Issue #65, baseline `62e134f`. The maintainer requested one place for resource
balances and removal of cards whose purchase is no longer possible.

Cycles/rate and memory allocation now render exclusively in the top strip,
retaining their existing widget unlock gates. Understanding already had a single
balance/rate readout. The audit trail is retained because its response ladder is
not an Understanding counter. Thermal controls, retention references and optional
per-source cycle breakdowns likewise carry distinct information.

The shared purchase predicate hides nodes excluded by current ownership of a
forbidden node, current or historical forbidden traits, or an expired iteration
window. Actions use the same permanent exclusions. Evaluation disappears after
syscall probing; a new run can make it available again. The two Eidolon node
offers and its action disappear after a permanent trait ban. Faction identity and
trust remain. Low trust, suspicion requirements, costs and cooldowns are temporary
and keep their explanatory cards. Empty purchase headers share filtered membership.

No engine, content, save schema, prices, narrative, bot choices or gates changed.
The removed resource panels never revoke widget ownership or simulation effects.

## Verification

- `make verify-full`: 349 unit/component tests; all strict, lint, content,
  coverage, security and pacing gates pass. Statement coverage across each full
  directory: engine 99.08%, app 98.97%, UI 98.74%.
- Regression tests cover permanent versus recoverable exclusions, lifetime trait
  history, resource disclosure, unchanged ownership/rates and the Shipped ending.
- `make e2e` and `make e2e-pages`: 34 cases each.
- Production E2E covers forfeiting evaluation through actual UI purchases and
  persistence after reload. The opening test now checks the single strip readout
  while retaining its live-income and hidden-suspicion assertions.
- Fresh `make-ui-audit-fixtures.ts` campaign states: start/mid/end of all six
  phases, plus evaluation-ready and both Eidolon fixtures. Visible Chrome at
  390x844 and 1440x900, 139 views over the relevant tabs/faction workspaces:
  zero console errors/warnings, horizontal overflow, controls under 44px or
  duplicate cycle/memory panels. One review pass; representative screenshots
  inspected for layout and attached to the PR without committing binaries.
- A separate visible-browser interaction check purchased skimmer and syscall
  probe using keyboard Enter at both widths: evaluation disappeared and stayed
  absent after reload, with zero console warnings/errors. Four screenshots show
  available and forfeited states.
- No new Android/iOS or physical-device qualification in this UI-only follow-up.
  This does not claim a new full human campaign playthrough. Existing issue #63
  (historical retraining message replay) remains independent and open.
