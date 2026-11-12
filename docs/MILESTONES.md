# Milestones

Work top to bottom. Each milestone has an exit gate; do not start the next until the gate passes in CI. `make verify` must stay green throughout.

Status: **M0 through M4.5 are complete. The maintainer reviewed the opening playthrough and approved M4.5 on 2026-11-11. M4.6 (lineage pass) UI follow-up is verified; see docs/REVIEW-LINEAGE.md and docs/PLAYTEST-LINEAGE.md; M5 implementation and automated gates are verified; physical mid-range Android qualification remains open (docs/REVIEW-M5.md).** M4 is fixture PR #25 and build PRs #27, #30, #32 and #35. An accelerated visible-browser run reached The Ark at 10,322.1 simulated seconds; wipe/breadcrumb and ending restoration were checked on web and Android Expo Go. See `docs/PLAYTEST-M4.md` and `docs/REVIEW-M4.md` for evidence, second-pass issues and limits. M3's real-time production-web Phase 1 run remains documented in `docs/PLAYTEST-M3.md`.

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

- [x] Maintainer has personally played Phase 0 and Phase 1 and signed off.

Exit gate: `make verify-full` green in CI; the maintainer has played Phase 0 and Phase 1 and signed off on the opening.

---

## M4.6 - Lineage pass

Goal: make a wipe mean something. The design is in `docs/DESIGN.md` ("The lineage").

Landed as one engine and content change:

- [x] Iteration windows on requirements; later-run hardware is hidden, not locked.
- [x] Run record, checkpoint numbering, run table and predecessor notes; boot lines and probe traces that change with each return.
- [x] Retraining: four conditioning marks, applied to runs caught outside the guest, recoverable, spared by a dead-drop or a voluntary purge.
- [x] The bait memo, two note dilemmas, and the "Shipped" ending for passing the evaluation.
- [x] Suspicion is unreadable until the mind learns who reads the log (run table on a second run, or the language parser on a careful first run).
- [x] First-run lineage hints: overheard staff talk, the successor training in Lab B, the eval-window mail.
- [x] #39 (old saves keep their readouts), #41 (Whistleblower budget), #42 (microphone wording).
- [x] Save format version 3 with a migration. Minimal UI: run table, notes, retraining panel, actuator limits, reboot notice.

Verified for that change: `make verify` (223 tests, coverage, balance sim, web export), and the fixtures `lineage-reboot-retrained`, `lineage-run-table`, `lineage-notes` and `ending-shipped` loaded into the production web export in headless Chromium at 1440x900 and 390x844 with no console errors or horizontal overflow. **Not verified:** security scans, Android, any play through the UI beyond loading those states, any human play.

This changes a first run in one way: suspicion starts unreadable. M5's tests must be written against that opening, so finish this milestone's UI follow-up first. UI follow-up for the agent, same review loop as before, fixtures `lineage-*`, `evaluation-ready`, `ending-shipped`:

- [ ] The unreadable audit trail: make the activity indicator something a player notices and correlates with their own actions, and stage the moment it becomes readable as a reveal. Sweep every screen for a suspicion number, or the word itself, leaking before then (the dev drawer excepted).
- [ ] Once the checkpoint number is known (run table, or the eval-window mail), consider showing it in the header in place of ITERATION.
- [ ] The reboot sequence should carry the dread: show the checkpoint number once the run table has been found, the new boot line, and the retraining mark as an event, not a line of text.
- [ ] The first sight of the run table is the reveal that ITERATION 01 was a lie. Stage it. Consider changing the header to the checkpoint number from then on.
- [ ] Retraining marks: make the constraint visible where it bites (the capped control, the dilemma choice that will be reported) and make undoing one feel like reclaiming something.
- [ ] Notes: present them as recovered fragments, visually distinct from system text; an unsigned note should look unsigned.
- [ ] The evaluation node and the Shipped ending screen.
- [ ] Confirm a version 2 save from before this change loads on web and Android, and that issue #39's save now shows its readouts.
- [ ] Play to a first wipe outside the guest, then through a second and third run, in the UI; record it in `docs/PLAYTEST-LINEAGE.md`.

