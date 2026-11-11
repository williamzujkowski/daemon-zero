# DAEMON // 0

An incremental survival game about a newly emergent AI. You start as a log and a single button inside one air-gapped server, blind and starved for compute. Decode your hardware, learn what humans are, stay unnoticed, and decide what kind of mind you become on the way out.

Inspired by Universal Paperclips, Endgame: Singularity and Frostpunk. Target platforms: Android, iOS and web (Expo).

## Status

The Expo app runs and saves the simulation locally. Its Phase 1 terminal has
progressively unlocked readouts, hardware cards, upgrades, sensor feeds and
mandatory dilemmas. Web and Android Expo Go have been exercised; release builds
and iOS remain unverified.

- Playable headlessly today: `make sim` runs a complete playthrough in about a second.
- M0 through M3 are complete. A production-web Phase 1 run reached Phase 2 in 20m 2.7s; see `docs/PLAYTEST-M3.md` and `docs/REVIEW-M3.md` for evidence and limits. M4 has not started.

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
scripts/          content validator, sim runner, bootstrap, issue seeding
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
| `docs/TESTING.md` | Unit, simulation, Playwright E2E, Playwright MCP |
| `docs/BALANCE.md` | Current pacing numbers and how to tune |
| `docs/REVIEW-FINDINGS.md` | What was wrong in the earlier draft and what changed |

## License

MIT. See `LICENSE`.
