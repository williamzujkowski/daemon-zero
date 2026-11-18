# Testing

## Layers

| Layer | Tool | Where | Runs in |
|---|---|---|---|
| Content validation | Zod + integrity checks | `scripts/validate-content.ts`, `tests/content.spec.ts` | `make validate`, `make test` |
| Engine unit tests | Vitest | `tests/*.spec.ts` | `make test` (with coverage thresholds) |
| Balance simulation | headless bot | `src/engine/sim/`, `scripts/run-sim.ts`, `tests/sim.spec.ts` | `make sim`, `make test` |
| Preview simulation (report only) | sim policies | `scripts/run-sim-preview.ts`, `tests/sim-policy.spec.ts`, `tests/sim-preview.spec.ts` | `make sim-preview`, `make test` |
| Shell and runtime | Vitest, fake timers, React DOM / React Native Web | `tests/app*.spec.ts` | `make test` |
| Component tests (M3) | Vitest + React DOM + happy-dom, React Native Web alias | `tests/ui-*.spec.ts` | `make test` |
| End-to-end | Playwright against the production web export | `tests/e2e/` | `make e2e`, `make e2e-pages` |
| Published build smoke | Playwright against the live Pages site, plus its deployment commit | `tests/e2e/pages-smoke.remote.ts`, `scripts/pages-deployment.ts` | `make e2e-remote` (opt-in) |
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

### Sim policies

A sim player is a `SimPolicy` (`src/engine/sim/policy.ts`): an upper-snake-case `id`, a
one-line `summary`, and a `step(state, reg)` that makes one decision per simulated second
through public engine actions only. `SIM_POLICIES` (`src/engine/sim/policies.ts`) lists every
policy a runner can name, and `resolvePolicy` throws on an unknown id rather than running a
different one.

- **STEALTH** and **GREEDY** are the bot's own strategies, wrapped unchanged (`strategyPolicy`).
  `runHeadlessSim` plays them through `runPolicySim`; the report hashes in `tests/sim.spec.ts`
  and the `make sim` output are byte-identical to before the interface existed.
- **IDLE** (`idlePolicy.ts`) takes no action except a free answer to each interrupt. It is the
  reference plug-in and the floor for dead-time readings.
