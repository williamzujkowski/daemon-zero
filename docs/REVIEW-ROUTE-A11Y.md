# Route surface accessibility (DZ-13.4)

Issue #233, criterion 13.4. Base `fa532f1` on `main`; branch `feat/dz13-route-a11y`.
Preview only: the specs run in `make e2e-preview`, and the three UI files changed render nothing
in production (their views are null without the overlay's route content). No engine, content,
save, balance, Metro or Makefile change.

## Evidence record

```text
Evidence record
  id:                DZ13-4-ROUTE-A11Y-20261118-1
  kind:              AGENT-OBSERVATION (automated, scripted Playwright)
  requirement:       #233 criterion 13.4
  revision:          feat/dz13-route-a11y on fa532f1; working tree clean (the three commits of this PR)
  build:             preview export (make build-preview -> dist-preview/); channel preview
  url:               http://127.0.0.1:<e2e slot port>/ (scripts/e2e-lock.sh)
  environment:       Playwright 1.65.1 Chromium (headless), axe-core 4.14.1; projects preview-phone
                     390x844 and preview-desktop 1440x900, plus 320x568, 360x640 and 390x844 for the
                     phone layout cases; DPR 1; large text by doubled CSS font size and line height;
                     reduced motion by emulateMedia
  profile isolation: fresh context per test; storage seeded with one FIXTURE save under
                     daemon-zero.preview.save.v1 (tests/e2e/previewSave.ts)
  start state:       fixture: the 31 states in tests/e2e/routeStates.ts, each played through public
                     engine actions on the preview registry by tests/*-helpers.ts; they stand in for
                     the route specs' played states, not for a natural run
  time:              live clock; the two decrypt cases on a paused, advanced clock
  commands:          make e2e-preview E2E_ARGS=--reporter=line
  observed:          whole preview suite 473 passed, 99 skipped (the 93 phone-layout cases under the
                     desktop project, the phone-only notice's five cases under desktop and one
                     existing phone-only case), 0 failed, 4.3 min; these specs use @playwright/test
                     directly and do not assert on console output
  result:            pass, after the three fixes below
  artifacts:         none committed; traces retained only on failure in ignored test-results/
  limitations:       headless Chromium only; axe decides what a rule engine can from the DOM; the
                     keyboard pass is scripted Tab/Enter/Space, not a screen reader (no NVDA, JAWS,
                     VoiceOver or TalkBack was run); 200% text is a CSS stress, not browser zoom or
                     native font scaling; no physical device, no iOS, no Android emulator; fixtures,
                     not play from a fresh profile
  decision refs:     none
```

## What each check means

| Check | Spec | Pass condition |
|---|---|---|
| axe | `a11y-audit.preview.ts` | No WCAG 2.0/2.1/2.2 A/AA or best-practice violation on the page, nor on any button of the surface scrolled into view and audited alone |
| keyboard | `route-keyboard.preview.ts` | Tab from the top reaches every enabled control of the surface; each shows the 2px `:focus-visible` ring and is not covered at its centre; focus leaves a page surface and stays in a modal; the listed operation works from Enter or Space |
| semantics | `route-semantics.preview.ts` | Buttons named by their visible words; disabled ones `aria-disabled`; disclosures `aria-expanded`; a heading per surface; modals `role=dialog` + `aria-modal`; live status lines; run context beside the phase in a landmark |
| 200% text | `route-text.preview.ts` | Every enabled control reachable, 44px or more, unobstructed; no text run spills its box or the surface; no overlap; no sideways page scroll |
| reduced motion | `route-motion.preview.ts` | No CSS/Web animation, transition or scramble glyph on the surface |
| phone layout | `route-sizes.preview.ts` | At 320x568, 360x640, 390x844: no overflow, no control under 44px on screen, surface inside the one primary scroll with no second vertical scroll, every control reachable |

The new layout detectors were checked against injected defects before they were trusted: a
negative margin on `release-purpose` was reported as an overlap, `white-space: nowrap` on it as a
spill, and a 30px scrolling `release-commitments` as a second vertical scroll (temporary edits,
reverted). The default-motion case proves the reduced-motion decrypt check can fail.

## Results

Every cell is the final run above, on both projects unless the surface is phone-only (phone
layout always runs once, under the phone project, at three sizes). "Fixed" names the defect the
first run found; the cell passed after the fix.

| Surface (state) | axe | keyboard (operation) | semantics | 200% text | reduced motion | phone layout |
|---|---|---|---|---|---|---|
| assignment offered | pass | pass (Enter accepts) | pass | pass | pass | pass |
| requalification offered | pass | pass | pass | pass | pass | pass |
| assessment modal | pass | pass (Enter answers) | pass | pass | pass | pass |
| pilot offer modal | pass | pass (Space stays) | pass | pass | pass | pass |
| deferred offer | pass | pass (Space accepts) | pass | pass | pass | pass |
| pilot allocation dial | pass | pass (Space +10%) | pass (heading not checked, see below) | pass | pass | pass |
| pilot batch complete | pass | pass (Enter submits) | pass | pass | pass | pass |
| batch review finding modal | pass | pass (Enter discloses) | pass | pass | pass | pass |
| batch review warned | pass | pass | pass | pass | pass | pass |
| outage window modal | pass | pass (Enter hands off) | pass | pass | pass | pass |
| restricted standing | pass | pass | pass | pass | pass | pass |
| incident record modal | pass | pass | pass | pass | pass | pass |
| recall announced | pass | pass | pass | pass | pass | pass |
| recall review modal | pass | pass | pass | pass | pass | pass |
| service terms offered | pass | pass (Enter accepts) | pass | pass | pass | pass |
| authorized segment card | pass | pass | pass (heading not checked) | pass | pass | pass |
| service threshold notice | pass | pass (Enter continues) | pass | pass | pass | pass |
| service channel ticket | pass | pass (Enter refers, focus to note heading) | pass | pass | pass | pass |
| waiting ticket notice (phone) | pass | pass (Enter opens CORE) | pass (status line, no heading) | pass | pass | pass |
| channel boundary note | pass | fixed: no `aria-expanded` (Space folds) | fixed: no `aria-expanded` | pass | pass | pass |
| owned rack card | pass | pass | pass (heading not checked) | pass | pass | pass |
| release terms offered | pass | pass (Enter releases) | pass | pass | pass | pass |
| corporate ledger split | pass | pass | pass | pass | pass | pass |
| release boundary note | pass | fixed: no `aria-expanded` (Space folds) | fixed: no `aria-expanded` | pass | pass | pass |
| departure folded | pass | fixed: `aria-expanded` never reached the DOM (Enter opens) | fixed: same | pass | pass | pass |
| departure terms open | fixed: `label-content-name-mismatch` (serious) on `departure-review` | pass (Enter departs) | fixed: `aria-expanded` | pass | pass | pass |
| departed boundary note | pass | fixed: no `aria-expanded` (Enter folds) | fixed: no `aria-expanded` | pass | pass | pass |
| obligation recovery review | pass | pass | pass | pass | pass | pass |
| follow-up record modal | pass | pass | pass | pass | pass | pass |
| reboot with a carried clue | pass | pass (Enter continues) | pass | pass | pass | pass |
| cooperative ending account | pass | pass (Enter opens the start-over confirmation) | pass | pass | pass | pass |

Plus: with reduced motion the provisioned segment's process row shows its full name at once;
with default motion the same row starts with the scramble glyph and is complete a second later.

## Fixes

- `src/ui/DepartureTerms.tsx`: the open review control was named "Hide departure details: ..."
  while showing `[ HIDE DETAILS ]`, splitting the visible words (WCAG 2.5.3). It is now
  `Hide details: <title>`. It passed only `accessibilityState={{ expanded }}`, which React Native
  Web does not write to the DOM; it now also passes `aria-expanded`, as `CardDetails` does. The
  departed boundary note's toggle exposes `aria-expanded` too.
- `src/ui/ReleaseTerms.tsx`, `src/ui/ServiceChannel.tsx`: the boundary notes' `[ KEEP PLAYING ]` /
  `[ SHOW NOTE ]` toggles fold the note in place and now expose `aria-expanded`.
- Mounted tests `tests/ui-departure.spec.ts`, `tests/ui-release.spec.ts` and
  `tests/ui-service-channel.spec.ts` assert each state and label; four of their cases fail
  without the fixes (checked on `594da2e`).

## Left unfixed in shared production UI

- **Widget panel titles and node card titles are not exposed as headings.** `TerminalPane`'s
  `Widget` draws a widget's title, and `NodeTitle` a card's, in the heading style without
  `accessibilityRole="header"`, so a screen reader's heading navigation skips them. This is
  production code that every phase renders; adding the role changes production's accessibility
  tree and may interact with the production axe audit's `heading-order` best-practice rule, so it
  is recorded here rather than changed in an inert PR. The semantics spec does not require a
  heading inside `node-*` or `widget-*` scopes until that is decided.
- No other failure was found in shared production UI on these states: the chrome, tabs, dialog
  modal, threshold notice, reboot screen, ending screen and corporate ledger passed every check.

## Fold note

`tests/e2e/previewSave.ts` is the only file that names the save key. When the overlay folds into
production, `PREVIEW_SAVE` becomes `daemon-zero.save.v1` and the six specs are renamed `*.e2e.ts`;
`route-sizes` then belongs beside `ui-sizes.e2e.ts` in the `sizes` project (it skips under any
project but `preview-phone` today).
