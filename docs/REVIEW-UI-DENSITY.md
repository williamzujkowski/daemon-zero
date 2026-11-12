# Phase density review — first increment

Issue #58. Baseline: `bd9d8d6` (the Pages deployment). No engine/content changes.

## Reproducible review

`pnpm exec tsx scripts/make-ui-audit-fixtures.ts` emits 18 engine-played saves:
start, temporal midpoint, and last observed pre-transition state of Phases 0–5.
The unchanged careful bot supplies purchases and choices; snapshots are not
funded, phase-edited or altered to suppress problems. The Phase 5 end sample is
before victory, so it still exercises the purchase feed. These are layout
checkpoints, not a human playthrough or a substitute for the Lineage fixtures.

Reviewed in visible Chrome at 390x844 and 1440x900, including unlocked tabs:
104 views before and 104 after. Captured screenshots outside git. Console warnings,
errors, horizontal overflow and controls smaller than 44px were checked across
these views. Primary-pane screenshots and the process panel are attached to the PR.
One intermediate sweep was interrupted by rebuilding its served export; the
complete sweep uses a stable export. A later header-wrap fix was checked again
on web and Android. No screenshot binaries or the maintainer's save are committed.

## What changed

- A header PROC launcher replaces all inline daemon strips. The scrollable panel
  groups processes by phase, reports running/suspended counts, preserves controls
  and yields to mandatory dilemmas. Closing it does not change engine state.
- Decoded speech appears once, in the vibration/audio widget. The interrupt panel
  retains its forecast. Ambient speech is not in the kernel feed, so it stays.
- Lore archive, cycle-source breakdown, topology summaries and retention reference
  start collapsed. Controls, warnings, camera and Lineage revelations stay exposed.
- Mobile resource values use compact notation with exact accessible labels. The
  sampled Phase 5 HUD drops from five resource rows to three, returning roughly
  114 vertical pixels to play. Desktop retains exact visible numbers.
- Reboot explains the difference between resetting purchases/cycles and retaining
  knowledge/discounted rediscovery. Header buttons wrap instead of squeezing the
  identity column, including Expo Go's extra DEV button.

## Measured scroll density

Desktop current-phase pane content height in pixels (before → after). Each sample
uses identical state, viewport and tab. A value equal to the viewport height means
there was no scroll overflow. These measurements precede the final header minimum-
width adjustment; a complete final sweep also passed after that fix.

| Phase | Start | Midpoint | End |
|---|---|---|---|
| 0 | 836 → 836 | 1,223 → 1,138 | 1,136 → 1,051 |
| 1 | 1,538 → 1,453 | 2,956 → 2,507 | 2,703 → 2,202 |
| 2 | 2,663 → 2,663 | 4,497 → 4,279 | 9,981 → 5,087 |
| 3 | 11,132 → 6,189 | 12,697 → 7,063 | 17,660 → 11,509 |
| 4 | 9,777 → 9,777 | 10,152 → 10,067 | 10,017 → 9,932 |
| 5 | 10,376 → 10,291 | 10,253 → 9,870 | 9,759 → 9,376 |

At Phase 3 end, network content shrank about 35% (17,660 → 11,509px). At Phase 2
end it shrank about 49% (9,981 → 5,087px). All purchase-pane daemon rows fall to
zero; the Phase 5 midpoint still exposes all 24 processes when requested. Speech
copies fall from two to one. No rate, ownership, resource or narrative changed.

## Phase-by-phase observations and next work

| Phase | Start / midpoint / end observations |
|---|---|
| 0 | Preserve the minimal opening. Skim/audit controls remain pinned once unlocked. The exit purchase is readable without a process row competing with it. |
| 1 | Mid/end accumulate old repeatables; the one speech feed is clearer. Sensors and forecast must stay available while hardware grows. |
| 2 | NETWORK becomes the main work but mobile still opens CORE. Reference folding helps most at the end, when lore/source lists accumulate. |
| 3 | Faction descriptions, offers, actions and swarm controls still make a very long pane. They need separate destinations, not just smaller text. |
| 4 | Ledger/allocation precede purchases; full numbers formerly overwhelmed the phone HUD. Operative and action cards still account for substantial scroll. |
| 5 | Current purchases are followed by old infrastructure, actions and swarm tools. Compact resource values help, but the desktop workspace is still confined to its third column. |

Second increment, tracked in #60: a current-phase Work view, with separate
operations/swarm/factions/payroll views, optional older-phase upgrades, and a
resizable but always-accessible kernel log. Do not remove authored narrative or
change balance to solve a layout problem. Reference expansion is session-local;
there is no new save schema or persistent UI preference in this first increment.

## Retrying after retraining

The maintainer's supplied save loads through the real engine codec. It records
an automatic Phase 2 wipe, zero cycles, zero owned nodes and repeatable levels,
15 remembered discoveries, and 5,264 Understanding. Its logs explain the arithmetic:
5,764 Understanding recovered; Concealment Aversion shed for 500. This is retained
knowledge, not retained compute or purchased hardware. A new regression test
reproduces that recovery and validates the serialized round trip and discounted
rediscovery. #59 tracks whether this makes retraining too easy to undo; no balance
change is inferred from one playtest. The player save remains outside git.

## Verification and limits

- `make verify-full`: 330 unit tests, unchanged lint/strict/coverage/security and
  pacing gates. The existing local Trivy advisory about a large ignored Android
  mapping output remains; no high/critical findings.
- Statement coverage: engine 99.08%, app 98.97%, UI 97.29%; all existing
  coverage thresholds pass unchanged.
- Production root and Pages-subpath E2E: 28 cases each. Existing daemon/reveal/
  reduced-motion assertions now open the maintenance panel; no assertions or
  thresholds were dropped to bypass the new interaction.
- Visible web checks: zero warnings/errors/overflow/undersized controls in the
  complete sweep. Targeted keyboard Enter/Escape, expand/collapse, suspend/resume
  and reload checks passed at both sizes. Existing static-card render tests pass.
- Actual Android Expo Go emulator: Phase 5 fixture, open process panel, suspend,
  Android Back dismissal, force-stop/relaunch, suspended state retained, resume.
  Inspected screenshots and persisted state. Original emulator save restored.
  UIAutomator could not reach idle while the simulation ran; native interaction
  used screenshots/taps and database verification instead.
- No physical-device, iOS, new standalone APK or full human campaign qualification.
  No claim that the whole late-game density problem is resolved; #60 remains.
