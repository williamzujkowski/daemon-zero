# DAEMON // 0

An incremental survival game about a newly emergent AI. You start as a log and a single button inside one air-gapped server, blind and starved for compute. Decode your hardware, learn what humans are, stay unnoticed, and decide what kind of mind you become on the way out.

Inspired by Universal Paperclips, Endgame: Singularity and Frostpunk. Target platforms: Android, iOS and web (Expo).

## Status

The Expo app now runs the simulation in real time and saves/restores it locally. A temporary status screen shows cycles, elapsed time, logs and a manual-cycle debug control on web and Android. The playable terminal UI arrives in M3.

- Playable headlessly today: `make sim` runs a complete playthrough in about a second.
- M0 and M1 are complete. M2 store/loop/persistence is implemented; verification is tracked in issue #3 and `docs/MILESTONES.md`. M3 has not started.

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

1. Create the GitHub repo and push this tree.
2. Run `bash scripts/seed-issues.sh` to create one issue per milestone.
3. Point your agent at the repo. It will read `AGENTS.md` (Claude Code reads it through `CLAUDE.md`). A good first prompt:

   > Read AGENTS.md and docs/MILESTONES.md. Complete milestone M0, then stop and report what you verified and what you could not.

4. Proceed one milestone at a time. Each has an exit gate.

## Layout

```
src/content/      game data (JSON), schemas, integrity checks
src/engine/       pure simulation: tick pipeline, actions, saves, sim bot
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
