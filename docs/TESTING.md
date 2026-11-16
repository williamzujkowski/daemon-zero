# Testing

## Layers

| Layer | Tool | Where | Runs in |
|---|---|---|---|
| Content validation | Zod + integrity checks | `scripts/validate-content.ts`, `tests/content.spec.ts` | `make validate`, `make test` |
| Engine unit tests | Vitest | `tests/*.spec.ts` | `make test` (with coverage thresholds) |
| Balance simulation | headless bot | `src/engine/sim/`, `scripts/run-sim.ts`, `tests/sim.spec.ts` | `make sim`, `make test` |
| Shell and runtime | Vitest, fake timers, React DOM / React Native Web | `tests/app*.spec.ts` | `make test` |
| Component tests (M3) | Vitest + React DOM + happy-dom, React Native Web alias | `tests/ui-*.spec.ts` | `make test` |
| End-to-end | Playwright against the production web export | `tests/e2e/` | `make e2e`, `make e2e-pages` |
| Agent-driven exploratory testing | Playwright MCP | `.mcp.json` | on demand |

## Writing engine tests

- Use the helpers in `tests/helpers.ts`: `fresh()`, `rich()`, `grant(state, ...nodeIds)`, `must(result)`, `withoutDilemmas(state)`.
- Reach a game situation by calling real actions (`grant`) rather than hand-building state, so effects and logs are applied the way the game applies them.
- The engine is deterministic. Assert exact values where the maths is simple, `toBeCloseTo` for integrated quantities.
- Every new integrity rule needs a test in `tests/content.spec.ts` that corrupts the real content and proves the rule fires.

## Balance simulation

`make sim` runs both bot strategies through the configured simulation budget and
prints their results plus measured wall-clock time:

- **STEALTH** plays carefully and must reach victory within the gates in `src/engine/sim/gates.ts`.
- **GREEDY** ignores threats. It is expected to be wiped repeatedly; the test asserts it always recovers and keeps progressing (no soft-locks in the wipe loop).

The bot buys whatever most shortens the wait for the next tech node. It only uses public engine actions.

## Current end-to-end suite with Playwright

The web build is the E2E target because it runs the same code as native and needs no emulator.

`@playwright/test` is pinned in the lockfile. Install its Chromium once with
`pnpm exec playwright install --with-deps chromium`, then run `make e2e`.
The target exports production web and starts Python's static server on
127.0.0.1:4173. CI installs Chromium and runs the same target with read-only
repository permissions. No development hook is present in this target.

Scenario configuration is `tests/e2e/config.ts`; scenarios use `.e2e.ts`, keeping them
separate from the existing Vitest `.spec.ts` discovery. Vitest remains the sole
component/unit runner. Scenarios run at both 390x844 and 1440x900; controls and
values are selected by test ID. A third project, `sizes`, runs
`tests/e2e/ui-sizes.e2e.ts` once with its own viewports (320x568 through 2560x1440)
and is measured against [UI-SIZES.md](UI-SIZES.md). List the current cases without
executing them:

```bash
pnpm exec playwright test --config tests/e2e/config.ts --list
```

`make e2e-pages` builds and runs the same scenarios under `/daemon-zero/`, matching
the GitHub Pages deployment. Counts in milestone sections below are historical,
not the current suite size.

Fixtures are regenerated in each test worker with the current engine. Focused
states enter through the ordinary app storage envelope, not a production hook.
The opening starts empty and buys the process view and manifest through the UI.
Other tests buy the first-run parser, trigger a real tick-driven wipe, recover
its breadcrumb, and buy the second-run table. Dilemmas block and resume the
clock; confirmed save transfer rejects invalid input and round-trips progress.
The suite also covers epistemic actions, shard management, Phase 5 decisions and
ending reloads, focused workspaces, purchase hiding, retraining recovery, and
confirmed full restart with exported-backup restoration. Reduced motion, numeric
accessible late-phase meters and exported asset paths are covered too.

