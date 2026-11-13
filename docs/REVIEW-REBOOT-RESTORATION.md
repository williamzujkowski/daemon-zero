# Reboot restoration and current conditioning

Issue #63; baseline `be7085b`. A restored save replayed the last run's historical
mark as RETRAINING APPLIED even after the mark was shed. The active mark list was
correct; this was misleading presentation.

The overlay now labels restored checkpoints and imports RESTORED CHECKPOINT.
Actual live iteration changes still show REBOOT and preserve the breadcrumb.
Conditioning rows come from current active marks, including marks carried from
older incidents. Restored/carried marks say CURRENT RETRAINING. Only a new mark
recorded by a live wipe says RETRAINING APPLIED. Shed marks never render there.

A local app `restoreRevision` distinguishes save replacement from a live wipe.
Initialization and successful imports increment it; failed or inactive imports,
ordinary actions and ticks do not. Same-iteration imports reopen restored context.
It is never serialized. GameState, schema v4, engine behavior, content and balance
are unchanged, as are runtime checkpointing and the validated save codec.

## Review and verification

- Work was split by directory: app restoration identity, tests, and UI; an
  independent read-only review checked hydrate/import/live-wipe edge cases.
- A nexus-agents quick consensus advisory identified import ambiguity. Its single
  completed reviewer approved the proposal, but two providers failed (quota and
  circuit breaker), so the panel returned **no quorum**, not consensus approval.
  The import edge case was implemented and independently tested afterward.
- `make verify-full`: 356 unit/component tests, strict/lint/content/security/SBOM
  and pacing gates pass. Statement coverage: engine 99.08%, app 98.97%, UI 98.66%.
- Production E2E and Pages-path E2E: 34 cases each.
- Production E2E checks recovery and reload before dismissing the restored overlay:
  active marks are current, and recovered marks remain absent. Existing forced
  tick-wipe and confirmed voluntary-wipe tests retain breadcrumb coverage.
- Fresh fixture saves were generated with engine actions. Visible Chrome at
  390x844 and 1440x900 covered active, recovered, voluntary-carried and live
  voluntary states, keyboard acknowledgement, reload, and same-iteration import.
  One pass, 18 views: zero console warnings/errors, horizontal overflow or touch
  targets under 44px. Final screenshots are attached to the PR, not committed.
- Android Expo Go emulator: recovered v4 state displayed RESTORED CHECKPOINT
  without a conditioning panel, including after force-stop/relaunch. Native
  persisted state still had `conditioning: []`. An active-mark save displayed
  CURRENT RETRAINING, with no RETRAINING APPLIED text. The original emulator
  database was restored and its SHA-256 verified identical.
- No physical-device/iOS/new standalone APK qualification or fresh human campaign
  is claimed. The existing #6 qualification remains open.

## Remaining pacing feedback

The independent read-only review confirmed #21/#23 already have content fixes:
75s/900-cycle Whistleblower preparation and a 6,500-cycle network interface.
An unchanged careful-bot observation found the omen at 647.3s, decision at 722.3s
with 1,988.1 cycles, and camera-to-network interval 308.0s. These are automated
measurements, not a substitute for a new maintainer playthrough. Both issues stay
open; no further balance tuning is included in this fix.
