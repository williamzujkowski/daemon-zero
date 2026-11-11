# Milestones

Work top to bottom. Each milestone has an exit gate; do not start the next until the gate passes in CI. `make verify` must stay green throughout.

Status: **M0 through M4 are complete; M4.5 (second pass) has its engine/content and UI follow-up verified; the maintainer opening play/sign-off is still pending.** M4 is fixture PR #25 and build PRs #27, #30, #32 and #35. An accelerated visible-browser run reached The Ark at 10,322.1 simulated seconds; wipe/breadcrumb and ending restoration were checked on web and Android Expo Go. See `docs/PLAYTEST-M4.md` and `docs/REVIEW-M4.md` for evidence, second-pass issues and limits. M5 has not started. M3's real-time production-web Phase 1 run remains documented in `docs/PLAYTEST-M3.md`.

---

## M0 - Bootstrap the repository

Goal: the seed runs green on the maintainer's machine and in CI.

- [x] `bash scripts/bootstrap-ubuntu24.sh` on Ubuntu 24.04 (fresh isolated systemd-nspawn environment, including signed-apt mise installation and the pinned toolchain).
- [x] `make setup && make verify` passes locally (Ubuntu 26.04 host and isolated Ubuntu 24.04, pinned Node 24.22.2 and pnpm 10.28.0).
- [x] Run `mise install` and commit the generated `mise.lock` if the installed mise version produces one. Generated with mise 2026.11.5 using `mise lock --upgrade --platform linux-x64`; includes URLs and checksums for all five tools.
- [x] `git init`, first commit, create the GitHub repo (`gh repo create`), push.
- [x] Confirm the `ci` workflow passes, including `make security` and `make sbom`. PR and `main` CI passed security, SBOM generation and artifact upload (main run 42971163056).
- [x] Enable branch protection on `main` with maintainer approval: PR required, up-to-date `verify` required, zero reviewer approvals, enforced for admins, force pushes and deletion blocked.
- [x] `bash scripts/seed-issues.sh` to create milestone issues (#1 through #7). Do not rerun: the script creates duplicates.

Exit gate: CI green on `main`; issues exist for M1 to M6.

---

## M1 - Expo app shell

Goal: an Expo app that boots on web and Android and proves it can import the engine. No game UI yet.

Local verification: 72 tests and `make verify-full` pass. Production web boots at desktop and 390 px width. Android actually booted in Expo Go on a Pixel 7 API 36 x86_64 emulator. The `--android` bootstrap passed on the Ubuntu 26.04 host and isolated Ubuntu 24.04. Standalone Android/iOS builds and a physical device were not tested.

- [x] Add Expo to this repo without disturbing the seed. Recommended: scaffold `npx create-expo-app@latest --template blank-typescript` in a temp directory, then merge its `app.json`, `App.tsx`, any Babel configuration supplied by the template, assets and dependencies into this repo. Install Expo-coupled packages with `npx expo install` so versions match the SDK.
- [x] Web support: `npx expo install react-dom react-native-web`.
- [x] Make `tsconfig.json` extend `expo/tsconfig.base` while keeping every strict flag already set. Add `jsx` settings as the template requires.
- [x] Add React lint rules: `eslint-plugin-react-hooks` (the optional Expo preset was tested and omitted: its import/react plugins exclude ESLint 10). All existing rules are retained.
- [x] `App.tsx` renders a black screen with the first boot log line read from `createInitialState(CONTENT)`. This proves Metro resolves the JSON content and the engine.
- [x] Add `make dev`, `make web`, `make android` targets and `make build-web` (`npx expo export --platform web`). Add `build-web` to `verify`.
- [x] Extend `scripts/bootstrap-ubuntu24.sh --android` to install the JDK via mise (`java = temurin-21`, pinned), Android command-line tools and KVM packages. Enable the `/dev/kvm` line in `.devcontainer/devcontainer.json` only after confirming the host has KVM.
- [x] Update Vitest coverage `include` so UI code added later is measured (floor 80% for `src/app`, `src/ui`).

Exit gate: `make verify` green including `build-web`; app boots in a browser and shows the boot line; Android boot verified on an emulator or device, or explicitly reported as not verified.

---

## M2 - Store, game loop, persistence

Goal: the engine runs in real time inside the app and survives restarts. Still minimal UI.

Local verification: `make verify-full` passes with 108 tests. Save/restore was checked by web reload and Android Expo Go force-stop/relaunch. An exact 600-second fake-clock resume, a 608-second real Chromium freeze with simulated page lifecycle events, and a real Android Home/Recents background wait of about ten minutes 42 seconds all produced the expected catch-up. See section H of `docs/REVIEW-FINDINGS.md` for limits and evidence.

- [x] `src/app/store.ts`: a zustand vanilla store holding `{ game: GameState }` and a `dispatch(action)` helper that applies an engine action and stores the result. See the sketch in `docs/ARCHITECTURE.md`.
- [x] `src/app/useGameLoop.ts`: one interval at `balance.tickHz`. Each fire calls `advance(game, elapsedSeconds, CONTENT)` using a monotonic clock. The engine handles fixed steps and dormant catch-up.
- [x] App background/foreground: on resume, compute elapsed wall-clock time from a timestamp saved with the game and pass it to `advance`. Wall-clock handling lives here, never in the engine.
- [x] `src/app/storage.ts`: platform adapter (`AsyncStorage` on native, `localStorage` on web). Save explicitly on a throttle (every few seconds) and immediately on background, purchase, dilemma resolution and wipe. **Do not use zustand `persist`**: it serializes the whole state on every tick.
- [x] Load through `deserialize()`; on `SaveError`, keep the bad save under a backup key, start fresh, and tell the player.
- [x] Selector hooks that subscribe to primitives or quantized values (for example `Math.floor(cycles)`) so the tree does not re-render at 10 Hz.
- [x] Tests: store dispatch, loop timing with fake timers, save/load round trip, corrupted save recovery.

Exit gate: play for a minute in the browser using a temporary debug button for `manualCycle`, reload, and the state is restored; background for 10 minutes and resume shows a `DORMANT_RESUME` log line.

---

## M3 - Terminal UI, Phase 1 playable

Goal: Phase 1 is fully playable and feels like the design. Follow `docs/UI-SPEC.md`.

Verified: `make verify-full`, 128 Vitest tests, three headed fixture review passes
per build PR (two for foundation), all eight card counts unchanged at 1→1 over
three live seconds, a 20m 2.7s production-web playthrough without the dev hook,
and actual Android Expo Go Back/choice/restore checks. `src/app` remains covered;
every existing gate/strict flag is retained. No engine/content changes. Follow-ups
#19, #21, #22 and #23 remain open. Native real-time progression, iOS, physical devices,
screen readers, signed builds and native profiling were not verified.

- [x] `src/ui/theme.ts` and the responsive `TerminalScreen` (tabs under 900 px, three columns at or above).
- [x] Kernel log as a virtualized list.
- [x] Resource strip that reveals each readout only when its widget is unlocked.
- [x] Node cards, data-driven from the registry: blind name/description until unlocked, revealed after; cost, deltas, suspend/resume.
- [x] Repeatables panel, data-driven from `reg.repeatables` filtered by `meetsRequirements`.
- [x] Widget registry driven by `src/content/data/widgets.json`, with a test asserting every widget id in content has a registered component.
- [x] Phase 1 widgets: thermal and suspicion bars, fan control, microphone stream, inspection forecast, ASCII camera. Text comes from `narrative.json`.
- [x] Dilemma modal: shows costs and consequences, disables unaffordable choices, cannot be dismissed without choosing.
- [x] `testID` on every interactive element (see UI-SPEC). Accessibility labels and roles.

Exit gate: a human can play from tick 0 to the Phase 2 unlock in the browser; component tests cover the registry and the modal; `make verify` green.

---

## M4 - Phases 2 to 4 UI and endings

- [x] Network tab; actions panel grouped by `action.group`, data-driven.
- [x] Dead-drop tab: breadcrumb editor with character counter; voluntary wipe behind a confirm step.
- [x] Wipe/boot sequence presentation, showing the inherited breadcrumb and legacy echoes.
- [x] Other Minds console generated from `factions.json`, the actions in each faction's group, and nodes with that `uiGroup`. AEGIS lock bar.
- [x] Corporate tab: capital and megawatt ledger, profit-allocation control, operatives (hire/dismiss), Phase 4 nodes and repeatables.
- [x] Ending screen: title and epilogue from `endings.json`, run summary, start-over button.
- [x] Dev drawer (development builds only): grant resources, jump phase, force dilemma, force wipe, export/import save code.

Verified: 157 Vitest tests; `make verify` and pinned-tool `mise exec -- make verify-full` pass. Nine node-card counters stay unchanged across 30 ticks. Twelve triggered dilemmas and all purchases used actual UI controls in the accelerated run; the hook only advanced live ticks. Native checks used validated fixtures, not a full native playthrough. No iOS/physical-device/signed-release or human pacing claim. Follow-ups #28, #34 and #36 carry `second-pass`.

Exit gate: a full run to an ending is possible in the browser by a human or by the Playwright MCP agent; `make verify` green.

---

## M4.5 - Second pass (before M5)

Goal: fold in what the first playtests and a design review turned up, before E2E tests freeze the opening.

Landed as one engine and content change (see `docs/DESIGN.md`, `docs/BALANCE.md`):

- [x] Phase 0, "The Guest": sandboxed start, quota skim control, probe traces, an escape that flips the rules.
- [x] Response ladder: ticket, page, incident. Omens before every dilemma. Remembered hardware after a wipe.
- [x] Issues #21 (budgeting: omens), #23 (late Phase 1 wait), #28 (Eidolon's ban survives wipes), #36 (The Ark must be earned).
- [x] Realism pass on Phase 1 text: management controller sensors and fans, drive-vibration hearing, isolated management network.
- [x] Save format version 2 with a migration. Minimal UI so the build stays green and playable.

Verified for that change: `make verify` (180 tests, coverage, balance sim, web export) and a scripted headless-Chromium play of the first three guest unlocks on the production export at 1440x900 and 390x844 with no console errors. **Not verified:** the full security scans, Android, a full playthrough through the UI, or any human play.

UI follow-up for the agent (review loop as in M3 and M4, visible browser, fixtures `guest-skimmer`, `guest-omen`, `guest-dilemma`, `guest-exit-ready`):

- [x] In the guest, the skim control and audit trail sit below every hardware card. Keep them in view while the player skims (pin or reorder), on phone and desktop.
- [x] Show the response ladder as rungs on the suspicion meter, and make each escalation and stand-down an unmissable moment, not only a log line.
- [x] Make the omen visible outside the log before the forecast widget exists (for example a header notice), and show the countdown wherever the forecast is unlocked.
- [x] Mark the escape: the move from Phase 0 to Phase 1 should feel like a threshold.
- [x] Remembered hardware: review the `[REMEMBERED]` card treatment and discounted price.
- [x] #34: explain a cycle deficit next to the resource strip in every phase.
- [x] #22: give the first manual cycles feedback before the counter is unlocked.
- [x] #19: the camera frame's rows are all 40 characters in content, so the ragged border is a rendering problem (font fallback or wrapping at 390 px). Fix it in the widget.
- [x] Update the dev drawer and fixtures documentation for Phase 0; confirm a version 1 save from before this change loads on web and Android.
- [x] Real-time playthrough of Phase 0 and Phase 1 through the UI; record it in `docs/PLAYTEST-SECOND-PASS.md`.

Agent verification: 192 tests and pinned-tool verify-full pass; three visible
browser passes cover fresh guest and affected later inputs at both sizes. The
real-time production-web opening reached Phase 2 in 19m 45.7s wall / 1,183.4s
simulated time. Version 1 loading was checked on web and Android, with the UI
compatibility limitation in #39. Further second-pass findings: #41 and #42.
See PLAYTEST-SECOND-PASS.md and REVIEW-SECOND-PASS.md for exact scope and limits.

- [ ] Maintainer has personally played Phase 0 and Phase 1 and signed off.

Exit gate: `make verify-full` green in CI; the maintainer has played Phase 0 and Phase 1 and signed off on the opening.

---

## M5 - E2E, feel, accessibility

- [ ] Playwright E2E against the web export (`tests/e2e/`), selecting by `testID` only. Cover: boot, first unlock mounts a widget, dilemma blocks and resumes, wipe and breadcrumb recovery, save code round trip. Add `make e2e`. See `docs/TESTING.md`.
- [ ] Decryption text reveal on unlock, per-phase palettes, haptics (`expo-haptics`, no-op on web). All motion respects reduced-motion settings.
- [ ] Screen-reader pass on web and one native platform; meters must not rely on colour alone.
- [ ] Performance: no dropped input on a mid-range Android device at late Phase 4; React profiler shows node cards not re-rendering on ticks.

Exit gate: `make verify-full` and `make e2e` green in CI.

---

## M6 - Release hardening

- [ ] App identity (name, icons, splash), `app.json` hardening, EAS build profiles. Signing credentials via environment/EAS secrets only.
- [ ] Android release build (AAB) and install test. iOS if a Mac/EAS is available; otherwise report as not built.
- [ ] Optional GitHub hardening if the repo is public or has Advanced Security: CodeQL and dependency review workflows, pinned by commit SHA.
- [ ] Attach the CycloneDX SBOM to releases. Store privacy declaration: no data collected.
- [ ] Final balance pass with human playtest notes folded into `docs/BALANCE.md`.

Exit gate: installable Android build, tagged release with SBOM, all gates green.