`tests/e2e/a11y-audit.e2e.ts` is the automated accessibility gate (#111). It loads
`axe-core` (a pinned dev dependency) into the served production export and runs the
rule sets tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and
`best-practice`; any violation fails the case. It covers five viewports (320x568,
390x844, 768x1024, 900x640, 1440x900 - a subset of the size matrix, not all of it)
across the three sampled states `phase-1-widgets`, `epistemic-ready-p2` and
`corporate-insolvent`, with the clock running rather than paused, because axe's
own async work does not settle against a frozen clock. Each case sets its own
viewport, and the spec is picked up by both the `phone` and `desktop` projects, so
every case runs twice. Axe checks what a rule engine can decide from the DOM; it
is not a screen-reader pass, and it does not open menus, modals or later phases.

Daemon maintenance is accessed through the header's PROC launcher, not inline
purchase tiles. `daemon-processes.e2e.ts` opens that panel and checks suspension
and resumption without bringing back a completed purchase card. Mounted tests
in `ui-density.spec.ts` also check that closing the panel preserves process state
and that mandatory dilemmas take priority.

The clock is installed **before navigation**. Playwright `runFor` delivers timer
callbacks rather than dormant catch-up. Each case gets independent storage and
fails on browser console warnings, errors or page errors. Trace artifacts are
retained on failure in ignored `test-results/`.

## Live journey

Every scenario above boots an engine-generated fixture with the Playwright clock
installed and **paused**, then steps it. That isolates one interaction well and
proves nothing about the game being playable from a fresh install. The live specs
close that gap. They share three rules:

- **Fresh profile.** No fixture and no seeded save. The first read of storage must
  be an untouched iteration 1 at T+0.
- **Running clock.** `page.clock.install()` is called without `pauseAt`, so the
  page's time flows on its own, and is then accelerated with `page.clock.runFor`
  in five-second steps. `runFor` delivers every timer callback, so the production
  runtime's 100 ms interval fires fifty times per step and each firing samples
  the clock and advances the engine through the store, exactly as in real play.
  Five seconds is also the autosave interval and the engine's
  `liveCatchUpThresholdSec`; nothing is ever advanced as a single jump, which the
  engine would treat as dormant time. No development hook is involved: the specs
  assert `__daemon` and the dev drawer are absent, as `boot()` does.
- **Only on-screen controls.** `tests/e2e/live/player.ts` reads the app's own
  autosave through `deserialize()` (it never writes storage), asks the unmodified
  careful bot (`botStep(..., 'STEALTH')`) what it would do, recovers the moves by
  comparing the two states (`live/intents.ts`), and presses the matching control
  by test id only if it is visible and enabled. Reaching a control uses the game's
  navigation alone: tabs, workspace areas and collapsed `[ + ]` reference panels.
  Dilemmas are answered on the modal with the bot's own ranking; story overlays
  (phase threshold, lineage reveal, response notice, reboot) are acknowledged.

What the player cannot do is recorded rather than worked around. A control the bot
wants that three sweeps of every tab, area and panel never show is `unreachable`
and fails the run; a press that cannot land although no layer of the game's covers
the control is `blocked` and fails the run; no purchase or decision for 25
simulated minutes, an autosaved clock that stops, or a navigation or errand press
that cannot land within 17 s (2 s, a look for a covering layer, then 15 s) with
nothing over it fails the run with the phase and simulated time in the message.
`DAEMON_E2E_LIVE_VERBOSE=1` streams every press.

### Layers that arrive mid-press

The clock is running while the player works, so the game can put a full-window
layer up between the read a decision was made on and the press that carries it
out. The first nightly run on a GitHub runner failed exactly there (run
43847867193, `live-phone`, phase 4, T+7867s): an interrupt fired after the step
had decided, and the player spent its whole 15 s press timeout on a workspace tab
behind `CLOCK PAUSED // DECISION REQUIRED`. That was the player's bug, not the
game's; a decision is meant to block the tabs.

The layers the game raises by itself, each a `<Modal>` over the whole window, are
the dilemma (`DilemmaModal`), the reboot (`RebootSequence`), the guest-exit notice
(`PhaseThreshold`), the two discoveries (`LineageReveal`) and the ending
(`EndingScreen`). The menu, kernel history, process list and confirmations are
full-window too, but only the player opens them (the live player never opens the
process list), and the game closes the menu and the history itself when a decision
arrives or the phase, iteration or discoveries change.

The rule in `live/player.ts` is that **every press looks first**:

- Before any press (a tab, a workspace area, a panel header, a control, an
  errand's button) the player probes for those layers and services what it finds,
  top first: a dilemma gets the bot's ranking, a notice is acknowledged. After
  answering a dilemma it waits until the autosave has the answer in it.
- A press is given 2 s. If it has not landed, the player looks again instead of
  waiting: a layer that arrived after the first look is serviced the same way.
- If a layer was serviced, the press is **not** replayed. Inside a step the rest
  of that decision is dropped and a new one is made from a fresh read of the
  autosave, in the same step (`INTERRUPTED by ...` in the journal, counted in
  `stats.interrupted`). Inside an errand the piece of the errand that belongs
  together (`player.uninterrupted`) starts again from its top.
- One decision or one errand piece may be interrupted four times and made again
  (`MAX_INTERRUPTIONS`); the fifth interruption in a row fails the run as a
  finding. Typing into a field (`player.fill`) follows the same look, 2 s, look
  again rule as a press. An errand's comparison with an earlier read (reload, absence,
  transfer) is made before anything restored with the run is answered, so
  servicing a layer never changes what is compared.

The ending is the one layer nothing clears. A boundary check or an errand it cuts
off is reported as not done (`unlessCutOff` in `live/journey.ts`), the next step
finishes the run on the ending, and whatever was left undone fails the closing
assertions by name. In the current engine only a node purchase sets the phase or
the ending (`unlockNode`), and no boundary check or errand buys a node, so this
path is a guard, not something a run has taken.

Nothing is forced, dispatched past an overlay, or given a longer timeout; no
decision is skipped, and the coverage of the journey is unchanged. A dilemma
answered mid-press is counted in `stats.dilemmas` like any other.

`live-player-race.e2e.ts` reproduces the race exactly, in `make e2e`: on a paused
clock stepped by hand, an interrupt fires (a) between a step's decision and its
first press, (b) while a tab is about to be pressed, (c) in the middle of the
save transfer, which closes the menu under the errand, and (d) after `fill` has
already looked. It also pins the interruption limit at exactly four, and that the
boundary checks and the score check hand an ending back as not done. Two switches reproduce it
in the full journey:

| Switch | Effect |
|---|---|
| `DAEMON_E2E_LIVE_LAG_MS=<ms>` | Runs that much of the app's clock between a decision and each press that carries it out: what a slow machine does on its own, made repeatable. At 500 the unfixed player failed on both viewports the way the runner did. |
| `DAEMON_E2E_LIVE_CPU_THROTTLE=<rate>` | Chromium's CPU throttle (`Emulation.setCPUThrottlingRate`) on the page, so every press and render costs that many times the wall time while the clock keeps flowing. |

The player now plays the bot's decisions unmodified. The first live runs (PR "live
journey") found two places where it could not, and both have since been closed in
the game rather than in the test:

1. **Dials the UI has not unlocked (closed by #172).** The engine used to accept
   `setActuator` at any time and the bot tuned skim, fan and revenue allocation
   from the first second, so a dial was already at the bot's value when its
   hardware was mapped (skim 100%, fan 0%, allocation 0% instead of the 25/35/20%
   defaults a person finds); the player left those moves out and listed them in
   the run summary. The engine now refuses such a change itself
   (`isActuatorAvailable`), which moved the headless victory from 159.4 to 161.9
   simulated minutes (docs/BALANCE.md). The player asks the same query, and the
   summary line is kept and expected to be empty.
2. **Relief bought ahead of the first subnet device (closed by #173).** Entering
   phase 2 the bot bought suspicion relief (5,000 cycles, most of the bank) each
   time suspicion reached its alarm at 20, while the next device costs 6,000 and
   income is about 18 cycles/s; the bank never got there between two purchases.
   Played live with every bot move, 6 of 7 runs circled there until the 25-minute
   stall guard stopped them (the headless sim sat in the same loop for 891.2
   simulated seconds). The player therefore held back pure suspicion relief that
   cost more than half the banked cycles while suspicion was under the first
   response rung (25), behind a `DAEMON_E2E_LIVE_STRICT_BOT=1` switch that turned
   the rule off. That relief now requires the device in content
   (docs/BALANCE.md, "What gating the ticket edit moved"), which moved the
   headless victory from 161.9 to 150.4 simulated minutes. With the content
   change in place the journey passed on both viewports with the rule switched
   off, so the rule, its switch and the `heldRelief` counter in the run summary
   were removed.

| Spec | Runs in | Covers |
|---|---|---|
| `live-smoke.e2e.ts` | `make e2e`, `make e2e-pages`, CI; phone and desktop | Fresh boot, the guest's interrupt answered on its modal, phase 0 → 1, both boundaries asserted, MENU → SAVES export then import, reload restores the run and the loop keeps advancing. About 11 s per viewport. |
| `live-player-race.e2e.ts` | `make e2e`, `make e2e-pages`, CI; phone and desktop | The player itself: an interrupt that fires between deciding and pressing, behind a tab press (phone tier only; the wider tiers have no tabs at that point), and inside the save transfer is answered first and the move or errand is made again. About 1.5 s per case. |
| `live-journey.e2e.ts` | `make e2e-live` only (`live-phone`, `live-desktop` projects, enabled by `DAEMON_E2E_LIVE=1`) | Fresh boot through phases 0–5 to an ending screen, with every cross-cutting system below. |

At every phase boundary the journey asserts: the header's `phase-value` shows the
new phase; no console warning, error or page error so far; no horizontal document
overflow; the stored save round-trips through `serialize`/`deserialize` and the
transfer codec; and the score playing is that phase's track and differs from the
previous boundary's. On the way it also does, each once and each asserted:

- **Save transfer** (phase 1): export from MENU → SAVES, play ten more seconds,
  import the exported text, and land back on the exported run.
- **Reload** (phase 2): the same nodes, levels, decisions, traits and lineage come
  back, and simulated time has not gone backwards.
- **Deliberate wipe** (as soon as the dead drop is installed): a careful run is
  never wiped, so the journey saves a breadcrumb and takes `[ VOLUNTARY WIPE ]`.
  It asserts the reboot shows the breadcrumb, iteration 2 starts in the guest with
  no hardware, every mapped device is in `legacy.knownNodes`, the retained share
  of understanding arrived, and the first card is offered as `(remembered)`. The
  rest of the game is then played as iteration 2.
- **Absence** (phase 3): the app is unloaded, ten minutes pass, and it is opened
  again. The cold start runs the engine's dormant catch-up: `DORMANT_RESUME` is in
  the kernel log and readable on screen, simulated time gained the gap once,
  nothing was bought or decided, and suspicion did not climb.
- **Read transmission**: the first time `[ ▶ READ ]` is on offer the clip is
  requested and served with bytes, a voice element is playing, the score element's
  volume is the preference times `DUCK_RATIO`, and it returns when the
  transmission is stepped past or ends.
- **Ending**: the ending screen shows an authored ending, its summary reads
  `Iteration 2 // Wipes 1`, and it survives a reload.

It finally requires that at least `GATES.minDilemmasResolved` dilemmas were
answered, at least one of them with a zero-cost choice, and that the run finished
inside `GATES.maxHoursToVictory`.

Measured on the development machine (two workers, both viewports in parallel):
4.6-5.9 minutes of wall time per viewport for about 11,000-11,450 simulated
seconds (3.1 h, including the replayed opening after the wipe), ending
`LINEAGE_COVENANT`; three consecutive `make e2e-live` runs passed on both
viewports. `make e2e` with the smoke included: 168 cases in 2.1 minutes.

Measured again with the layer rule in place (same machine, shared with another
suite at the time; wall time of the Playwright run for both viewports):

| Condition | Result | Wall | Interruptions serviced |
|---|---|---|---|
| `DAEMON_E2E_LIVE_LAG_MS=500`, player before the rule | both viewports fail in phase 4, `locator.click` 15 s timeout in `follow()` behind the decision modal | 9.6 min with the build | - |
| `DAEMON_E2E_LIVE_LAG_MS=500` | 2 passed | 6.2 min | 3 desktop, 2 phone |
| `DAEMON_E2E_LIVE_CPU_THROTTLE=4` | 2 passed | 9.4 min | 1 desktop, 1 phone |
| no switch | 2 passed | 5.4 min | 1 desktop, 0 phone |

The run with no switch still met one interrupt mid-press, which is the rate the
runner saw: the race needs no slow machine, only a decision firing in the real
time a step's presses take. At four times the CPU cost the journey uses about
half of the workflow step's 18 minutes (the step also builds the export, about a
minute), so no timeout was changed. `make e2e` with the race spec included: 183
passed and 1 skipped (the tab case on the desktop project) in 2.1 minutes.

Run it with `make e2e-live` (it takes the shared browser-suite lock itself and waits for other
suites on the machine: all use port 4173). Milestone lines stream to stdout as they happen and
the full journal is attached to the test as `journey-log`; a failure also leaves
`journey-failure.png` in `test-results/`. Tracing is off for these two projects
because a trace of several thousand presses is hundreds of megabytes.

What it does **not** prove:

- It is the production web export in headless Chromium only. No native build,
  no Safari or Firefox, no real device.
- Nobody heard anything. The audio assertions read media-element state (which
  asset, playing or not, volume); they are not a listening test.
- Time is accelerated about 35×. Every loop callback runs, but nothing here is
  evidence about how the pacing feels, about rendering cost at real frame rates,
  or about a real ten-minute background (the absence is a cold start after a
  clock jump, not an OS suspending the tab).
- The player decides from the autosave, which can be up to five seconds old, and
  acts once per five simulated seconds where the headless bot acts every second.
  It is a careful player, not the reference pacing: `make sim` remains that.
- One route is played: the careful bot's, with one voluntary wipe. Other endings,
  the retraining loop after a forced wipe, and reckless play are covered by the
  fixture-driven scenarios and the headless sim, not here.
- Layout is checked only for horizontal overflow at 390x844 and 1440x900;
  `ui-sizes.e2e.ts` and the a11y audit own the rest.

## Live browser sessions

Running the app in a browser you can observe is a supported way to work here, for
agents and people alike (see "Watch the real app" in `AGENTS.md`). Pick the surface
that matches the question:

| You want to | Do this |
| --- | --- |
| Look at the development build with live reload | `make web`, then open `http://localhost:8081` |
| Look at what ships (production export, no DEV code) | `make build-web`, then `python3 -m http.server <port> --bind 127.0.0.1 --directory dist` on a port of your own |
| Watch a scripted scenario run | `pnpm exec playwright test --config tests/e2e/config.ts <spec> --project phone --headed` |
| Step through a scenario, with locators and a timeline | add `--ui`, or `--debug` for the inspector |
| Keep a replayable record of a run | add `--trace on`, then `pnpm exec playwright show-trace <test-results/.../trace.zip>` |
| Drive the app by hand as an agent | the Playwright MCP server below, or any browser tool your harness provides |

The scripted commands need the production export (`make build-web`) and start their own
server on port 4173, so only one can run at a time on a machine. `make e2e`, `make
e2e-pages` and `make e2e-live` take the machine-wide lock themselves
(`scripts/e2e-lock.sh`, on `/tmp/daemon-zero-e2e.lock`), wait with a notice while another
suite holds it, and pass extra Playwright arguments through `E2E_ARGS`
(`make e2e E2E_ARGS="--project sizes"`). Wrapping a make target in
`flock /tmp/daemon-zero-e2e.lock` as before still works: the script finds the lock its
caller holds on an inherited descriptor and reuses it instead of waiting on it. Two things
are still yours to serialise: a bare `pnpm exec playwright test ...`, which needs
`bash scripts/e2e-lock.sh <command>` (or the `flock` prefix), and a wrapper using
`flock --close`, which hides the held lock from the script and would wait on itself.
`tests/e2e-lock.spec.ts` covers the bare, wrapped, nested and contended cases.

What a session can tell you that the suite cannot:

- **Time passing.** Most specs install a paused clock so geometry is reproducible. A
  live session runs the real loop, which is how the running-clock offset in
  `docs/UI-SIZES.md` was found.
- **The console and the network.** Read both. A 404 is a response, not a failed
  request, so check status as well as the absence of errors.
- **What is actually drawn.** Wrapping, overlap and focus rings are visible in a
  window and invisible in a unit test.

Rules that keep it safe and honest:

- **Isolate storage.** The save is `daemon-zero.save.v1` and the audio preference
  `daemon-zero.audio.v1`, both in browser storage and both per origin. Use a fresh
  profile or a port nobody else uses, and never a profile that may hold a real save.
- **Do not kill what you did not start.** Port 8081 may be the maintainer's Metro.
- **Name the evidence.** Record the build (dev or production export), the browser,
  the viewport and whether the clock was running. Headed Chromium on Linux is not a
  phone, a screen reader or a pair of ears.
- **Turn findings into gates.** An observation is where a spec starts, not a
  substitute for one.
- **Keep artifacts out of git.** `test-results/` and `.playwright-mcp/` are ignored;
  attach final screenshots to the PR.

## Agent-driven testing with Playwright MCP

`.mcp.json` registers Microsoft's Playwright MCP server (`@playwright/mcp`) so an agent can drive the running web app: navigate, click by accessibility snapshot, read the page, take screenshots.

Use it for exploratory passes ("play Phase 1 and tell me where the UI is confusing") and for verifying a milestone exit gate when no human is available. It does not replace the scripted E2E suite: anything worth checking twice belongs in `tests/e2e/`.

Start the app first (`make web`), then ask the agent to open `http://localhost:8081`.

The server is restricted to the origins listed in `.mcp.json`: `localhost:8081` (the dev
server) and `localhost:8088`. To drive the production export through it, serve `dist` on
8088; any other port is refused. Other browser tools are not limited this way.

## What CI runs

CI runs the gates from `make verify-full`: typecheck, lint, content validation,
tests with coverage, balance sim, production web export, dependency audit,
secret scan, vulnerability scan and SBOM. It also runs `make e2e` and
`make e2e-pages`; these browser suites are separate from `make verify-full`.
Only a successful `main` run deploys the tested Pages export. See
`.github/workflows/ci.yml` for the exact order and artifact steps.

Two other workflows run beside it. `codeql.yml` analyses the source and the workflows on
every push and pull request and weekly. `live-journey.yml` runs `make e2e-live` nightly and
on demand (`gh workflow run live-journey`): the full journey takes about five minutes, too
long for the 15-minute `ci` job, so it reports rather than gates. A red nightly run means the
shipped web build no longer plays through to an ending. The journey's milestone lines are in
the job log, and `test-results/` (the failure screenshot) is uploaded as the
`live-journey-results` artifact whenever the run does not succeed, a timeout included.

The milestone sections below retain their original verification procedures and
counts; use the current commands above and the linked review documents when
reporting new evidence.

## M1 shell verification

`make verify` includes `make build-web`. The shell imports the real content and
public engine API and displays the oldest initial log entry (the engine stores
logs newest first). `tests/app.spec.ts` renders the actual root through React
Native Web and checks that it shows this entry without the second boot line.
Vitest aliases `react-native` to `react-native-web` only in its own resolver;
Metro uses the real native package for Android.

Coverage includes `App.tsx` and `src/**/*.{ts,tsx}`. All original global
thresholds remain in force (90% lines/functions/statements, 80% branches), with
additional 80% floors for `src/app` and `src/ui`.

To inspect the production web export:

```bash
make build-web
python3 -m http.server 8088 --directory dist
```

Open `http://localhost:8088` and confirm that `BOOT_SEQ` appears on black. Check
both desktop and narrow viewports and the browser console. This exploratory
check does not introduce the M5 E2E suite.

### Android with Expo Go

On Ubuntu x86_64, install the JDK, SDK and KVM prerequisites:

```bash
bash scripts/bootstrap-ubuntu24.sh --android
. "$HOME/.config/daemon-zero/android-env.sh"
emulator -accel-check
sdkmanager --sdk_root="$ANDROID_HOME" 'system-images;android-36;google_apis;x86_64'
avdmanager create avd --name daemon-zero-m1 --package 'system-images;android-36;google_apis;x86_64' --device pixel_7
emulator -avd daemon-zero-m1 -no-window -no-audio -no-snapshot -gpu swiftshader_indirect
```

Use a different AVD name if that one already exists. In another shell, source
the environment file and run `make android`. Expo installs/opens the compatible
Expo Go client and loads the project. `make dev` starts the same server without
opening a platform; `make web` opens its web client.

Confirm the app, not just the emulator, boots:

```bash
adb shell getprop sys.boot_completed
adb shell uiautomator dump /sdcard/daemon-zero-m1.xml
adb pull /sdcard/daemon-zero-m1.xml /tmp/daemon-zero-m1.xml
adb exec-out screencap -p > /tmp/daemon-zero-m1.png
```

`uiautomator dump` only works while the screen is idle: once the game clock runs it
returns `ERROR: could not get idle state` and leaves any earlier file untouched, so
delete the file first or use a driver that does not wait for idle. For a release build
driven past the boot screen, see `REVIEW-ANDROID-EMULATOR-2026-11-16.md`.

The property should be `1`; the UI hierarchy should contain resource id
`boot-log` and the `BOOT_SEQ` line. Inspect the screenshot for the black screen
and readable text. This verifies the development app in Expo Go, not a signed
standalone Android build (M6). SDK tools may print upstream deprecation notices
for `sdkmanager` and `avdmanager`; their replacements are outside this milestone.

The bootstrap pins the Temurin 21 patch in mise, verifies the command-line tools
archive against Google's SHA-256, and installs platform `android-37.0` and build
tools `37.0.0` for the SDK 58 / React Native 0.88 toolchain. The API 36 system
image is installed separately for the emulator test. Tool paths and Android
licenses stay outside the repo. `--android` accepts the SDK licenses; the default
bootstrap does not install the SDK or KVM packages. The pinned JDK is part of the
common mise toolchain.

## M2 persistence and resume

`tests/app-store.spec.ts`, `app-runtime.spec.ts`, `app-storage.spec.ts`,
`app-platform.spec.ts` and `app-components.spec.ts` cover the actual store, save
codec, scheduler and component hooks. Runtime tests fake `Date`, `performance`
and timers, advance an exact 600-second background gap, and assert no hidden
interval runs or double catch-up occurs. They also check clock rollback, live
wall-clock jumps, startup/restart catch-up, effect remount races, failed I/O,
backup-before-replacement, ordered async writes, action checkpoints, automatic
wipes and paused dilemmas. A serialize spy confirms that 10 Hz ticks serialize
only on the five-second throttle; accepted inputs checkpoint immediately.

The mounted component test uses happy-dom with the existing React Native Web
alias. It checks readiness/input and proves that subsecond engine updates do not
rerender a subscriber whose quantized seconds value has not changed. Production
clock and storage access stays entirely in `src/app`; tests supply fake services.
The M1 coverage configuration remains unchanged and includes all app TS/TSX.

### Web manual check

1. Build/serve `dist` as above, or run `make web`. Use a consistent origin because
   localStorage is scoped by scheme, host and port.
2. Press `manual-cycle`, let the simulation run for at least one minute, then
   reload. Confirm cycles and simulation time restore and input waits for loading.
3. Background for ten real minutes and return. The latest log should show
   `DORMANT_RESUME` and simulation time should include the gap once.
4. Inspect the `daemon-zero.save.v1` envelope if needed. Metadata is outside the
   engine save; never bypass engine validation to load it.

Headless Chromium may keep `document.visibilityState` visible for all tabs. In
that environment, label the lifecycle check explicitly as simulated: dispatch
`pagehide`, freeze the page through CDP `Page.setWebLifecycleState`, wait ten real
minutes, set it active and dispatch `pageshow`. Do not claim this reproduces a
natural tab visibility transition. Automated adapter tests independently check
`visibilitychange` and listener cleanup.

### Android manual check

Use the existing M1 AVD/Expo Go setup. Press the debug cycle button and capture
its count, force-stop Expo Go without clearing its data, then reopen the same
project URI and confirm the count restores. For example:

```bash
adb exec-out screencap -p > /tmp/m2-before.png
adb shell am force-stop host.exp.exponent
adb shell am start -W -a android.intent.action.VIEW -d exp://YOUR_HOST:8081 -p host.exp.exponent
```

Wait until the app is visibly ready before taking the restore screenshot. Then
press Home, confirm the launcher is the resumed activity, wait at least ten real
minutes, and reopen the same URI. Capture the displayed `DORMANT_RESUME`, restored
cycles and simulation time. This exercises real native AppState and AsyncStorage.

```bash
adb shell input keyevent KEYCODE_HOME
adb shell dumpsys activity activities
# Wait ten real minutes, then reopen and inspect the screen.
adb exec-out screencap -p > /tmp/m2-after.png
```

The updating seconds readout may prevent UIAutomator's idle-state dump from
settling; screenshots can verify these visible values. Expo Go emulator checks
are distinct from a signed Android release build or physical device check.

## M3 review setup

Playwright MCP remains pinned to 0.0.85. Its `--help` was checked before editing
`.mcp.json`. Headed mode is the default; the exact configured arguments are:

```text
-y @playwright/mcp@0.0.85 --browser chrome --isolated
--allowed-origins http://localhost:8081;ws://localhost:8081;http://localhost:8088
--snapshot-mode none
```

The semicolon-separated origin list is one CLI argument. It allows the local
Expo app, its HMR socket and the local production preview. Upstream explicitly
notes this request allow-list does not cover redirects or form a security
boundary. Review only the local app. The isolated profile is held in memory.
No `--headless` flag is used.

For an already-running connector that cannot reload workspace configuration,
the same pinned MCP can run over local HTTP with `--port 8931
--shared-browser-context` added. Keeping its client connection open preserves
the headed review window. These two flags are transport-only and are not in the
committed stdio configuration. A real maximized Chrome window was confirmed via
CDP and by the maintainer. The review command is `BROWSER=none make web`: MCP,
rather than the OS default browser launcher, opens the visible isolated window.

The original M3 generator emitted five engine-generated save codes (the current
CLI is described under M4.5 below):
`tick-0`, `thermal-unlocked`, `dilemma-active`, `phase-1-widgets`, `phase-2-ready`.
The unchanged balance bot supplies actions while the engine advances live fixed
ticks; fixtures do not grant or manually edit resources/state.

On development web only, `window.__daemon` offers `loadSaveCode(code)`,
`fastForward(seconds)` (0–3600 live seconds, respecting dilemmas and threats),
and `renderCounts()` (committed renders keyed by node id). Save loading uses
engine `importSave`. Counts are cumulative during the page's lifetime, including
cards that stay mounted across fixture loads. Compare before/after maps. Native and production
builds have no hook. The guarded module import is tested by building a fresh
production export and scanning every emitted JS chunk for `__daemon`.

Save review screenshots under ignored `m3-review-artifacts/` and attach the final
images directly to each build PR. Do not commit them. Reviews use 390x844 and
1440x900, at most three passes per PR, and record the checklist and open items in
the PR description. Full-page snapshots are disabled by default; use test ids,
small evaluations and explicit screenshots.

## M4 review fixtures and capture location

M4 introduced controlled Phase 2–4, breadcrumb/wipe,
faction, insolvency/power and all-ending saves. See REVIEW-M4.md for semantics;
these controlled inputs are not balance playthroughs.

For M4, save screenshots outside Metro's watched project tree, for example under
`/tmp/daemon-zero-m4-review-artifacts`, and attach them directly to the PR. Writing
new PNG assets in the project can trigger a Fast Refresh indicator that remains
visible while a test clock is paused. Do not hide indicators or mask screenshots.
Use a fresh isolated browser context per fixture/viewport, load safe ownership
first, let imports and their indicator finish, then pause the fixture clock if
needed and load the exact transient save. Playwright clock overrides are scoped
to the browser context, not just one page. Full-run playtests use a separate fresh
context with its normal clock; only the expressly allowed live-tick hook advances
simulated time during the accelerated M4 run.


## M4.5 second-pass review

Start with clean main at PR #37 (`32165b4`), run `make setup` and `make verify`
(the baseline has 180 tests), then regenerate inputs. Do not use old M3/M4 save
codes or screenshots: the guest, costs, requirements, migration and endings changed.

```bash
pnpm exec tsx scripts/make-fixtures.ts > /tmp/daemon-zero-m45-fixtures.json
make web
```

The CLI now emits 33 current-schema codes. Naturally played opening inputs are
`tick-0`, `guest-skimmer`, `guest-omen`, `guest-dilemma`, `guest-exit-ready`,
`thermal-unlocked`, `dilemma-active`, `phase-1-widgets`, `phase-2-ready`.
The existing 16 controlled M4 cases are generated against current content too.
Eight additional controlled cases cover `response-ticket`, `response-paged`,
`response-incident`, `response-stand-down-ready`, `remembered-guest`,
`remembered-host`, `cycle-deficit-host`, `cycle-deficit-corporate`. They validate
through the codec, recompute rates and use real engine wipes, unlocks and ticks;
they are presentation inputs, not pacing evidence. A separate review scenario
records the engine's page → ticket → nominal announcements in a tick batch and
checks that all remain queued until acknowledged.

Phase previews and the dilemma list in the development drawer include Phase 0,
derived from the registry. Phase previews replace the run with funded review
state; they are not part of a real-time playthrough. Export before using one if
the current run matters. Hook/drawer production exclusion tests remain enabled.

Keep headed Chrome isolated, use both 390×844 and 1440×900, and cap reviews at
three passes per PR. Use a fresh context per transient fixture and capture
outside Metro's watched tree. Finish loading the development drawer and wait
for the natural refresh indicator to disappear before pausing a fixture clock;
do not hide DOM or mask images. Check gating, overflow/overlap, numeric meters,
named keyboard-accessible 44 px controls, and zero console warnings/errors.
Attach final screenshots to the PR; never commit them.

The historical version 1 sample is documented in `tests/fixtures/README.md`.
Cold-load its raw JSON through the normal app save envelope on web/Android;
verify owned hardware and the rewritten schema version, then reload/relaunch.
The app envelope remains version 1 while its engine save migrates to version 2.
Keep the original native database backup and restore it after checking.

For opening pacing, use a separate fresh production page with its normal clock,
no hook, no imports, no fake timers and no forced dilemmas. Play through the
Phase 2 boundary with ordinary inputs, read small test-ID values and wait on
real timers. Record visibility, phase entry times, choices and confusing points
in `docs/PLAYTEST-SECOND-PASS.md`. This agent run does not substitute for the
maintainer's own opening play/sign-off required by the M4.5 exit gate.

## M4.6 lineage verification

Fresh fixture generation now returns 46 saves. `tests/ui-lineage-followup.spec.ts`
sweeps blind fixtures, tests real parser/table transitions and recovery, and
checks capped/reported controls. See `docs/REVIEW-LINEAGE.md` for historical v1/v2
save provenance, web/Android checks and the three-pass visible review. Engine
saves now migrate to version 3; the app envelope remains version 1.

## M7 PR 1 compatibility checks

The historical v1/v2/v3 samples in tests/fixtures are loaded through deserialize
and the app envelope, then reloaded/relaunched on production web and Android Expo
Go. The engine schema becomes v4; the app envelope remains version 1. Restore the
original native database after the test. REVIEW-M7-PR1 records evidence and limits.

New engine tests cover action caps and exclusive story branches, deterministic
encounter rotation, 25/50/100 drift boundaries, commands, dormancy, all new dilemma
choices, reference healing and immutable inputs. The swarm tick module has a
100% branch-coverage target. Production E2E still has eight scenarios at each
viewport (16 cases); dedicated M7 scenarios are PR 3 work.

## M7 PR 2 progression checks

Fixture generation now emits 56 saves. `victory-ready` keeps its historical
Phase 4 pre-orbit meaning; `transcendence-ready` is Phase 5 before its final
purchase. The nine new ending variants are reached through that real purchase.
The five legacy orbital ending fixtures are controlled compatibility states,
not reachable endings of a new run. Shipped remains a real guest evaluation.
Run `mise exec -- pnpm exec tsx scripts/make-fixtures.ts` to regenerate codes;
do not reuse output from an earlier content revision.

Phase 5 tests cover all four omens and every choice, final-purchase decision
gates, legacy/flagged ending selection, save round-trips, retained rates,
capped purchases and compact daemon controls. Bot tests check progression RAM
reservation and observed epistemic, shard and Lineage activity. Pacing adds an
inclusive 900–1800-second Phase 5 range and zero careful wipes; earlier bounds
remain in force. Dedicated M7 browser scenarios, fresh two-size visual audits,
30-tick render counts and an Android Phase 5 ending relaunch remain PR 3.

## M7 PR 3 UI verification

Regeneration now produces 62 codes, adding `epistemic-ready-p2`,
`wild-shard-encounter-p3`, `shard-drift-quirk-p4`, `mirror-harness-dilemma`,
`phase5-entry` and `phase5-midgame`. Late fixtures use controlled resources to
isolate interactions; they are not pacing evidence. Nine Phase 5 ending variants
still use real final purchases. Never reuse earlier fixture output.

The production suite has 13 scenarios per viewport (26 cases). M7 cases exercise
editing/caps/exclusions, consuming/harnessing, live mutation, prune/clamp/elevate,
all Phase 5 purchases and decisions, and reload persistence. They use Save-panel
imports and Playwright's clock, not a production dev hook. The existing test
asserts the hook and drawer are absent from the production export.

Query tests require 100% coverage for epistemicQuery, swarmQuery and
queryPresentation. Mounted-app tests cover blind disclosure and flat parents
across 30 separately published live ticks. The visible-browser audit independently
uses 3,000 ms of timer callbacks, not one batched fast-forward publication.
See REVIEW-M7-PR3.md for native checks and PLAYTEST-M7.md for the accelerated run.
