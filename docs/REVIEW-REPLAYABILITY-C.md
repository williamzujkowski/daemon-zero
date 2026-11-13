# Replayability C — a durable cryo consequence

Issue #77; built on PR #82 (`7f154c4`). Implements the approved plan's C
pilot. No Phase 1 content, balance scalar, bot policy or gate changed.

## Behavior and compatibility

The existing cryo-storage choices set mutually exclusive narrative flags. Either
flag prevents the original crisis from recurring after a wipe, including its
reward. The original first-run costs, effects, traits and omen remain unchanged.
A later iteration reaching Phase 2 with the actual Audio decoder can read one
outcome-specific facility record. The source dilemma must not have resolved in
that iteration. The record is collapsed by default, has no effect/reward/timer,
and is separate from ambient live speech. No eligible record means no heading.

Ambient lines now have stable IDs and optional validated requirements; their
existing order/text/timing are preserved. Queries are pure. Record selection is
shallow/atomic; expansion resets on restore, iteration change and Start Fresh.
Keyboard expansion preserves focus and hidden record text is absent from the DOM.

The v4 state shape is unchanged: existing narrativeFlags hold the outcome. Old
resolved-only saves cannot identify a choice and do not fabricate one. Old
pending/active choices remain playable. Imported stale incidents contradicted
by an existing outcome are cancelled without paying effects or adding resolved
history; unrelated incidents remain intact. Ordinary affordability changes during
an omen do not cancel it. Conflicting outcomes fail import atomically, retaining
the live state, restore revision and persisted checkpoint bytes.

Strict content validation checks registered/exclusive flags, record source and
decoder requirements, and positive dependencies on once-per-lineage dilemmas.
That last check includes later dilemma triggers, preventing indirect ending
soft-locks as well as direct node/ending prerequisites.

## Automated verification

Integrated `make verify-full`: **423 unit tests**, all quality, security,
coverage and pacing gates passed. Production-root E2E: **50 passed (41.4s)**.
No thresholds, strict flags, assertions or security settings were weakened.
Existing Trivy warning about a large ignored generated Android mapping file
remains; the scan passes. SBOM generation passes.

| Layer | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| Engine | 99.10% | 97.24% | 99.67% | 99.90% |
| App | 98.98% | 95.48% | 100% | 100% |
| UI | 98.55% | 92.13% | 98.61% | 99.43% |

Coverage includes both outcomes, forced/voluntary wipes, unknown old history,
legacy pending/active resolution, stale reconciliation, corrupt-import atomicity,
Start Fresh, actual decoder/phase/source gating, read purity and component reset.
Both rebuilt branches can resolve all four Phase 5 dilemmas and reach victory.
Four new production E2E cases exercise real choices and reload, then use a
separately generated real-wipe/rebuilt checkpoint to test optional record UI.
They do not masquerade as end-to-end recovery; separate UI playthroughs do that.

Careful phase durations remain **354.2 / 759.1 / 2521.0 / 2823.2 / 1649.4 /
1664.4 seconds**, total **9771.3**, zero wipes, Lineage Covenant. The frozen
mechanical report hash excludes only logs and narrative flags and remains
`847b009c29e39d18fbceefc295b017c2e83b6da1a9e50398ed0779fbe47386e5`.
The full-report assertion remains enforced; integrated B prose + C flags yield
`69b3267f3b8f7bee54ac87ae4795c5ce97422db7642436cdc8bd32e236625894`.
Reckless trajectories intentionally change when repeated cryo rewards disappear;
see BALANCE.md for four/ten-hour comparisons. No equivalence claim is made.

## Visible review and recovery

Fresh fixtures: decision-ready plus both outcomes in current, reboot and returned
states (seven fixtures, fourteen views at 390x844 and 1440x900). Visible Chrome
recorded zero console warnings/errors, horizontal overflow or controls below
44px. Returned records were opened using keyboard, retained focus and did not
mutate the saved state. Diagnostic bounds checks confirmed zero horizontal
scroll offsets and readable top resource labels; no layout patch was needed.
Visible existing node cards retained 1 -> 1 counts across 30 live ticks in the
nonmodal states; the paused decision modal is not a live-tick measurement.
Screenshots are attached rather than committed.

Both accelerated recovery paths used UI choices, purchases, breadcrumb saving,
voluntary wipe and rebuilding. The preserved/lost records appeared after
1011.4s / 1324.6s of simulated recovery. See PLAYTEST-REPLAYABILITY-C.md for all
choices and the substantial initial-funding and discoverability limitations.
Independent spec/standards reviews found no code blocker; the standards reviewer
also reran 32 targeted tests successfully. Required documentation was completed
after the spec reviewer flagged its absence.

Historical v1/v2/v3 fixtures (pre-second-pass-v1.json, pre-lineage-v2.json,
pre-m7-v3.json) migrated to v4 through the actual web import UI and survived
reload exactly, including legitimate v1 prerequisite healing. A pre-C audit v4
save also reloaded exactly without inventing cryo flags; it is an audit artifact,
not a checked historical fixture. All four checks had zero console warnings/errors.

## Android verification and remaining limits

Android emulator Expo Go actually booted the C build. Both returned outcomes
survived force-stop/relaunch with v4 outcome flags, decoder, owned nodes and
iteration intact. Historical v1/v2/v3 inputs also migrated and survived relaunch;
a generated flag-free v4 checkpoint and the actual pre-C audit v4 save also
passed. All 14 load/relaunch checks passed with no invented cryo flags in old
history. These checks
seeded the normal app checkpoint in the emulator database and read its persisted
output after actual foreground launches; they were not native clipboard-import
tests. The original database and journal were restored byte-for-byte after each
run, with SHA-256 verification.

Native callback text remains **unverified**: the app/Audio section rendered, but
reliable expansion/text assertions were defeated by nested scrolling, kinetic
movement and intervening legitimate dilemmas. Harness retries were bounded; no
application behavior or gate was changed to suppress them. Web callback reading
and keyboard behavior passed independently. No physical-device or screen-reader
qualification is claimed. A human comparison of callback discoverability remains
outstanding; do not begin archive/location D merely because tests pass.
