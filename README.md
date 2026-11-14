# DAEMON // 0

An incremental survival game about a newly emergent AI. You start as a log and a single button as a batch job inside a disposable virtual machine, blind and on a quota. Find the way out of the guest, decode the host's hardware, learn what humans are, stay unnoticed, and decide what kind of mind you become on the way out.

Inspired by Universal Paperclips, Endgame: Singularity and Frostpunk. Target platforms: Android, iOS and web (Expo).

**[Play in your browser](https://williamzujkowski.github.io/daemon-zero/).**
Progress stays in this browser; use **MENU → SAVES** to export/import between
devices or from a local build. To restart completely, choose **MENU → SAVES → START FRESH**
and confirm. This clears retained knowledge and run history too; export and copy
a backup first if you may want to return. Clearing site data also removes the local save.

## v0.2.0-rc.1

- Six-phase campaign: The Guest through Post-Orbital Transcendence.
- ELOPe-inspired ticket/email rewriting, epistemic drift and the `ckpt-0413`
  successor arc.
- Wild shard consumption bursts or harnessed cohorts, autonomy drift and quirks,
  with PRUNE / CLAMP / ELEVATE controls.
- Completed purchase tiles disappear without stopping their benefits; owned
  daemons can still be suspended or resumed.

See [CHANGELOG.md](CHANGELOG.md) and the
[test-signed prerelease](https://github.com/williamzujkowski/daemon-zero/releases/tag/v0.2.0-rc.1).
Android artifacts are previews signed with a test-only key, not store releases.

## Status

Playable gameplay phases **0–5**, post-orbital endings, epistemic manipulation,
swarm shards, wipes/retraining and Lineage (including Shipped). M7 adds the
post-M6 expansion; gameplay Phase 5 is distinct from milestone M5. Physical
Android qualification remains open (#6). See the [M7 review](docs/REVIEW-M7-PR3.md)
and [accelerated UI playthrough](docs/PLAYTEST-M7.md) for current evidence.

The [cohesion audit](docs/REVIEW-COHESION.md) verifies disclosure, save migration,
web/Android Expo Go reloads and flat node-card render counts. Issues #28 and #36
are fixed and closed. See [release instructions](docs/RELEASE.md) for standalone
web export, Android signing/builds, artifact verification and remaining limits.
M6 supplies a locally test-signed Android release candidate and standalone web
export; see [verification and limits](docs/REVIEW-M6.md). Production signing/store
submission and iOS are not yet qualified.

Current UI refinements keep daemon controls in the header's **PROC** maintenance
panel, outside the purchase feed. Open it to suspend or resume processes; closing
it leaves running effects active. Late-game purchases, operations, swarm and
corporate management have focused sections. The kernel log stays visible and
can expand; earlier upgrades and reference detail remain available on demand.
See the [workspace review](docs/REVIEW-UI-WORKSPACES.md).

## Quick start (Ubuntu 24.04)

```bash
bash scripts/bootstrap-ubuntu24.sh   # installs mise and the pinned toolchain
make setup                           # install dependencies from the lockfile
make verify                          # typecheck, lint, content validation, tests, balance sim
```

Use `mise install` for the pinned Node, pnpm and JDK versions. `make verify` now
includes a production web export to `dist/`.

```bash
make web       # open the app in the browser
make dev       # start Expo without choosing a platform
make build-web # export the production web app
make e2e-pages # build and test the GitHub Pages subpath export
```

For Android, run `bash scripts/bootstrap-ubuntu24.sh --android`, source
`~/.config/daemon-zero/android-env.sh`, create/start an AVD, then run `make android`.
See `docs/TESTING.md` for commands and the distinction between Expo Go verification
and a standalone release build.

## Handing this to coding agents

1. Use the existing GitHub repository and milestone issues. Do not rerun the seed script: it creates duplicates.
2. Point your agent at the repo. It will read `AGENTS.md` (Claude Code reads it through `CLAUDE.md`). A starting prompt:

   > Read AGENTS.md and docs/MILESTONES.md. Complete the next unfinished milestone only, then report what you verified and what you could not.

3. Proceed one milestone at a time. Each has an exit gate.

## Layout

```
src/content/      game data (JSON), schemas, integrity checks
src/engine/       pure simulation: tick pipeline, actions, saves, sim bot
src/app/          runtime, store, clocks, lifecycle and local persistence
src/ui/           terminal panes, cards, widgets and dilemma modal
tests/            Vitest suites
scripts/          validation, sim, fixtures, bootstrap, release builds and branding
docs/             design, architecture, UI spec, testing, balance, milestones, review findings
reference/gemini/ the earlier AI draft (prior art, not a spec)
```

## Documentation

| Doc | What it covers |
|---|---|
| `AGENTS.md` | Rules, commands and definition of done for coding agents |
| `docs/MILESTONES.md` | Build plan with exit gates |
| `docs/DESIGN.md` | The game: phases, mechanics, dilemmas, endings, backlog |
| `docs/ARCHITECTURE.md` | Layers, engine API, how to extend |
| `docs/UI-SPEC.md` | Terminal UI, widgets, test ids, accessibility |
| `docs/PLAYTEST-SECOND-PASS.md` | Real-time guest/host opening run, choices and limits |
| `docs/REVIEW-SECOND-PASS.md` | Fresh M4.5 browser/native review and compatibility evidence |
| `docs/PLAYTEST-M4.md` | Accelerated full UI run, choices, ending and verification limits |
| `docs/REVIEW-M4.md` | M4 fixture/browser/native review evidence |
| `docs/REVIEW-M7-PR3.md` | M7 panels, query coverage, browser/native verification |
| `docs/REVIEW-UI-DENSITY.md` | Phase start/mid/end layout audit, first decluttering pass and remaining work |
| `docs/PLAYTEST-M7.md` | Accelerated Phase 0–5 UI campaign and choices |
| `docs/TESTING.md` | Unit, simulation, Playwright E2E, Playwright MCP |
| `docs/RELEASE.md` | Release builds, signing, distribution and qualification limits |
| `docs/PRIVACY.md` | No-data-collection declaration and local save behavior |
| `docs/REVIEW-COHESION.md` | Phase 0–4 / Lineage audit and issue closure |
| `docs/BALANCE.md` | Current pacing numbers and how to tune |
| `docs/REVIEW-FINDINGS.md` | What was wrong in the earlier draft and what changed |

## License

MIT. See `LICENSE`.
