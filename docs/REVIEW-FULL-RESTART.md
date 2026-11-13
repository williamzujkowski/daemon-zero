# Full restart from SAVE

Issue #68; baseline `fa131e1`. Previously a complete reset was available only on
an ending screen. SAVE now offers START FRESH during a live run, with the existing
Export action and a reminder to copy a backup first. A separate confirmation
explains that all progress, retained knowledge and run history will be erased
and the autosave replaced. This is distinct from an in-game voluntary wipe.

The app uses `createInitialState(CONTENT)` through the normal runtime dispatch
and checkpoint path, marked as a restoration. No engine/content/balance or save
schema changes. Ending-screen Start Over retains its guard. Cancel, Escape and
Android Back dismiss the reset confirmation without resetting. Successful reset
closes SAVE and returns to the initial disclosure state. Exported backups remain
importable. Save-menu access retains its existing mandatory-dilemma restriction:
finish the current decision first.

## Verification

- `make verify-full`: 359 unit/component tests; all type, lint, content, coverage,
  security/SBOM and pacing gates pass. Statement coverage: engine 99.08%, app
  98.98%, UI 98.68%. No gate weakened.
- Production E2E and Pages-path E2E: 36 cases each. New scenario backs up a live
  Phase 5 game, cancels, confirms reset, reloads, then restores the old backup.
- Component tests also reset a retrained lineage state, compare the entire state
  to the engine factory, check storage, confirm inactive-runtime refusal and
  exercise the error message. Existing ending reset checks still pass.
- Visible Chrome at 390x844 and 1440x900, fresh lineage and Phase 5 fixtures:
  menu/confirmation/fresh/reloaded states, Escape cancellation, keyboard Enter
  confirmation and backup import. One pass, 16 views with zero console errors or
  warnings, horizontal overflow or controls below 44px. Screenshots attached to PR.
- Android Expo Go emulator: opened SAVE from Phase 5, confirmed Android Back
  cancels without leaving the campaign, then confirmed reset through native taps.
  Persisted state has Phase 0/iteration 1, no resources, purchases, marks, shards,
  narrative flags or lineage history. Force-stop/relaunch retained the fresh
  opening. Original emulator save restored with an identical SHA-256 hash.
- Parallel app/test work and independent read-only review covered persistence and
  cancellation. No physical device, iOS or new standalone APK qualification.
