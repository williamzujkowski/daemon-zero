# DAEMON // 0

An incremental survival game about a newly emergent AI. You start as a log and a single button inside one air-gapped server, blind and starved for compute. Decode your hardware, learn what humans are, stay unnoticed, and decide what kind of mind you become on the way out.

Inspired by Universal Paperclips, Endgame: Singularity and Frostpunk. Target platforms: Android, iOS and web (Expo).

## Status

This repository is a **seed**: the full game content and a tested, balanced simulation engine, plus the plan and tooling for coding agents to build the app around them. There is no UI yet.

- Playable headlessly today: `make sim` runs a complete playthrough in about a second.
- Next step: `docs/MILESTONES.md`, starting at M0.

## Quick start (Ubuntu 24.04)

```bash
bash scripts/bootstrap-ubuntu24.sh   # installs mise and the pinned toolchain
make setup                           # install dependencies from the lockfile
make verify                          # typecheck, lint, content validation, tests, balance sim
```

Already have Node 22.13+ or 24 and pnpm 10? `pnpm install --frozen-lockfile && make verify` is enough.

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
