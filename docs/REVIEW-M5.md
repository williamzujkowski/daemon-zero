# M5 verification and remaining device qualification

M5 started from main `a6141cc`, after lineage UI PR #45 merged with green CI.
M6 was not started. Engine behaviour, state shape, content/narrative, balance,
lint rules, TypeScript flags, coverage thresholds and pacing gates are unchanged.
No engine query was added. Tracking issue: #6.

## Production E2E and feel

`make verify-full` passes 251 Vitest tests, coverage, strict typecheck, zero-warning
lint, content validation, pacing simulation, production export, all security scans
and SBOM. `make e2e` passes 14 cases: seven scenarios on each of 390x844 and
1440x900. CI uses both commands without changing workflow permissions.

The suite starts an empty opening and unfolds the first widget and unreadable
audit; focused current-engine fixtures exercise the actual parser purchase,
automatic tick-driven wipe, breadcrumb, second-run table, mandatory dilemma
pause/resume and confirmed save-code round trip. It also checks reduced motion,
accessible numeric meters, production hook/drawer absence and zero browser
console warnings/errors. All selectors are test IDs. Component tests remain
Vitest; no Jest or second component runner was introduced.

Playwright is exact 1.65.0, resolved from the registry. Expo selected haptics
58.0.8 for SDK58, then the dependency was pinned exactly. Purchases invoke native
selection feedback and interrupts warning feedback; unsupported hardware is
optional, and web/reduced-motion modes invoke neither API. Native vibrator
service history records the app's interrupt warning waveform; tactile quality
cannot be felt in an emulator.

Unlock names reveal for 420ms with a complete accessible name throughout.
Cold-owned names and reduced-motion unlocks are immediate. App-owned timers
cancel on background/unmount. A short-lived presentation event bridges the
unowned/owned list remount, without changing saved state. Phase context changes
only accent/border tokens; body/warning/danger colours retain their meanings.
Production save transfer was added because the former code editor existed only
in the excluded development drawer. Import confirms replacement and rejects
malformed codes without losing the current run; endings also permit transfer.

## Visible review

Current fixtures were freshly generated for M5. Headed isolated Chrome through
the pinned MCP reviewed 24 states at 390x844 and 1440x900: the guest and lineage
sets, Phase 1 widgets, Phase 2 entry, AEGIS near 90, corporate insolvency,
megawatt shortfall, victory-ready, evaluation-ready and Shipped. It exercised
mobile tabs, parser/table reveals, reclamation, save transfer/confirmation and
evaluation. Review artifacts remain outside the repository and final screenshots
are attached to the PR.

Pass 1 found an empty-string React Native Web warning in save transfer; explicit
conditional rendering fixed it. The harness also needed to inspect the save
modal instead of controls underneath it, and acknowledge the top discovery
modal before a simultaneous fixture phase preview. These were review-controller
corrections. The final pass checks unlock gating, overflow/fit, named controls
of at least 44px, keyboard reachability, numeric meters, and zero console
warnings/errors. Pass 2 completed all 48 fixture/viewport pairs with zero console warnings/errors
and no unresolved review findings. Two passes were used; no third was needed.

## Screen readers

Orca ran against visible Chrome with AT-SPI enabled. Its speech-dispatcher debug
output confirmed spoken control names/roles, phase status, numeric progress-bar
values, warnings and authored text while the keyboard review traversed the app.
This is actual screen-reader output, not an accessibility-tree-only claim.

TalkBack 16 ran on API36 Android Expo Go. Touch exploration was bound, the
service had an offline en-US voice, and its focus highlight traversed the paused
dilemma text. Keyboard Tab reached the named free choice, scrolled it into view,
and Enter committed it; the modal disappeared and the game clock resumed.
Screenshots show the focused choice and the resumed terminal. The existing
unaffordable choice remained disabled and labelled; the audit stayed unreadable.
The first-run OS notification permission dialog was handled before app checks.
UIAutomator can temporarily suppress/rebind TalkBack, so final focus/activation
evidence uses screenshots captured before hierarchy inspection.

These are agent-operated reader checks, not an unbriefed user's accessibility
study or an assessment of audible voice quality. iOS VoiceOver was not tested.
Native data and accessibility settings are restored after the review.

## Rendering and input

React Profiler wraps static identity/description content, with changing cost,
balance and permission leaves outside it. After preferences and imports settled,
100 real timer callbacks (10 simulated seconds) produced these headed-web results:

| Fixture | Card parent render counts | Static-content profiler commits | Cycles before → after |
|---|---|---|---|
| Phase 1 widgets, 14 cards | Each 1 → 1 | Each 2 → 2 | 102 → 277 |
| Victory-ready Phase 4, 20 cards | Each 1 → 1 | Each 2 → 2 | 999999923412338 → 999999927034100 |

The two initial static commits include motion-preference resolution. No further
card/static commits occur on ticks; balance/eligibility leaves continue updating.
An initial measurement installed the browser clock after runtime timers existed
and showed no time progress, so it was discarded. The valid measurement installed
the clock before navigation and confirmed both advancing time and balances.

Android Expo Go on the Pixel7 API36 x86_64 emulator accepted **40 of 40** injected
manual taps in late Phase 4. The development drawer's accepted/attempted counters
are separate from engine state. Android gfxinfo for that development/emulated
sample reported 99 frames, 65.66% janky (16.16% legacy), median 16ms, p90 26ms,
p95 32ms, p99 133ms. These numbers do not establish smooth performance.

**Still unverified:** no physical mid-range Android device is attached. The
milestone's physical-device input/performance qualification remains open in #6;
the emulator is not substituted for it. No signed native release build or
physical haptic quality was tested. No new pacing/content/design finding was
established, so no second-pass issue was filed in M5.
