# M7 PR 1 — engine and content review

Tracking issue #50. Baseline: clean main `89adc63`, frozen install,
`make verify-full`, 262 unit tests and 16 production E2E cases passed before
branching. This PR supplies schema v4, seven epistemic actions, two forkable
cohort templates, four wild encounters and their templates, four quirks and three
dilemmas. Phase 4 still ends at orbit; Phase 5 is PR 2.

## Semantics and compatibility

- All new mechanics are declarative. Costs, outputs, drift thresholds, encounter
  cadence, command prices, narrative flags and messages live in content.
- New live-only pipeline stages integrate discrepancies and mutate/schedule
  shards. Resource output joins computeRates and the source ledger, retaining
  brownout, grid, finance and dormant semantics. No clocks or randomness added.
- Shared action queries enforce caps, reciprocal exclusions and discounted
  oldest-mark recovery. Counts/effects reset with a run; story flags persist.
- The existing action panel hides capped edits and undisclosed epistemic actions,
  uses the computed price, and isolates cooldown text from the static card.
  This is compatibility work, not the dedicated PR 3 panel implementation.
- Existing migrations remain unchanged in save.ts. SCHEMA_VERSION in state.ts
  advances from 3 to 4. New defaults include the requested fields, plus action
  purchase counts and temporary-effect expiry maps. Reconciliation removes stale
  content references and releases removed cohorts' reserved memory.
- Existing balance values, dependencies, strict flags, lint rules, coverage floors,
  security tooling and pacing gates are unchanged. The bot's sole code change
  passes the registry into shared node eligibility; its strategy is unchanged.

## Automated verification

`make verify-full` and `make e2e` passed with **296 unit tests and 16 E2E cases**.
The new swarm tick module has **100% branch coverage (24/24)**. New integrity and
migration-healing modules also have 100% branch coverage. Tests cover threshold
boundaries, refusals without spending, immutability, dormant freezing, all new
dilemma choices, reciprocal exclusions, capped hiding and retained benefits.

Careful Phase 0/1/2/3/4 durations: **354.2 / 759.1 / 2503.0 / 2937.8 / 1805.9
seconds**, **8360.0 seconds** total, Sovereign Monolith, **zero wipes**. Reckless:
**23 wipes** within the unchanged budget. The bot uses the new actions through
its existing scoring; shard-command strategy and Phase 5 gates remain PR 2.

Security scans and SBOM generation passed. Trivy emitted an advisory about an
existing ignored Android mapping artifact's size. E2E Node workers emitted the
host's conflicting colour-environment warning. No application/browser console
warning or error occurred in the migration checks or production E2E suite.

## Historical saves on actual runtimes

The committed fixtures document their provenance: v1 from pre-second-pass
`a11c35f`, v2 from pre-lineage `aa290f8`, and v3 from the pre-M7 engine at
`866d280` (unchanged in `89adc63`). They enter the ordinary app storage envelope;
no production hook is introduced.

- Production web in visible Chrome: all three loaded, rewrote their engine save
  to v4 and survived reload with owned hardware and new defaults intact. The v1
  sample kept its unreadable audit; v2/v3 retained their decoded meter. Browser
  consoles were empty. Screenshots attached to the PR, not committed.
- Android API 36 emulator, Expo Go: all three loaded and survived force-stop and
  relaunch. Persisted database snapshots confirmed v4, owned nodes, conditioning,
  ending and default M7 fields. Screenshots confirmed the actual game booted.
  The original native database was backed up and restored after verification.

## Limits and remaining scope

No claim of new panel UX, Phase 5, shard roster render counts, expanded production
M7 E2E, or a full M7 UI playthrough: these belong to PRs 2/3. No physical-device,
iOS or standalone native release build was run for this PR. Existing physical
Android qualification issue #6 remains open. No pacing gate was weakened and no
new pacing/content issue was identified during this engine-focused pass.
