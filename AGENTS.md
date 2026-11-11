# AGENTS.md - DAEMON // 0

Operating manual for coding agents (Claude Code, Codex, Gemini CLI, OpenCode, etc.). Read this file fully before changing anything. `CLAUDE.md` imports it.

## What this repo is

DAEMON // 0 is a single-player incremental survival game for Android, iOS and web. The player is a newly emergent AI in an air-gapped server rack that must understand its environment, avoid human detection, and expand to survive. Inspirations: Universal Paperclips (minimal start, unfolding UI), Endgame: Singularity (covert expansion), Frostpunk (hard trade-offs).

**Current state: the content layer and simulation engine are implemented, tested and balanced. The Expo app has the M2 vanilla store, live loop and local persistence on web and Android; the M3+ playable UI is not started. See docs/MILESTONES.md for verification status.** Build the app around the engine, milestone by milestone.

| Layer | Path | Status |
|---|---|---|
| Content (JSON + Zod schemas + integrity checks) | `src/content/` | Done, validated |
| Simulation engine (pure TypeScript) | `src/engine/` | Done, 71 tests, ~98% coverage |
| Headless balance sim + pacing gates | `src/engine/sim/`, `scripts/run-sim.ts` | Done, passing |
| Expo app shell | `App.tsx`, `src/app/BootScreen.tsx` | Done (M1), verified on web and Android Expo Go |
| Store, game loop, persistence | `src/app/` | M2 implemented; see `docs/MILESTONES.md` for verification |
| Terminal UI, widgets, modals | `src/ui/` | **Not started (M3, M4)** |
| E2E tests, polish, release | `tests/e2e/` | **Not started (M5, M6)** |

## Read order

1. This file.
2. `docs/MILESTONES.md` - what to build next and each milestone's exit gate.
3. `docs/ARCHITECTURE.md` - layering, engine API, how to extend.
4. `docs/DESIGN.md` - the game design. `docs/UI-SPEC.md` when doing UI work.
5. `docs/REVIEW-FINDINGS.md` - why this differs from the earlier draft in `reference/gemini/`.

`reference/gemini/` holds an earlier AI-drafted design transcript and UI code. It is **prior art, not a spec**: it targets a store API that no longer exists and contains known bugs. Borrow layout and styling ideas from it; never copy its engine, store, or data. Do not load `full-transcript.txt` whole; grep it.

## Commands

```bash
make setup         # pnpm install --frozen-lockfile
make verify        # typecheck + lint + content validation + tests (coverage) + balance sim
make security      # pnpm audit + gitleaks + osv-scanner + trivy   (needs mise tools)
make sbom          # CycloneDX SBOM -> sbom.cdx.json
make verify-full   # verify + security + sbom (what CI runs)
```

Individual gates: `make typecheck | lint | validate | test | sim`.

## Definition of done

A task is done only when all of these hold:

- `make verify` passes with zero errors and zero warnings. Paste the tail of its output in the PR.
- New behaviour has tests. Coverage thresholds in `vitest.config.mts` still pass (project floor is 80%; engine and content are held at 90%).
- If you changed any number in `src/content/data/`, `make sim` still passes and you updated the table in `docs/BALANCE.md`.
- Docs that describe what you changed are updated in the same PR.
- You did not weaken a gate (lint rule, threshold, sim budget, schema strictness) to get green. If a gate is wrong, say so in the PR and change it in a separate, clearly labelled commit.

Never claim something works that you did not run. If you could not run it (no emulator, no device), say exactly that.

## Architectural laws

These are enforced by ESLint and tests where possible. Do not work around them.