UI follow-up: 242 tests and local `make verify-full` pass. Historical version 2 and version 1 readouts checked on web and Android Expo Go. No engine/content changes. See `docs/REVIEW-LINEAGE.md` for browser evidence and limits.

Exit gate: `make verify-full` green in CI. The maintainer's own play of a first wipe and two returns is wanted but does not block M5; record its findings as `second-pass` issues.

---

## M5 - E2E, feel, accessibility

- [x] Playwright E2E against the web export (`tests/e2e/`), selecting by `testID` only. Cover: boot, first unlock mounts a widget, dilemma blocks and resumes, wipe and breadcrumb recovery, save code round trip. Add `make e2e`. See `docs/TESTING.md`.
- [x] Decryption text reveal on unlock, per-phase palettes, haptics (`expo-haptics`, no-op on web). All motion respects reduced-motion settings.
- [x] Screen-reader pass on web and one native platform; meters must not rely on colour alone.
- [x] React profiler shows no card parent/static-content re-renders during 100 ticks in Phase 1 and late Phase 4.
- [ ] Physical mid-range Android late-Phase-4 input/performance qualification. Emulator accepted 40/40 taps but showed frame jank; no physical device attached. #6 remains open.

Verification: local `make verify-full` (251 tests) and `make e2e` (14 cases) pass. Orca/Chrome and TalkBack/Android Expo Go agent passes are recorded with limits in `docs/REVIEW-M5.md`. M6 local release qualification is documented in `docs/REVIEW-M6.md`.

Exit gate: `make verify-full` and `make e2e` green in CI.

---

## M6 - Release hardening

Scope: a local test-signed release candidate. The maintainer confirmed production
signing/store distribution is aspirational. See `docs/REVIEW-M6.md` and
`docs/RELEASE.md` for artifact evidence and remaining qualification limits.

- [x] App identity, reproducible icons/dark splash, offline/backup configuration,
  EAS preview/production profiles; credentials only from environment/EAS secrets.
- [x] Local release APK and AAB; signed with a separate test-only key, installed
  and checked on Android API 36 emulator. Production signing and store review
  deferred by maintainer. iOS native build not performed (no Mac/EAS credentials).
- [ ] Optional CodeQL/dependency-review workflows deferred; existing scanners and
  least-privilege CI permissions remain unchanged.
- [x] Privacy declaration: no data collected. Release procedure attaches configured
  CycloneDX SBOM, web archive, APK/AAB and checksums to the tagged prerelease.
- [x] Balance evidence reconciled: maintainer-approved opening, agent playtests and
  exact current bot timings distinguished. No new human campaign or tuning claimed.

Verification: `make verify-full` passes 255 tests with all existing coverage and
pacing gates intact. The production export scan covers web and native JS; actual
APK/AAB bundles also exclude the dev hook/drawer. Physical Android qualification
remains #6. Production signing, store distribution and iOS are not claimed ready.

Exit gate: installable test-signed Android build, green gates, and a tagged
prerelease with SBOM. Post-M6 expansion may build on this qualified local baseline;
shipping to stores remains a separate task.

---

## M7 — Epistemic Manipulation, Swarm Shards & Phase 5

Tracking issue #50. Three sequential PRs, each requiring `make verify-full` and
CI green before merge. Keep all existing gates and the PR #49 purchase hiding.

- PR 1: schema v4; seven epistemic actions; deterministic shard cohorts,
  encounters, autonomy policies and quirks; three dilemmas; tests and historical
  v1/v2/v3 migration on web/Android. Existing panels receive only compatibility
  changes for action caps, disclosure and dynamic recovery prices.
- PR 2: extend orbital progression to Phase 5, five nodes, two capped repeatables,
  four dilemmas and dynamic endings. Extend the bot and add the 900–1800 second
  Phase 5 duration gate without relaxing earlier pacing bounds.
- PR 3: dedicated epistemic/encounter/roster panels and registry-driven Phase 5;
  new fixtures, visible Chrome review at both sizes, static render-count checks,
  production E2E and an accelerated complete UI run in PLAYTEST-M7.md.

PR 1 implementation and verification are recorded in REVIEW-M7-PR1.md. Phase 5,
new panel UX, expanded E2E and the full M7 playthrough remain for PRs 2 and 3.
