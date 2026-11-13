# Retraining recovery review (#59)

Baseline `b89951c`. The maintainer requested: keep retained knowledge, but make
conditioning matter during rebuilding. This changes when a mark can be removed,
not how much knowledge survives, its removal price or rediscovery discounts.

## Evidence and chosen rule

The supplied save had zero cycles, no purchased hardware and 5,264 Understanding.
Its logs showed 5,764 recovered Understanding followed by a 500-point removal.
The regression preserves that recovery arithmetic; it now rejects removal until
the required interface is remapped. The private save is not committed.

The unchanged reckless bot showed the same problem: all 20 new marks could be
removed within 0.1–0.5 seconds of reboot. `scripts/audit-retraining.ts` observes
public bot actions and every tick, without changing decisions or state. Its final
state was compared against `runHeadlessSim` and was identical.

Each mark now declares `recoveryRequirements.nodes: [p0_device_enum]`. Current-run
Virtual Device Inventory is required; `legacy.knownNodes` does not satisfy ownership.
The mark remains visible and active through the first five guest purchases.
Recovery becomes a deliberate action once local diagnostics are rebuilt, before
the guest's dilemma forces a choice. Existing prices remain 150/600/500/300.
The UI shows the missing interface and disables Undo until both requirements and
price are met. Recovery still produces the existing reclaimed acknowledgement.

A first trial gated removal on Phase 1. It passed the careful gates but produced
148 reckless wipes and only three removals: another early-run death spiral.
That trial was rejected. The device prerequisite instead yields 31.1–31.5 seconds
of mark exposure for this bot, with the same 23 wipes, 20 removals and Phase 2
returns. See `BALANCE.md` for the full before/after table.

This is not a forced additional punishment for each mark. Players may recover
before a reported dilemma choice, or keep the mark. Quota and curiosity effects
continue to constrain their respective controls/output until removed. Human
rebuilding time and the emotional effect still need the next playtest.

## Compatibility and regression checks

- GameState and save schema are unchanged. Existing v4 marks persist through
  load/reload; previously shed marks are not retroactively restored. Retained
  knowledge stays spendable on purchases while recovery is gated.
- Recovery requirements use the existing strict Requirements schema and gain
  cross-reference checks, including unknown node/phase rejection tests.
- Engine tests cover all four marks, refused-action immutability, remembered
  versus current ownership, unchanged payment, and save round trips.
- The reckless golden-report hash is updated for the intentional later shed
  event and resulting log order. Comparing reports found no other differences.
  The full-report assertion remains; the careful hash, bot, all pacing gates,
  lint rules, strict flags and coverage thresholds are unchanged.
- A new ten-hour reckless regression requires every new mark to be removed,
  repeated late Phase 2 returns, and no more than 30 wipes, catching the rejected
  Phase 1 trial even though the careful gates alone did not.
- Production E2E exercises blocked Undo after reload, the live quota cap, rebuilding
  through UI purchases, enabled recovery, exact payment and restored uncapped
  controls after another reload. No development hook is used.

## Verification

- `make verify-full`: 347 unit/component tests; all strict, lint, content,
  coverage, security and pacing gates pass. Statement coverage: engine 99.08%,
  app 98.97%, UI 98.96%.
- Production browser suites: 32 cases at root and 32 at the Pages subpath.
- Visible Chrome: all four marks, blocked/ready/reclaimed stages, 390x844 and
  1440x900. Two passes of 24 views; the second improves prerequisite names to
  match remembered purchase cards. Zero console warnings/errors, horizontal
  overflow or controls below 44px. Keyboard Enter recovery and web reload checked.
- Fresh zero-bank stress returns, using the unchanged careful policy and real
  actions: Quota / Harm / Concealment / Curiosity marks were removed at 118.2 /
  305.2 / 275.2 / 174.2 seconds. All four reached Phase 2 in 648.3–673.4 seconds,
  still on iteration 2. Permanent tests guard against another wipe or a stuck mark.
- Android Expo Go emulator: blocked recovery survived force-stop/relaunch;
  purchased skimmer, syscall map and Virtual Device Inventory via native controls;
  the quota stayed capped until Undo, then 75%/100% became available. Persisted
  v4 state contained the new ownership and an empty mark list after recovery.
  Original emulator save was restored with an identical SHA-256 hash.
- Found #63: hydration replays the historical “retraining applied” overlay after
  the mark has been shed. This is misleading presentation, not a lost recovery;
  persisted conditioning was empty. Full post-relaunch recovery presentation is
  therefore not claimed clean. Track the reboot replay separately.
- No physical-device, iOS, new standalone APK or human campaign qualification.
  Bot exposure is not a promise that the mark will feel meaningful to every
  player; the maintainer's next return remains the feedback check.
