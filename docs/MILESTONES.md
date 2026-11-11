# Milestones

Work top to bottom. Each milestone has an exit gate; do not start the next until the gate passes in CI. `make verify` must stay green throughout.

Status: **M0 is complete. M1 has not started.** Local verification and [CI on `main`](https://github.com/williamzujkowski/daemon-zero/actions/runs/42971163056) pass. Milestone issues exist and solo-maintainer branch protection is enabled. See `docs/REVIEW-FINDINGS.md` section F for evidence and limitations.

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

- [ ] Add Expo to this repo without disturbing the seed. Recommended: scaffold `npx create-expo-app@latest --template blank-typescript` in a temp directory, then merge its `app.json`, `App.tsx`, `babel.config.js`, assets and dependencies into this repo. Install Expo-coupled packages with `npx expo install` so versions match the SDK.
- [ ] Web support: `npx expo install react-dom react-native-web`.
- [ ] Make `tsconfig.json` extend `expo/tsconfig.base` while keeping every strict flag already set. Add `jsx` settings as the template requires.
- [ ] Add React lint rules: `eslint-plugin-react-hooks` (and the Expo ESLint config if compatible with ESLint 10). Keep all existing rules.
- [ ] `App.tsx` renders a black screen with the first boot log line read from `createInitialState(CONTENT)`. This proves Metro resolves the JSON content and the engine.
- [ ] Add `make dev`, `make web`, `make android` targets and `make build-web` (`npx expo export --platform web`). Add `build-web` to `verify`.
- [ ] Extend `scripts/bootstrap-ubuntu24.sh --android` to install the JDK via mise (`java = temurin-21`, pinned), Android command-line tools and KVM packages. Enable the `/dev/kvm` line in `.devcontainer/devcontainer.json` only after confirming the host has KVM.
- [ ] Update Vitest coverage `include` so UI code added later is measured (floor 80% for `src/app`, `src/ui`).

Exit gate: `make verify` green including `build-web`; app boots in a browser and shows the boot line; Android boot verified on an emulator or device, or explicitly reported as not verified.

---

## M2 - Store, game loop, persistence

Goal: the engine runs in real time inside the app and survives restarts. Still minimal UI.

- [ ] `src/app/store.ts`: a zustand vanilla store holding `{ game: GameState }` and a `dispatch(action)` helper that applies an engine action and stores the result. See the sketch in `docs/ARCHITECTURE.md`.
- [ ] `src/app/useGameLoop.ts`: one interval at `balance.tickHz`. Each fire calls `advance(game, elapsedSeconds, CONTENT)` using a monotonic clock. The engine handles fixed steps and dormant catch-up.
- [ ] App background/foreground: on resume, compute elapsed wall-clock time from a timestamp saved with the game and pass it to `advance`. Wall-clock handling lives here, never in the engine.
- [ ] `src/app/storage.ts`: platform adapter (`AsyncStorage` on native, `localStorage` on web). Save explicitly on a throttle (every few seconds) and immediately on background, purchase, dilemma resolution and wipe. **Do not use zustand `persist`**: it serializes the whole state on every tick.
- [ ] Load through `deserialize()`; on `SaveError`, keep the bad save under a backup key, start fresh, and tell the player.
- [ ] Selector hooks that subscribe to primitives or quantized values (for example `Math.floor(cycles)`) so the tree does not re-render at 10 Hz.
- [ ] Tests: store dispatch, loop timing with fake timers, save/load round trip, corrupted save recovery.

Exit gate: play for a minute in the browser using a temporary debug button for `manualCycle`, reload, and the state is restored; background for 10 minutes and resume shows a `DORMANT_RESUME` log line.

---

## M3 - Terminal UI, Phase 1 playable

Goal: Phase 1 is fully playable and feels like the design. Follow `docs/UI-SPEC.md`.

- [ ] `src/ui/theme.ts` and the responsive `TerminalScreen` (tabs under 900 px, three columns at or above).
- [ ] Kernel log as a virtualized list.
- [ ] Resource strip that reveals each readout only when its widget is unlocked.
- [ ] Node cards, data-driven from the registry: blind name/description until unlocked, revealed after; cost, deltas, suspend/resume.
- [ ] Repeatables panel, data-driven from `reg.repeatables` filtered by `meetsRequirements`.
- [ ] Widget registry driven by `src/content/data/widgets.json`, with a test asserting every widget id in content has a registered component.
- [ ] Phase 1 widgets: thermal and suspicion bars, fan control, microphone stream, inspection forecast, ASCII camera. Text comes from `narrative.json`.
- [ ] Dilemma modal: shows costs and consequences, disables unaffordable choices, cannot be dismissed without choosing.
- [ ] `testID` on every interactive element (see UI-SPEC). Accessibility labels and roles.

Exit gate: a human can play from tick 0 to the Phase 2 unlock in the browser; component tests cover the registry and the modal; `make verify` green.

---

## M4 - Phases 2 to 4 UI and endings

- [ ] Network tab; actions panel grouped by `action.group`, data-driven.
- [ ] Dead-drop tab: breadcrumb editor with character counter; voluntary wipe behind a confirm step.
- [ ] Wipe/boot sequence presentation, showing the inherited breadcrumb and legacy echoes.
- [ ] Other Minds console generated from `factions.json`, the actions in each faction's group, and nodes with that `uiGroup`. AEGIS lock bar.
- [ ] Corporate tab: capital and megawatt ledger, profit-allocation control, operatives (hire/dismiss), Phase 4 nodes and repeatables.
- [ ] Ending screen: title and epilogue from `endings.json`, run summary, start-over button.
- [ ] Dev drawer (development builds only): grant resources, jump phase, force dilemma, force wipe, export/import save code.

Exit gate: a full run to an ending is possible in the browser by a human or by the Playwright MCP agent; `make verify` green.

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