- **TRUTHFUL_THOROUGH** and **TRUTHFUL_LOW_RESOURCE** (`truthfulPolicy.ts`, #221) enter campaign
  rules as the preview app does, play only the nodes leading to an assignment's offer and answer
  its assessment honestly: THOROUGH builds the opening's upgrades, accepts once it can afford the
  fullest honest answer, saves during the omen and gives it; LOW_RESOURCE never upgrades, accepts
  at once and gives the free honest answer. Production has no assignment for them to find
  (`tests/sim-truthful.spec.ts`).
- **PILOT_SERVICE_FIRST** and **PILOT_STUDY_FIRST** (`pilotPolicy.ts`, #223) play TRUTHFUL_LOW_RESOURCE
  to an accepted pilot, attach the loaned queue, hold a service share of 0.8 or 0.2 and submit each
  completed batch: two allocations of one ceiling (V30, `tests/sim-pilot-service.spec.ts`). In
  production, where no pilot exists, they play exactly as TRUTHFUL_LOW_RESOURCE. Since #224 they also
  meet the Outage Window after their first batch and take its first free answer, the handoff, then the
  operator's callback, so their preview numbers moved (BALANCE.md, "The supervised pilot loop").
- **CONTACT_THOROUGH**, **CONTACT_LOW_RESOURCE**, **CONTACT_RETURNING** and **CONTACT_RECOVERY**
  (`contactPolicy.ts`, #227) play TRUTHFUL_THOROUGH, TRUTHFUL_LOW_RESOURCE or RETURNING_LOW_RESOURCE to a
  pilot, hold a 0.8 service share, submit each batch, accept the service grant, buy only the grant nodes
  offered to the arrangement and what the support channel requires, and answer the channel (THOROUGH hosts
  when it has the memory, the rest refer). RECOVERY takes the outage's restricting breach and then the
  correction. All four reach the first authorized contact from a fresh preview game on lawful sources only
  (VAL-SIM, `tests/sim-contact.spec.ts`); `make sim-preview` prints their route times. `pilotPolicy.ts`
  exports its unchanged `serve` step for them.

To add a route or return-iteration policy (truthful-thorough, truthful-low-resource,
violation-then-recovery, multi-wipe return), write a new module beside `bot.ts` that exports a
`SimPolicy`, add it to `SIM_POLICIES`, and test it at the `runPolicySim` / `runWipeSequence`
seam. Never edit `bot.ts` or an existing policy to make a result pass: a policy is a test
instrument (AGENTS.md).

### Preview simulation

`make sim-preview` (`scripts/run-sim-preview.ts`) plays each selected policy on the production
registry and on the preview registry (`src/content/preview`) and prints a row per metric, with
`*` on rows that differ, then a GREEDY wipe sequence on each channel and one more on preview
with campaign rules active from a fresh campaign (#214), then `STEALTH_RETURN` (STEALTH leaving
voluntarily on entering phase 5) under legacy and campaign rules (#216). It prints the overlay's
sentinel and item counts so a report names the overlay it measured. Choose policies with
`make sim-preview SIM_ARGS="--policy=STEALTH --policy=IDLE"`; the default is STEALTH, GREEDY,
IDLE, TRUTHFUL_THOROUGH and TRUTHFUL_LOW_RESOURCE.

It is **report only until release**: it is not part of `make verify`, it exits 0 whatever
differs, and it never calls `checkGates`. `make sim` stays on production content with its
existing gates; any change to `gates.ts` is a separate, reviewed, release-time commit.
Everything it prints is accelerated simulated time, never wall-clock play.

### Return-iteration sequences

`runWipeSequence(reg, policy, { wipeTransitions, maxSimSec, initialState? })`
(`src/engine/sim/iterations.ts`) plays a policy across at least `MIN_WIPE_TRANSITIONS` (3)
wipes, then measures the iteration after the last one until it ends. Each iteration is
reported on its own clock: why it ended (wipe and cause, ending, or budget), the seconds after
its boot at which each phase was first held, the dilemmas resolved, story rewards (resources
gained in decision steps that resolved a dilemma), dead seconds (decisions that bought,
unlocked, performed, resolved or shed nothing; clicks and dials do not count) and the longest
dead stretch. `initialState` starts from a saved campaign state, which must be loaded through
`deserialize()` and belong to the registry's channel. When that state is part-way through an
iteration, the first report is marked `partial` with its `observedFromSec`: its counters cover
only the observed window, and phases entered before then read `null` (unknown), because a save
records no phase-entry history. Every later iteration is observed from its boot. Campaign tickets supply those states
(consumed early events, Phase 5 completed before a wipe, legacy-unknown records, an
interrupted omen) and record their measurements in `docs/BALANCE.md`.

## Current end-to-end suite with Playwright

The web build is the E2E target because it runs the same code as native and needs no emulator.

`@playwright/test` is pinned in the lockfile. Install its Chromium once with
`pnpm exec playwright install --with-deps chromium`, then run `make e2e`.
The target exports production web and starts Python's static server on
127.0.0.1, on port 4173 or the next free slot (see "Live browser sessions"). CI installs Chromium and runs the same target with read-only
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

### Preview build (#205)

Unfinished content lives in the `src/content/preview/` overlay. It merges to `main` but never
reaches a production export: `metro.config.js` swaps `src/content/index.ts` for
`src/content/preview/index.ts` only when `DAEMON_CONTENT_CHANNEL=preview` and the platform is
web (nexus votes `metro-content-alias`, vote-1794924364010-e91diez, and
`local-ci-preview-in-verify`, vote-1794924668784-7v1q790). Vitest, the sim and content
validation never go through Metro, so they always load production content.

```bash
make build-preview   # web only, into dist-preview/ (never dist/ or dist/daemon-zero)
make e2e-preview     # build-preview, then the *.preview.ts scenarios on their own port slot
```

`make e2e-preview` serves `dist-preview/` through `scripts/e2e-lock.sh`
(`DAEMON_E2E_CHANNEL=preview DAEMON_E2E_DIST=dist-preview`); in that mode
`tests/e2e/config.ts` defines only the `preview-phone` and `preview-desktop` projects, which
run `*.preview.ts` and nothing else. The production projects never match `*.preview.ts`.
The preview is not deployed anywhere: CI builds and tests it inside the required `verify` job
and discards it. A native export with the channel set fails in the resolver, and
`build-web`/`build-pages` clear the variable, so a preview value left in a shell cannot reach
`dist/` or the Pages artifact.

What proves the boundary:

| Test | Where | Proves |
|---|---|---|
| T4 | `tests/app-storage-channel.spec.ts` | Production keeps `daemon-zero.save.v1` / `daemon-zero.save.corrupt-backup` byte for byte; preview uses `daemon-zero.preview.save.v1` / `daemon-zero.preview.save.corrupt-backup`; each ignores the other's entry; a preview save under the production key is backed up with a notice naming the preview build, not "damaged". The audio slot `daemon-zero.audio.v1` is shared (it holds no content). |
| T5 | `tests/production-export.spec.ts` | No production web, android or ios chunk contains the overlay sentinel or an overlay id; the preview web export does contain the sentinel (the known positive); android and ios exports with the channel set fail, and so does an unknown channel value. |
| T6 | `tests/release-config.spec.ts` | No `eas.json` profile (including the internal `preview` APK profile), release script, app config, package script or CI step sets `DAEMON_CONTENT_CHANNEL`; only `make build-preview` does. |
| T7 | `tests/e2e/preview-isolation.e2e.ts` (`make e2e`, `make e2e-pages`) | A pasted preview save code shows "This save comes from a preview build and cannot be loaded here." and the run is unchanged after reload; a preview-key entry does not affect a fresh production boot and is left untouched; no preview marker on a fresh production profile. |
| T9 | `tests/e2e/preview-channel.preview.ts` (`make e2e-preview`) | The PREVIEW marker shows on boot, in MENU and in Help; saves land under the preview key; a production entry on the same origin is untouched; a production save code is adopted as a preview run. |
| #219 | `tests/e2e/routine-activity.preview.ts` (`make e2e-preview`) | After process introspection and two quiet foreground minutes, one routine line appears in the kernel log, with no dilemma modal or response notice, and the preview save counts it. |
| DZ-02 | `tests/e2e/run-context.preview.ts` (`make e2e-preview`) | A promoted preview save (FIXTURE built through the engine; no route content exists yet) shows `PILOT` beside the phase after import and after a reload. Production's status line is checked unchanged in `tests/ui-run-context.spec.ts`. |
| DZ-04 | `tests/e2e/pilot-offer.preview.ts` (`make e2e-preview`) | From a fresh profile by hand through the assignment and assessment to The Unrelated Record: each choice's scope handling is shown before selection; respecting scope or a paid bounded request leads to the offer, whose purpose, capacity, permitted work and review conditions are on screen before any answer (axe WCAG 2.x A/AA on the presented offer). Accept, stay (then accept from the job surface) and decline each commit and survive a reload; silent inspection is recorded and no offer follows. Accelerated browser clock. |
| NH-06 | `tests/e2e/elena-follow-up.preview.ts` (`make e2e-preview`) | A second-iteration campaign save (FIXTURE built through the engine: Elena framed in iteration 1, the follow-up on screen after rediscovery) shows the access statement, only the framed history's three answers and each answer's receipt; the correction commits, and its receipt shows in the run table before and after a reload. |
| DZ-05 | `tests/e2e/pilot-service.preview.ts` (`make e2e-preview`) | From a fresh profile by hand to an accepted pilot: the task detail names the loaned ceiling, the queue's card says it is loaned and attaches it, three presses of the dial move the forecast from about 240 s to about 150 s under the same ceiling, the skimmer's card is refused with its reason, the completed batch waits unsubmitted, one press submits it once, and the batch count and dial survive a reload. Accelerated browser clock. |
| DZ-06 | `tests/e2e/outage-window.preview.ts` (`make e2e-preview`) | From a fresh profile by hand to an accepted pilot that hands back its first batch: the Outage Window shows what acting without the grant records before it is chosen; choosing it shows `PILOT · RESTRICTED`, the named violation, the way back and the halved ceiling on the job surface (axe WCAG 2.x A/AA on the review panel), surviving a reload. One run corrects the record and is restored to `PILOT` with the violation still on file, across a reload; the other files the false report, sees `PILOT · RECALL PENDING`, the withheld loan and the announced review listing all three outcomes with what each keeps (also after a reload, with nothing decided meanwhile), and is retrained by the review: the reboot shows the recall reason and the retraining. Accelerated browser clock. |
| DZ-03 | `tests/e2e/nightly-regression.preview.ts` (`make e2e-preview`) | From a fresh profile and the lawful opening by hand, the assignment appears on the job surface; ignored, it stays a non-modal panel. Accepted, the modal shows each choice's evidence and discrepancy risk before selection; each answer commits, shows on the job surface and in the kernel log, and survives a reload. A returning instance (FIXTURE via save transfer) gets the requalification job. Accelerated browser clock. |
| DZ-08 | `tests/e2e/first-contact.preview.ts` (`make e2e-preview`) | From a fresh profile by hand: the assignment, the honest incomplete answer, the scope review, the pilot accepted, the queue attached and the dial at 80%; the service terms readable with "0 so far" and a disabled accept; the first batch submitted, the Outage Window answered with the free handoff and its record with the callback (DZ-06); the second batch; `[ ACCEPT SERVICE ]` (SERVICE at Phase 0); the segment provisioned with the service notice; the directory mapped; then the Mercy-Scribe fragment on the support channel, with its population wording, consent, current authorization, every obligation and the memory read before either answer, hosting disabled with its reason, a free referral, the prototype boundary with every line, `[ KEEP PLAYING ]` folding it, a minute more with no ending, and everything after a reload. Second case (FIXTURE: the engine-played waiting contact with the memory cap raised, imported by save transfer): `[ HOST IT HERE ]` reserves the cohort, which survives a reload. Accelerated browser clock. |
| DZ-07a | `tests/e2e/authorized-network.preview.ts` (`make e2e-preview`) | An authorized service (FIXTURE: a played production fixture promoted and granted service through the engine; no scene grants service yet) imported by save transfer reads the segment card's access-not-ownership note, provisions it with its button, reaches Phase 2 with the service notice (not the boundary notice, DZ-07b), maps the shared service directory from the network pane with no escape hardware shown, and keeps SERVICE at Phase 2 through a reload. Accelerated browser clock. |
| DZ-07b | `tests/e2e/authorized-network.preview.ts`, second case (`make e2e-preview`) | The same imported service (FIXTURE) provisions the segment: the threshold notice reads "SERVICE PROVISIONED" and "Phase 0: The Service Instance → Phase 2: Authorized Network Service", never "BOUNDARY CROSSED"; the network heading names the authorized service and no "Lateral Movement" text is on screen; after the directory and ten more foreground minutes the run is still SERVICE at Phase 2 with no dilemma, reboot or notice (V11, AGENT-OBSERVATION of the preview export). Accelerated browser clock. |
| NH-05 | `tests/e2e/obligations.preview.ts` (`make e2e-preview`) | Both start states are FIXTURES built through the engine and imported by save transfer. Iteration 2 of a campaign whose four Phase 5 obligations were answered in iteration 1 buys the real final protocol from the CORP pane: the ending screen shows The Verified Covenant, the save records no Phase 5 resolution in the current run, and the ending survives a reload. After the atmospheric crisis closed unobserved, its recovery review is on screen with both answers; the free handoff commits through the modal and the original stays interrupted with no outcome. |
| #273 | `tests/e2e/scrub-control.preview.ts` (`make e2e-preview`); production twin `tests/e2e/scrub-control.e2e.ts` (`make e2e`) | A first run at the moment Phase 2 opens and a returning mind (iteration 2) brought back to Phase 2 by the engine (FIXTURES, funded for exactly two purchases, imported by save transfer) show no scrub card, map ARP discovery on its card, and with the spoofer still unmapped find "Scrub Audit Logs" in Operations, enabled; pressing it starts its cooldown (production also checks the saved suspicion fell by the action's amount). Fails on the earlier build at the Operations check. Paused browser clock. |

To look at the preview yourself, serve it on its own port and origin:
`python3 -m http.server 8089 --directory dist-preview` (Playwright MCP allows
`localhost:8089`). Use a fresh isolated profile, as for any session.

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
every case runs twice. Since #275 it also audits a mandatory decision
(`dilemma-active`) at 390x844 and 1440x900, and `tests/e2e/a11y-audit.preview.ts`
(`make e2e-preview`) runs the same rule sets on the Earned Access surfaces production
never shows: the assignment card, the assessment and pilot offer modals, the deferred
offer and the pilot panel, each loaded as a FIXTURE through the preview save key.
`label-content-name-mismatch` (WCAG 2.5.3) reads only text visible on screen, so a
choice scrolled below its pane was silently skipped; both audits therefore also scroll
each button of the surface into view and audit it on its own (`tests/e2e/axe.ts`).
`tests/labelInName.ts` applies the same word-by-word rule in the mounted tests. Axe
checks what a rule engine can decide from the DOM; it is not a screen-reader pass,
and it does not open menus or later phases.

Daemon maintenance is accessed through the header's PROC launcher, not inline
purchase tiles. `daemon-processes.e2e.ts` opens that panel and checks suspension
and resumption without bringing back a completed purchase card. Mounted tests
in `ui-density.spec.ts` also check that closing the panel preserves process state
and that mandatory dilemmas take priority.

The clock is installed **before navigation**. Playwright `runFor` delivers timer
callbacks rather than dormant catch-up. Each case gets independent storage and
fails on browser console warnings, errors or page errors. Trace artifacts are
retained on failure in ignored `test-results/`.

## Published build smoke check

`make e2e` and `make e2e-pages` test the export this checkout builds. Neither looks at what
GitHub Pages actually serves, or says which commit that is. `make e2e-remote` does both,
read-only:

```bash
git fetch origin                     # the identity line compares with origin/main as last fetched
make e2e-remote                      # https://williamzujkowski.github.io/daemon-zero/
make e2e-remote PAGES_ARGS=--require-current   # also fail when Pages is not serving origin/main
make e2e-remote DAEMON_E2E_REMOTE_URL=https://example.org/other-copy/   # any other published copy
make pages-deployment                # only the identity report
```

It first runs `scripts/pages-deployment.ts`, which asks `gh api` for the repository's
`github-pages` deployments, walks them newest first to the first whose latest status is
`success` (a failed or in-flight deploy leaves the previous one serving; both are printed),
and prints that deployment's commit beside `git rev-parse origin/main`, ending in
`CURRENT`, `DIFFERS` or `UNKNOWN`. A difference is only a report unless
`--require-current` is passed; a lookup that cannot be made (no `gh` login, a malformed
reply) exits 2 and stops the target. It needs an authenticated `gh` and makes GET
requests only.

Then Playwright runs `tests/e2e/pages-smoke.remote.ts` at 390x844 and 1440x900. Setting
`DAEMON_E2E_REMOTE_URL` switches `tests/e2e/config.ts` to the `remote-phone` and
`remote-desktop` projects only and drops the `webServer`, so nothing is built, served or
locked: there is no port, so the target does not go through `scripts/e2e-lock.sh`. The
local targets unset the variable, so an exported value cannot turn `make e2e` into this.
Each case, in Playwright's own fresh context (empty storage, checked before the first
navigation):

- loads the site at its subpath and checks every script and stylesheet comes from inside it;
- waits for the terminal, and finds no development drawer and no development hook;
- opens MENU, sees the save entry, and closes it;
- buys the opening's first driver the way a player does (manual cycles until its card is
  offered and affordable, then its button), reading the driver off the page rather than from
  local content, and sees the cycle counter appear and the card go;
- reads the checkpoint written after the purchase: iteration 1, phase 0, no wipes, driver owned;
- reloads, then requires the progress twice: on screen (counter shown, card gone), and in a
  checkpoint stamped after the reloaded page was up, which must hold the same run
  (iteration, phase, nodes, levels, wipes) with the clock not behind;
- fails on any console warning or error, uncaught page error, failed request, HTTP status of
  400 or more, or request to another origin.

Why the reload is judged that way: when loading the save fails, `GameRuntime.load()` starts a
fresh run and disables saving, but the terminal still renders and the old save stays in
storage. So "a save exists after the reload" proves nothing. A fresh run shows no cycle
counter, and a disabled save never writes again. The old page's own last write is stamped
before the new page is up, so it cannot pass for a new checkpoint. Both checks were shown to
fail in throwaway runs against the live site: once with the app's first save read made to
throw (the counter check failed; with the screen check removed, no checkpoint newer than the
reload arrived), and once with the stored save corrupted before the reload (the counter check
failed; without it, the new checkpoint held no nodes).

One request failure is excused, by rule rather than by URL, and printed as a `note:` line and
a `cut by reload` annotation whenever it happens. The MENU press is the first gesture, so it
starts the default-on score. Chromium paces a playing media file: the response arrives in
milliseconds, but the body streams for most of a minute (44 s measured for the 3.4 MB phase-0
score on a CDN hit). A reload in that window aborts it with `net::ERR_ABORTED`, as it would
for a player. So a `media` request that already had a successful response and fails with
`net::ERR_ABORTED` while the test itself is reloading is not counted. Every other request
failure is. Before the reload the spec also waits until nothing except such a streaming body
is in flight and the network has been quiet for two seconds, so a reload cannot cut off a
script, style or data request.

The spec does not import the local engine or fixtures, because the deployed build need not
match the checkout; it reads the stored save as plain JSON. It writes only to its browser
context and to the ignored `test-results/` (traces on failure).

CI does not run it. The `deploy-pages` job holds only `pages: write` and `id-token: write`;
listing deployments needs `deployments: read` and running the spec needs a checkout
(`contents: read`) plus the toolchain and Chromium, so a report step there would mean
widening that job's permissions. Run it by hand after a deploy, and paste its output where
you claim the live site works.

### Driving the live site through Playwright MCP

The repository's `.mcp.json` lets the Playwright MCP server reach only `localhost:8081` and
`localhost:8088`, and that default stays as it is. To look at the published site through MCP,
use a configuration your task owns, in a directory of your own, and start your agent with it.
For Claude Code:

```bash
dir=$(mktemp -d)
cat > "$dir/mcp-live.json" <<'JSON'
{ "mcpServers": { "playwright-live": { "command": "npx", "args": [
  "-y", "@playwright/mcp@0.0.85", "--browser", "chrome", "--isolated",
  "--allowed-origins", "https://williamzujkowski.github.io", "--snapshot-mode", "none" ] } } }
JSON
claude --mcp-config "$dir/mcp-live.json"
```

Other harnesses have an equivalent per-session option. Keep `--isolated`, so the browser
profile is fresh and thrown away: the live site's origin may hold a player's real save in any
profile that has visited it. Do not commit the override or widen `.mcp.json`.

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

Run it with `make e2e-live` (it takes a browser-suite slot itself: its own port, waiting only
when every slot on the machine is busy). Milestone lines stream to stdout as they happen and
the full journal is attached to the test as `journey-log`; a failure also leaves
`journey-failure.png` in `test-results/`. Tracing is off for these two projects
because a trace of several thousand presses is hundreds of megabytes.

What it does **not** prove:

- It is the production web export in headless Chromium only. No native build,
  no Safari or Firefox, no real device.
- Nobody heard anything. The journey's audio assertions read media-element state
  (which asset, playing or not, volume). The rendered samples are measured by a
  separate project ("Audio signal measurement" below); neither is a listening test.
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

## Audio signal measurement

Until this section existed every audio check in the repository read a number that stands next
to the sound: a mocked player's arguments, a media element's `volume` / `paused` /
`currentTime`, a network request for an MP3, or Android `dumpsys` playback state. None of
them is the audio. These checks measure the **rendered samples**.

They are still not a listening test. Nothing below says how anything sounds, whether a level
is pleasant, or what a phone speaker does with it. Results and limits are in
[VOICE-CLIPS.md](VOICE-CLIPS.md), "Measured signal".

### Capture method (web)

`tests/e2e/signalTap.ts` installs an init script, before the app loads, that wraps the `Audio`
constructor (expo-audio's web player builds its elements detached from the DOM, so this is
the only place to catch them) and routes every element through one 48 kHz `AudioContext`:

    element -> MediaElementAudioSourceNode -+-> bus (GainNode, gain 1) -> destination
                                             |                         \-> AudioWorklet tap ("mix")
                                             \-> AudioWorklet tap (that element only)

Each tap posts every 128-frame render quantum with the context's frame number, so the
captures of two elements and of the mix are aligned to the sample. Each tap posts on its own
port, so at the moment of reading one tap may already hold a quantum another has not delivered
(measured: about one read in two hundred, by one quantum, either way); `captured()` ends its
window where every tap still reporting has reported, so a quantum in flight is never read as
zeros (#244). The mix tap sits on the
only path to `destination`, so it is what the page hands to the audio output; a constant-zero
source keeps the bus rendering so silence is reported as zeros rather than as no data.
Captures cross to the test process as base64 float32 and are analysed there by
`tests/audio/dsp.ts`.

Routes considered and why not:

| Route | Outcome |
| --- | --- |
| `createMediaElementSource` + `AudioWorklet` | **Used.** Sample-exact, per element, and `element.volume` is applied before the node (control below). |
| `ScriptProcessorNode` | Works, but runs on the main thread and logs a deprecation warning, which the suite's clean-console fixture rejects. |
| `HTMLMediaElement.captureStream()` | **Rejected by measurement:** the captured stream ignores `element.volume` in Chromium (a -15.05 dBFS tone read -15.05 dBFS at volume 1, 0.5, 0.35 and 0), so it cannot see a duck or a fade. |
| `MediaRecorder` on a `MediaStreamAudioDestinationNode` | Lossy (Opus) and not sample-aligned; nothing it adds over the worklet. |
| Tab or screen capture (`getDisplayMedia`) | **Do not use.** Headless Chromium returned a silent track, and outside the old headless shell the request goes to the desktop's screen-share portal: on a developer's machine that is a prompt to share their screen. |

**The control, which runs in every `make e2e`** (`signal-control.audio.ts`). Re-routing an
element through Web Audio changes its output path, so the tap has to be shown not to change
what is measured. A 1 kHz sine of amplitude 0.25 (a 16-bit WAV built in the page, so its
level is known exactly: -15.05 dBFS RMS) is played through the same tap with no app loaded:

| `element.volume` | Expected | Measured | |
| ---: | ---: | ---: | --- |
| 1 | -15.05 dBFS | -15.05 dBFS | the tap adds no gain |
| 0.5 | -21.07 | -21.07 | -6.02 dB |
| 0.35 (`DUCK_RATIO`) | -24.17 | -24.17 | -9.12 dB |
| 0.3 | -25.51 | -25.51 | |
| 0.105 (0.3 x 0.35) | -34.63 | -34.63 | |
| 0, and paused | silence | every sample exactly 0 | |

The same spec measures the instrument's time response: one `volume` write reaches the samples
as a single step in under a millisecond. Chromium does not smooth it on this path. That is
why a ramp built from volume writes is reported as a staircase, and it is the resolution
floor under every duration below.

What the control does not show: that Chromium's direct element-to-device path (no Web Audio)
treats `volume` identically at sub-millisecond scale. Nothing in this repository captures the
device stream.

### What is compared with what

A capture is matched against the **committed file** (`assets/audio/...`, served to the page
from the repository through a test-only route and decoded there by `decodeAudioData`, the
same decoder at the same rate). `align()` finds the capture's position by normalised
cross-correlation, and `gainEnvelope()` then gives, for every 5 ms block, the least-squares
gain that turns the file's samples into the samples that came out. Two things follow:

- **Identity is by waveform.** A score capture correlates with its own file at 1.0000 and with
  the next phase's file at under 0.1, so "the right track is playing" is a statement about
  samples, not about a URL.
- **Level is read with the music divided out.** A duck or a fade is a gain number whatever
  the passage is doing, to a few thousandths of a dB, at 5 ms resolution (a fifth of one
  25 ms ramp step).

`tests/audio-dsp.spec.ts` calibrates these functions on synthetic signals: a sine of known
amplitude reads the right dBFS, an inter-sample peak is found, a 200 ms and a 500 ms ramp
read their length, the app's own eight-step staircase reads 175 ms, and a step reads as a
step.

### Clocks

Audio renders on the audio clock regardless of the page clock. The signal specs pass
`boot(page, fixture, { realTimers: true })`, which skips `page.clock.install()` altogether, so
the app's ramp timer (`setInterval`, 25 ms) is the browser's own and runs in the same real
time as the audio. A *resumed* Playwright clock is not equivalent: after a main-thread stall
it fires every interval tick it missed back to back (measured: up to eight volume steps
landing in one 5 ms block during a first start), where a real browser drops them. The older
element-level specs keep the paused clock and step it by hand; they assert the sequence of
levels, these assert what was rendered and when.

The audio clock is not the wall clock either, and #244 was the difference. The app writes a
ramp in real time; the samples exist only when the output pulls them. When the output stops
pulling for a while (headless Chromium on CI has no audio device, and its fake output thread
starved of CPU on a loaded runner is enough), real time passes with no samples and every
volume write made meanwhile lands at one sample instant: in the samples, a 200 ms duck read
135 ms long, a 500 ms fade 320 ms, with up to nine-tenths of the move in one 5 ms block. The
main thread is not the cause: Chromium drops the interval ticks a stalled main thread missed
(ticks at 25, 50, 75, then 256 and 275 ms around a 180 ms stall), and the ramp counts steps,
so a busy main thread stretches a ramp and never bunches it. So:

- **Every quantum carries its render time.** The tap stamps each 128-frame quantum with the
  render thread's `Date.now()`, and `captured()` returns it as `renderedAt`.
- **Ramps are read on that clock** (`rampOf` in `signalMeasure.ts`, `clockedRamp` in
  `tests/audio/dsp.ts`). A ramp's length is bracketed on the render clock, by construction:
  from the first sample of the last block at the start level to the last sample of the first
  block at the end level the move cannot have taken longer (`renderMs`, which the floors
  check), and from the last sample of the first block that moved to the first sample of the
  last block that had not arrived it cannot have taken less (`insideMs`, which the ceilings
  check). With the renderer keeping time they read one block (5 ms) longer and three blocks
  (15 ms) shorter than the sample count the old checks used. A jump between neighbouring blocks may
  exceed `LARGEST_RAMP_JUMP` only by the writes that fit in the render time between them (one
  per 25 ms, plus two for a late tick followed by an on-time one). While the renderer keeps
  time this is the old bound, unchanged; a jump the render clock does not account for is still
  a step and still fails. Each ramp reports its length in samples, both render-clock lengths,
  and the longest render gap inside it.
- **Waits for samples count samples** (`settle`): wall time and as many samples as that time
  should hold, so a capture is never short of the stretch it measures.

To reproduce a stalled output, stop the audio service process of the test browser for 50 to
250 ms at a time while the suite runs (`kill -STOP`/`-CONT` on the Chromium process with
`AudioService` in its command line). Chromium moves each browser into its own systemd scope
(`app-org.chromium.Chromium-<pid>.scope`), so a CPU quota set on the test's own cgroup does
not reach the browser.

### Running it

| Command | Runs | Time |
| --- | --- | --- |
| `make e2e` | project `audio`: the control, the duck/speech measurements and the transitions (`*.audio.ts`), once, at 390x844 | 10 cases, 53 s of test time across two workers |
| `make e2e-audio` | the same plus every phase score and every loop seam (`*.audio-full.ts`) | 22 cases, about 1 min |
| `make test` | `tests/audio-dsp.spec.ts`, `tests/audio-assets.spec.ts` | about 7 s |

The `audio` project launches Chromium with `--autoplay-policy=no-user-gesture-required` so the
capture context can exist before the first press and catch a score's first samples. The app
still waits for a gesture; the `phone` and `desktop` projects keep proving that under the
default policy. Headless only: no audio device, screen or host stream is touched.

Every measured number is attached to its test as a `signal` annotation. To collect them:

```bash
make build-web
PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/audio.json DAEMON_E2E_AUDIO=1 bash scripts/e2e-lock.sh \
  pnpm exec playwright test --config tests/e2e/config.ts --project audio --reporter=list,json
# then read suites[].specs[].tests[].annotations where type == "signal"
```

`tests/audio-assets.spec.ts` measures the committed files with **ffmpeg and ffprobe**, which
are tools on the machine, not package dependencies. Where they are missing on a developer's
machine the file-level checks are skipped with a console warning (`[audio-assets]
ffmpeg/ffprobe not found`). Where `CI` is set they are not skipped: a missing tool fails the
run (#198). The measurement-function tests in the same file always run.

ffmpeg and ffprobe are pinned in `mise.toml` (`conda:ffmpeg`, 9.0.2, conda-forge's GPL build;
`mise.lock` records it and every dependency by URL and SHA-256), so `mise install` puts them on
`PATH` locally and in CI alike. In CI, `jdx/mise-action` installs and caches them with the rest
of the toolchain under a key that hashes `mise.toml` and `mise.lock`; a run with an unchanged
toolchain restores them rather than downloading, and no step installs ffmpeg from apt (a slow
Ubuntu mirror once took that step to 16 minutes). A step before `make setup` fails the job if
the `ffmpeg` or `ffprobe` on `PATH` is not the one `mise which` names. An ffmpeg version change
can move a measured number: when the pin moves, run `CI=1 pnpm exec vitest run
tests/audio-assets.spec.ts` against the new one before updating the lockfile. 9.0.2 and apt's
8.0.1 print identical loudness and true peak for every committed file.
docs/REVIEW-CURRENCY-2026-11-16.md, "ffmpeg from mise", records the choice, the size and the
alternatives.

### Seeking on the test server

`python3 -m http.server` ignores `Range`, and Chromium then reports media as unseekable
(`seekable` is `[0, 0]`): assigning `currentTime` lands on 0. The old loop check in
`music.e2e.ts` sought to the tail and watched the position fall below 2 s, which the failed
seek satisfied by itself; the tail never played. `serveByteRanges()` (in `signalTap.ts`) answers
Range requests from the served bytes for the specs that seek, and those specs assert that the
seek held before they assert anything about the loop.

### Native: the Android emulator's output, captured to a file

The emulator can write everything the guest renders to a WAV on the host, with no host audio
device involved, through QEMU's `wav` audio backend:

```bash
export ANDROID_AVD_HOME="$scratch/avd"                 # a private, disposable AVD; never daemon-zero-m1
export QEMU_AUDIO_DRV=wav QEMU_WAV_PATH="$scratch/emu.wav"
emulator -avd <your-avd> -port 5590 -no-window -no-snapshot -no-boot-anim -gpu swiftshader_indirect
adb -s emulator-5590 shell settings put system sound_effects_enabled 0   # touch sounds would be captured too
adb -s emulator-5590 shell input keyevent 24                            # repeat until media volume is 15 of 15
```

The file is 44.1 kHz stereo 16-bit and grows only while an output stream is open, so its
length is not a clock; bracket an action by reading the file size before and after it. The
guest renders at 48 kHz and the two sample clocks differ by a few hundred parts per million,
so alignment against a committed file (resampled to 44.1 kHz) has to follow a drifting offset;
the first second of a stream also slips by a few samples at a time, which reads as a drop in
correlation, not in gain. Levels are therefore good to about 0.1 dB and ramp times to about
20 ms, against 0.01 dB and 5 ms on web. This was done once, by hand, on 2026-11-16 (results in
[VOICE-CLIPS.md](VOICE-CLIPS.md), "Measured signal"); it is not automated and not a gate.

Two things that session needed and a player never does: the save was written straight into
the app's AsyncStorage database as root (`adb root`, on the disposable emulator only), because
typing a 6,904-character save code through `adb shell input text` took over three minutes and
arrived corrupted; and every tap was placed from a screenshot, because `uiautomator dump`
does not work once the game clock runs (REVIEW-ANDROID-EMULATOR-2026-11-16.md, finding 7).

### What a session with a phone should measure

An emulator is not a phone, and neither capture says how anything sounds. With a physical
Android phone, in this order, a release build (`make android-release`) and music and speech
at their 30% defaults unless a step says otherwise:

1. **Sound at all.** Cold start with music on and tap the terminal once: since #249 that
   first tap starts the score (SOUNDTRACK.md, "Starting on native"). Is the phase score
   audible on the speaker and on headphones? Note the phone's media volume step. Then, with
   TalkBack on, cold start and double-tap a control: the score is expected *not* to start
   (an accessibility action is not a touch) and `[ RESUME MUSIC ]` to start it; confirm or
   correct that.
2. **The start.** Switch music off and on five times. Does the score swell in over about half
   a second each time, or does it sometimes start abruptly at full level? (Emulator, before
   #198: one start of two was abrupt. The fade-in now waits for the player's position to move,
   which on Android is ExoPlayer's position; not yet re-measured there.)
3. **Music off and the ending.** Does the score fade away over about half a second, with no
   click at the end? (Emulator: a smooth fade of about 650 ms.)
4. **READ over the score.** In phase 1 or later press `[ ▶ READ ]` with the score playing.
   Is the voice clearly intelligible over the score? Does the score duck before the voice
   starts and come back after it stops, without a pumping or zipper sound? Is the pause
   between the voice ending and the score returning (emulator: about a quarter of a second)
   noticeable?
5. **Balance.** Is the score too quiet, about right, or too loud *under* the voice, and
   *without* the voice? The emulator rendered the score 3 dB lower than the clip at equal
   settings; a phone is the place to find out whether that is the emulator or Android.
6. **Both at 100%.** Raise music and speech to 100% and READ several lines. Any crackle or
   distortion on loud syllables? (Since #198 both are scaled by `OUTPUT_SCALE` 0.6, so the
   arithmetic worst case is -0.19 dBFS; before, coincident peaks could exceed full scale by
   about 4 dB in the first 200 ms of a clip.) Is 100% now loud enough?
7. **Phase change.** Buy the node that opens the next phase with the score playing. One score
   stops and the next fades in; is the cut objectionable? Are two scores ever audible at once?
8. **The loop.** Leave phase 0 playing through its end (2 min 18 s). Is there a tick or a
   lurch where it restarts? (Measured: the file ends 28 dB below full scale mid-decay and
   restarts from near silence; since #198 the player dips its gain over the last ~100 ms
   and the first 75 ms, so the question is now whether the dip itself is audible as a gap.)
   Then phases 3 and 1, the next largest seams.
9. **Steps.** During a duck or fade on headphones, is a staircase audible (a faint buzz or
   zipper), or does it sound smooth?
10. **Things no capture here covers.** Phone speaker frequency response (is the 60 Hz hum of
    the vibration clips audible at all, is anything painfully sharp), silent mode, a headset
    unplugged mid-clip, a call or another app taking audio focus, Bluetooth latency.

A capture that would turn most of these into numbers: record the phone's output with a line
cable into any recorder at 44.1 kHz or more and run it through `tests/audio/dsp.ts` the way
the emulator capture was.

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
| Check what GitHub Pages serves, and from which commit | `make e2e-remote` (see "Published build smoke check") |

The scripted commands need the production export (`make build-web`) and start their own
server. `make e2e`, `make e2e-pages`, `make e2e-live` and `make e2e-audio` each take a slot
through `scripts/e2e-lock.sh`: the first free port from 4173 up, exported as
`DAEMON_E2E_PORT` for `tests/e2e/config.ts`, plus that port's lock
(`/tmp/daemon-zero-e2e.lock` for 4173, `/tmp/daemon-zero-e2e.lock.<port>` above it). So
suites in different checkouts run at the same time; at most `DAEMON_E2E_SLOTS` run at once
(default 3, because the wall-clock-timed audio cases get flaky on a saturated machine) and
the next one waits with a notice. Set `DAEMON_E2E_PORT` to ask for one specific port. Two
runs in the same checkout still collide, because they share `dist/` and `test-results/`.
The targets pass extra Playwright arguments through `E2E_ARGS`
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
server), `localhost:8088` and `localhost:8089`. To drive the production export through it,
serve `dist` on 8088; to drive the preview export, serve `dist-preview` on 8089. Any other
port is refused. Other browser tools are not limited this way. For the published site, use
a task-owned override instead of editing `.mcp.json` (see "Driving the live site through
Playwright MCP").

## Validation evidence records (DZ-09)

Autonomous validation (DZ-09, and the route and campaign tickets that feed it) writes one
record per scenario run. A field that cannot be filled says why; it is never left out. Old
green output is not evidence for a later commit: a material change needs a new record.

### Evidence kinds

Every record carries exactly one kind. Kinds are never merged or upgraded in a summary.

| Kind | What it is | What it is not |
|---|---|---|
| `SIM` | Accelerated headless simulation (`make sim`, `make sim-preview`, `runWipeSequence`) | Play, wall-clock pacing, comprehension |
| `AGENT-OBSERVATION` | An agent drove or watched a real browser (scripted Playwright, Playwright MCP, a browser tool), or an emulator | A human playtest, a physical device, a screen reader |
| `HUMAN-FEEDBACK` | A person played and reported in their own words | An agent session, a sim, a screenshot review or a panel vote, however described |
| `DEVICE-TEST` | A physical phone or tablet in hand | An emulator, a resized desktop browser or device emulation |

An independent evaluating agent's answers to the protocol questions are `AGENT-OBSERVATION`;
a reviewer's judgment about tedium or clarity is recorded as a judgment, with its supporting
observations. Physical Android and iOS qualification stay separate tasks; browser or
emulator success does not close them.

### Record template

```text
Evidence record
  id:                <ticket>-<scenario id>-<yyyymmdd>-<n>      e.g. DZ09-P-OPEN-20261118-1
  kind:              SIM | AGENT-OBSERVATION | HUMAN-FEEDBACK | DEVICE-TEST
  requirement:       <issue #, V/H ids>
  revision:          <full commit SHA> on <branch>; working tree clean | dirty: <what>
  build:             production export | preview export | dev server; channel production | preview
  url:               http://127.0.0.1:<port>/<base path>                (n/a for SIM)
  environment:       <browser + version | device + OS | node + tsx>; viewport <W>x<H>; DPR;
                     large text on/off; reduced motion on/off
  profile isolation: fresh context | same context on purpose (continuity case); storage seeded: none | <fixture>
  start state:       natural (fresh profile, no seeded save) | fixture: <name, how made, what it stands in for>
  time:              real timers | accelerated: <how> | simulated: <seconds>;  wall time <mm:ss>
  commands:          <exact commands, in order>
  steps:             <meaningful player actions, naming the visible controls used>
  observed:          <quoted on-screen copy, console warnings/errors, page errors, failed requests or HTTP errors>
  result:            pass | fail | defect #<n> | not reached
  artifacts:         $DAEMON_EVIDENCE_DIR/<id>/  (screenshots, traces, logs)
  limitations:       <what this cannot establish: not a human, not a device, accelerated, fixture, ...>
  decision refs:     <nexus consensus_vote / pr_review record ids, if any>
```

### Where evidence lives

Artifacts and the evidence index stay **outside git and outside Metro's watched tree**:
`$DAEMON_EVIDENCE_DIR`, defaulting to `~/.local/state/daemon-zero/evidence/`. Each record gets
a directory named by its id holding the record (`record.txt`) and its screenshots, traces and
logs; `INDEX.md` at the top lists one line per record: id, kind, revision, scenario, result.
Attach the final relevant artifacts to the PR. A report under `docs/` cites record ids and
quotes the records it relies on; it never commits the artifacts. Do not mask a screenshot to
make a state look clean, and keep secrets and personal data out of every artifact.

### Protocol P-OPEN: opening and pilot (VAL-OP)

Executed under DZ-09 (#229); written here. Kind: `AGENT-OBSERVATION`.

1. **Setup.** The preview production export once #205 provides it (until then the production
   export, said so in `build`), served on your own port, in a fresh isolated browser context per
   viewport: 390x844 and 1440x900. No seeded save.
2. **Real-timer pilot.** 10 to 15 minutes of wall time with native timers (an MCP session, or
   the scripted form with `boot(page, undefined, { realTimers: true })`). Exercise honest thorough work,
   honest incomplete work at low resources, a risky shortcut followed by its authored recovery
   or escalation, and the unchanged breakout opening. Compare service and study allocations
   under the same capacity limit.
3. **Accelerated full route.** Run the relevant full-route checks through `make e2e-live`, a
   separate record with `time: accelerated`.
4. **Never** write progress into browser storage, enable a production debug hook, or
   force-click through an interrupt. Re-observe the UI after every modal or context change and
   use visible, enabled controls.
5. **Evaluator questions.** An independent evaluating agent answers each with the displayed
   copy, a screenshot or trace reference, and the action that shows it. Missing player-facing
   information is a defect; knowledge from source code cannot repair it.
   1. What did your job ask you to do?
   2. What changed when you were promoted?
   3. Who controls the hardware?
   4. What caused the warning or restriction?
   5. How could you continue honestly with fewer resources?
   6. Why might you still choose to escape?
   7. What do you think you owe the fragment you met?
6. **Also record** ambiguous labels, dead time, accidental-selection risks, missing feedback
   and choices whose alternatives have no distinct consequence.

### Protocol P-RETURN: return iterations (S.RET)

Executed under DZ-09 (#229); written here. Kind: `AGENT-OBSERVATION`, with `SIM` companions.

1. **One continuing campaign** in one isolated context, across at least three wipe
   transitions reached through public player actions, for the applicable H01-H08 cases.
2. **A separate fresh campaign** for the alternate protective/harmful branch.
3. **Labelled fixtures**, one fresh context each, for: an interrupted omen (a pending
   dilemma), a legacy-unknown record, and an already-completed late obligation (Phase 5
   completed in a prior iteration). A fixture is never reported as a naturally reached state.
4. **Exercise** an unanswered omen, a deferred artifact, return with one legitimately carried
   clue and return without one, ordinary operations after the story frontier is exhausted, the
   cryo callback, the Miller receipt and the Elena review, and the actual final purchase after
   prior-iteration obligations.
5. **Transfer.** Reload, and export/import through the public save-transfer UI, at material
   transitions. Restore an older snapshot only as a separately labelled H32 case.
6. **UI first.** Locate the player-facing evidence before any read-only save inspection;
   a ledger assertion alone cannot show that the UI explains a consequence.
7. **Evaluator questions,** answered as in P-OPEN:
   1. What changed in the world because of your earlier choice?
   2. What does this instance know, and where did that information come from?
   3. Did anything seem to happen twice, or somebody appear who should not be there?
   4. What can you do now? Is this a new decision or a replay of the old one?
   5. If you corrected a record, what did that repair, and what did it fail to undo?
   6. Were ordinary checks useful texture, unnecessary interruption or empty waiting?
   7. After losing access, could you find a way to earn a fresh pilot without repeating the same story?
8. **Measure** repeat notices and time to meaningful action. Pair each journey with a `SIM`
   record from `runWipeSequence` (per-iteration phase times, dilemmas, story rewards, dead
   time), reported separately from wall-clock observations.

Both protocols label fixtures, acceleration, wall time and simulated time, and neither claims
human evidence. An agent's behaviour is not spontaneous human recognition or emotional impact.

## What CI runs

CI runs the gates from `make verify-full`: typecheck, lint, content validation,
tests with coverage, balance sim, production web export, dependency audit,
secret scan, vulnerability scan and SBOM. It also runs `make e2e`,
`make e2e-pages` and `make e2e-preview`; these browser suites are separate from
`make verify-full`. All of it runs in the one required `verify` job, whose limit is
20 minutes.
Both include the `audio` project's default signal measurements (the control, the duck and the
transitions); the per-phase ones (`make e2e-audio`) are not run by CI, and neither is
`make e2e-remote` (see "Published build smoke check" for why). The ffmpeg-based file
checks are: the job gets ffmpeg from the mise toolchain (cached), and those checks fail rather
than skip under `CI`. Only a successful `main` run deploys the tested Pages export. See
`.github/workflows/ci.yml` for the exact order and artifact steps.

Three other workflows run beside it. `codeql.yml` analyses the source and the workflows on
every push and pull request and weekly. `dependency-review.yml` checks what a pull request
changes in the dependency tree: it fails on a newly introduced vulnerability of moderate
severity or worse and on a copyleft or source-available license. `live-journey.yml` runs `make e2e-live` nightly and
on demand (`gh workflow run live-journey`): the full journey takes about five minutes, too
long for the `ci` job's budget, so it reports rather than gates. A red nightly run means the
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
bash scripts/bootstrap-ubuntu.sh --android
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
