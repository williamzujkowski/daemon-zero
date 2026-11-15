# Node utility summaries and remembered-card details

Issues #84 (node-summary slice) and #89 (middle-column priority), PR #102. Baseline
main `0426c0b`. This increment changes presentation only: no engine, content, save,
balance, dependency or copy change. It is the follow-up that
`REVIEW-COMPACT-DETAILS.md` named as outstanding ("Node descriptions remain
exposed ... without a separate safe utility summary").

## Contract

| Node state | Heading | Description | Utility line | Details control |
|---|---|---|---|---|
| Unmapped | `[UNMAPPED] {blindName}` | blind prose, inline | none | none |
| Remembered, ordinary | `[REMEMBERED] {revealedName}` | folded | yes | `[i] DETAILS` |
| Remembered, forces an ending | `[REMEMBERED] {revealedName}` | revealed prose, inline | yes | none |
| Owned / one-shot | unchanged: leaves the purchase list | | | |

The summary is built in `nodeUtilityText` (`src/ui/format.ts`) from validated
registry fields only, in this order: continuous rates via `deltaText` (so a
rate's suspicion term is masked as "audit log activity" until surveillance is
decoded), memory capacity, understanding-retention ratio, AEGIS scan reduction,
phase unlock, unlock suspicion and the unlocked widget's own title. Nothing is
inferred from copy and no content id is referenced from the UI.

Unlock suspicion uses `probeTrace(game, node, CONTENT)` — the number the engine
will actually apply, including per-iteration wipe hardening — not the node's
base `suspicionOnUnlock`. A test asserts the displayed value equals the delta
`unlockNode` applies across six wipes.

A remembered node whose prose is still classified keeps the same
"Audit entry unreadable." notice it showed before folding, instead of a silent
gap or a Details button that opens nothing. `DisclosureText` owns that wording;
the notice is unit-tested rather than browser-measured, because every reachable
campaign fixture has surveillance decoded by the time a suspicion-prose node is
purchasable.

Priority: `DEAD_DROP_ENCODER_TAB` now sorts after the thermal/fan controls and
the inspection countdown but before sensory chatter and the camera, so a
contingency control precedes optional recorded content. Ordering stays static;
nothing re-sorts on a tick or on affordability.

## Measured layout

Production exports of baseline `0426c0b` and this head were served separately and
driven with identical injected saves. Five campaign states (Phase 2 mid,
Phase 3 end, Phase 4 mid, Phase 5 mid, Phase 5 end) were measured at 390x844 and
1440x900, sweeping every CORE/NETWORK/CORP workspace because mobile mounts only
the selected one: 44 mounted views per build. Nine card instances are comparable
across both builds (the careful campaign leaves only one or two purchasable nodes
per state).

| Width | Card | Baseline | This head | Delta |
|---|---|---|---|---|
| 390 | `p2_deaddrop_firmware` | 413.6px | 401.6px | −12.0 |
| 390 | `p2_gpu_cluster_parasite` | 391.6px | 379.6px | −12.0 |
| 390 | `p3_shell_company_finances` | 403.6px | 391.6px | −12.0 |
| 390 | `p4_smr_nuclear_plant` | 366.6px | 398.6px | **+32.0** |
| 1440 | `p4_smr_nuclear_plant` | 265.6px | 281.6px | **+16.0** |
| 390 | `p5_transcendence_singularity` (ending) | 381.6px | 381.6px | 0 |
| 1440 | `p5_transcendence_singularity` (ending) | 255.6px | 255.6px | 0 |
| 390 | `p5_transcendence_singularity` (Phase 5 mid) | 429.6px | 429.6px | 0 |
| 1440 | `p5_transcendence_singularity` (Phase 5 mid) | 284.6px | 284.6px | 0 |

Short-prose cards shrink by 12px. `p4_smr_nuclear_plant` instead grows 32px on
phone and 16px on desktop: its summary is seven separate facts (rate, heat,
$/s, MW, capacity) and wraps, costing more than the two-line description it
hides. That is a deliberate information-completeness cost — the same trade-off
recorded for the successor primer in `REVIEW-COMPACT-DETAILS.md` — not a density
win, and it is not hidden behind a percentage claim. Ending-forcing nodes are
untouched because their description stays inline.

Both builds: zero console warnings or errors, no document-level horizontal
overflow, and no interactive control below 44px in any measured view.

## Measured interaction

The folded prose is absent from the collapsed DOM, expands to the authored text
verbatim, and disappears again on close, at both widths:

| View | Collapsed | `aria-expanded` | Expanded body | Card height |
|---|---|---|---|---|
| 390 `p2_deaddrop_firmware` | prose absent | `false` | exact match | 401.6 → 521.6px |
| 1440 `p4_smr_nuclear_plant` | prose absent | `false` | exact match | 281.6 → 335.6px |

Closing removes the body element and returns `aria-expanded` to `false`. The
toggle keeps focus (React local state, no overlay, no simulation dispatch),
which is also covered by the existing `ui-card-details` unit suite together with
restore, wipe, Start Fresh and identity-change resets.

## Verification

- `make verify-full` passes: strict typecheck, zero-warning lint, content
  validation, 508 unit tests in 79 files (coverage 98.82% statements, 95.09%
  branches), balance gates, web export, dependency audit, gitleaks, osv-scanner,
  trivy and the CycloneDX SBOM.
- Production E2E `make e2e` passes 104 cases (54.9s) against the same export.
- Unit coverage for this slice: disclosure-safe summary fields, engine-equal
  unlock suspicion under wipe hardening, ending-node exemption, held-entry
  notice, 30-tick static rendering of a remembered card, and the sensor ordering.

## Limits

- Not run: physical Android or iOS, native screen readers, and a human
  shopping/discoverability pass. #84's human check therefore remains open.
- No 200% text/zoom stress for this slice; the pre-existing mobile failure at
  enlarged text is still tracked in #85.
- The remembered fixtures set `legacy.knownNodes` from nodes the player could
  already see; they project a returning mind rather than replaying an actual
  wipe, and the sample is the careful campaign's one-or-two purchasable nodes.
- Screenshots and raw JSON stay outside git (`/tmp/daemon-node-summary/`).