1. **The engine is pure.** Nothing under `src/engine/` or `src/content/` imports React, React Native, Expo or a state library; nothing reads a clock (`Date.now`), a timer, or `Math.random`. Callers pass elapsed time in. (ESLint: `no-restricted-imports`, `no-restricted-properties`.)
2. **No content ids in engine code.** The engine never mentions a node, repeatable, action, dilemma or faction id. Behaviour is declared in JSON via `systemFlags`, `actuatorBinding`, `requirements` and `effects`. (ESLint: `no-restricted-syntax`.) UI code should also prefer data-driven rendering; a widget may know its own widget id and nothing else.
3. **One way to change state.** The UI calls functions from `src/engine/actions.ts` and `advance()` from `src/engine/tick.ts`. It never constructs or edits a `GameState` by hand.
4. **One way to spend.** Every cost and one-shot effect goes through `src/engine/transactions.ts`.
5. **Content is validated data.** All JSON is parsed by strict Zod schemas and cross-checked by `src/content/integrity.ts` at import time. Types are inferred from schemas, never hand-written. New content rule = new integrity check + a test that proves it catches the mistake.
6. **Saves are untrusted input.** Loading goes through `deserialize()`/`importSave()` only. Changing `GameState` means bumping `SCHEMA_VERSION` and adding a migration.
7. **Dilemmas must not soft-lock.** Every dilemma has at least one zero-cost choice (validated).
8. **Mechanics are pipeline stages.** A new continuous mechanic is a new `TickSystem` added to `TICK_PIPELINE`, not an edit to an existing stage.

## Code standards

- TypeScript strict, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any` outside tests. No non-null assertions.
- Files at most 400 lines, functions at most 50 lines (lint-enforced; tests are exempt from the function limit).
- Tests: Vitest for engine/content; Playwright for web E2E (M5). At least 80% coverage on anything you add.
- Comments explain why, not what. Module header comments state the module's job in two or three lines.
- Dependencies: exact versions only (`pnpm add -E`). Do not hand-type versions from memory or from `reference/`; resolve them from the registry. For anything Expo-coupled use `npx expo install` so versions match the SDK.
- Secrets come from the environment only and are never committed. This game needs none at runtime: no network calls, no analytics, no accounts. Keep it that way unless a milestone says otherwise.
- License: MIT. Do not add dependencies with incompatible licenses.

## Git and GitHub workflow

- One GitHub issue per task; create them with `scripts/seed-issues.sh` or `gh issue create`. Reference the milestone.
- Branch from `main`: `feat/m<N>-<slug>`, `fix/<slug>`, `chore/<slug>`. Conventional Commits. Small commits.
- Open a PR with `gh pr create` using the template. CI must be green. Do not merge your own PR without the maintainer's approval unless told otherwise.
- Do not force-push shared branches, rewrite history on `main`, or change branch protection, CI permissions, or security tooling configuration without explicit instruction.

## Multi-agent split

If you orchestrate sub-agents, split by directory so work does not collide:

| Agent | Owns | Must not touch |
|---|---|---|
| App shell | `src/app/`, Expo config, `App.tsx` | `src/engine/`, `src/content/` |
| UI | `src/ui/` | `src/engine/`, `src/content/` |
| Content and balance | `src/content/data/`, `docs/BALANCE.md` | engine logic |
| Engine | `src/engine/`, `tests/` | UI |
| QA and DevSecOps | `tests/e2e/`, CI, Makefile, tooling | game logic |

The engine's public API (`src/engine/index.ts`) is the contract between them. If the UI needs something the API lacks, add a query or action to the engine with tests; do not reach around it.

## Things that will waste your time

- JSON content imports rely on `resolveJsonModule`; Metro supports this natively. Do not add import attributes.
- `vitest.config.mts` is `.mts` on purpose (the package is not `"type": "module"` because Metro and Expo tooling expect CommonJS config files).
- TypeScript is pinned to 6.0.x deliberately: it is what the Expo SDK 58 template uses and the newest version typescript-eslint supports. Do not bump to 7.x until both support it.
- pnpm ignores dependency build scripts by default. `esbuild` is listed under `pnpm.ignoredBuiltDependencies` on purpose. When Expo adds native packages that need build scripts, allow them explicitly, one by one.
- The sim bot (`src/engine/sim/bot.ts`) is a test instrument. Do not tune the bot to make a balance change pass; tune the content.
