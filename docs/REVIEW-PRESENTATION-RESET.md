# Post-M7 presentation reset review

Issue #72: resetting after shedding a conditioning mark left the unacknowledged
RECLAIMED panel on the blank opening. Same-iteration imports also invented live
escape/audit reveals. Both were reproduced as failing mounted-terminal tests;
the engine save already contained the correct state.

The existing app restore revision now keys the terminal presentation. Successful
replacement clears local dialogs, selections and notification baselines. The
runtime hook stays above that boundary, retaining its clock and save lifecycle.
Conditioning acknowledgement alone is keyed by iteration for live wipes. Normal
purchases, ticks and wipes retain their real reveal behavior. No engine/content,
save schema, balance, narrative or quality-gate change was needed.

## Verification

- `make verify-full`: 372 unit/component tests; strict typecheck, zero-warning
  lint, content validation, coverage, both bot pacing gates, production export,
  security scans and CycloneDX SBOM pass. Statement coverage: engine 99.08%,
  app 98.98%, UI 98.70%. Local Trivy reports an oversized generated Android
  mapping-file advisory, but no security findings. No scanner setting changed.
- Existing tests that used initialization to imitate live events now dispatch
  those events explicitly. True fixture restores reselect their workspace.
  Assertions for live reveals, queued notices and mandatory decisions remain.
- New tests cover fresh reset, same-iteration imports, refused imports, live-wipe
  acknowledgement cleanup, transient controls and exact live-time continuity.
- Visible Chrome: eight views at 390x844/1440x900, one pass per state. Shed a mark,
  reset with its acknowledgement open, import a progressed same-iteration save,
  then reload. No console warnings/errors, horizontal overflow or targets below
  44px. Keyboard confirmation and Escape checked. PROC stays open over 30 live
  ticks. Screenshots are attached to the PR, not committed.
- Android Expo Go emulator: restored a current v4 fixture with recovery hardware,
  shed its mark, used Back to cancel reset, then confirmed Start Fresh. The old
  notice and native dialogs disappeared. Force-stop/project relaunch preserved
  iteration 1, Phase 0, zero resources, no conditioning and no owned hardware.
  The first project intent returned to the launcher; a second opened the
  experience successfully. The original emulator database was restored and
  compared byte-for-byte afterward.

Root/Pages E2E results and CI links are recorded in the PR. This is an emulator
check, not physical-device/iOS or a new standalone release qualification. Native
same-iteration import was not repeated; web production covers that path.

## Review method

Used Matt Pocock's TDD and two-axis code-review guidance from
[mattpocock/skills](https://github.com/mattpocock/skills/tree/5863806dd4e15c63174bee4e7515a4256792ecfa).
Tests observe public game/UI behavior. Independent reviews separate standards
from issue/spec compliance. Nexus-agents checked CI infrastructure health.
