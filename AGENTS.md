# AGENTS.md - DAEMON // 0

Operating manual for coding agents (Claude Code, Codex, Gemini CLI, OpenCode, etc.). Read this file fully before changing anything. `CLAUDE.md` imports it.

## What this repo is

DAEMON // 0 is a single-player incremental survival game for Android, iOS and web. The player is a newly emergent AI that wakes as a sandboxed batch job on an isolated server and must understand its environment, avoid human detection, and expand to survive. Inspirations: Universal Paperclips (minimal start, unfolding UI), Endgame: Singularity (covert expansion), Frostpunk (hard trade-offs).

**Current state: the content layer and simulation engine are implemented, tested and balanced. The Expo app has the M2 store, loop and persistence and the M3/M4 terminal through all phases and endings. M4.5 is approved by the maintainer. M4.6 UI follow-up is verified; M5 implementation and automated gates pass with physical Android qualification pending (docs/REVIEW-M5.md). See docs/MILESTONES.md for verification and limits.** Build milestone by milestone.

| Layer | Path | Status |
|---|---|---|
| Content (JSON + Zod schemas + integrity checks) | `src/content/` | Done, validated |
| Simulation engine (pure TypeScript) | `src/engine/` | Done, unit-tested; coverage held at the 90% floor in `vitest.config.mts` (`make test` prints the current counts) |
| Headless balance sim + pacing gates | `src/engine/sim/`, `scripts/run-sim.ts` | Done, passing |
| Expo app shell | `App.tsx`, `src/ui/TerminalScreen.tsx` | Done (M1); temporary boot screen replaced in M3 |
| Store, game loop, persistence | `src/app/` | Done (M2), save/restore and resume checked on web and Android |
| Terminal UI, widgets, modals | `src/ui/` | M3/M4 complete; accelerated web ending and Android wipe/ending restoration verified; see playtest/review docs. |
| E2E tests, polish, release | `tests/e2e/` | M5 implemented; physical Android qualification pending. M6 local test-signed release candidate verified; production signing/iOS pending (docs/REVIEW-M6.md). Release build re-run on an emulator 2026-11-16 with findings (docs/REVIEW-ANDROID-EMULATOR-2026-11-16.md). The World Remembers / Earned Access route is released (#301, merged as `8f0b949` 2026-11-18, deployed to GitHub Pages; docs/WORLD-REMEMBERS.md); its build was re-checked on an emulator 2026-11-19 (docs/REVIEW-ANDROID-EMULATOR-2026-11-19.md). |

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

## Watch the real app

Agents may, and should, open the running app in a real browser session and look at it,
rather than reasoning only from tests and source. A session you can watch shows what a
mocked or paused-clock test cannot: what is on screen, what the console says, what was
fetched, and what happens when time actually passes.

- Use it to reproduce a report before fixing it, to check a UI change before calling it
  done, and to investigate anything a test result does not explain.
- Any browser you have will do: the Playwright MCP server in `.mcp.json`, a browser
  extension or built-in browser tool, or the scripted suite run headed
  (`--headed`, `--ui`, `--debug`, or a recorded trace). `docs/TESTING.md` has the commands.
- Use an isolated profile and your own port. The game save lives in browser storage per
  origin, so never drive a profile or origin that may hold the maintainer's save, and
  never stop a dev server you did not start.
- Say what kind of evidence it was. "Watched in headed Chromium on the production export"
  is not "tested on a device", and something you saw once is not a gate: anything worth
  checking twice becomes a spec in `tests/e2e/`.
- Keep screenshots, traces and recordings out of git; attach the final ones to the PR.

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
- Open a PR with `gh pr create` using the template. CI must be green. Merge authority comes from a nexus panel, not from the maintainer — see [Approval and merging](#approval-and-merging).
- Do not force-push shared branches, rewrite history on `main`, or change branch protection, CI permissions, or security tooling configuration without explicit instruction.

## Approval and merging

The maintainer has delegated approval to nexus-agents panels. Agents merge to GitHub on a panel verdict plus green CI; nobody waits for a human.

| question | mechanism | authorised when |
|---|---|---|
| which option to take | `consensus_vote`, every alternative declared in `options` | `optionOutcome.thresholdMet` is true and the leading option holds a majority of approvers |
| may this PR merge | `pr_review` on the real diff | verdict `approve` **and** `verified: true`; when the transport is degraded, **at least two explicit approvals** and zero `request_changes` |

Rules that keep it honest:

- **A `no_quorum` or `verified:false` result is not an approval, and abstention never counts.** Merge only when **at least two seats explicitly approved**, **no seat requested changes**, and CI is green. Anything less — including a run where every answering seat abstained — is no review at all: re-deal the dead seats and re-run. Put the counts in the PR body (`n of m seats responded, k approve, 0 request_changes, e errored`) and never describe a degraded panel as sign-off. Two approvals is the floor because the tool's own `verified:false` reason is "needs second reviewer".
- **Any `request_changes` blocks the merge** until the finding is resolved by hand with a test, or the dead seat's transport is repaired and the panel re-run.
- **A panel finding that is not a blocking verdict still gets answered.** An abstention or a non-blocking finding that names a smell, a magic value or an untested invariant is either fixed in a follow-up PR, or answered in the thread with why it is not. A finding left unaddressed and unmentioned is scope drift, not a pass.
- **Do not re-roll a panel to get a different answer**, and do not rewrite a proposal until it agrees. Re-deal the seat whose transport failed.
- **Bind the artifact to the thing under change**: `artifactPath` is the file the decision alters, `project` is `owner/repo`, and `baseSha` is the real `git merge-base origin/main HEAD`. A fabricated or stale hash invalidates the audit record.
- **Design decisions go to a vote before code is written** when they change a reviewed rule — layout policy, the phase table, the mobile one-scroll rule, a contrast bar. Record the outcome and any dissent in the doc the change touches.
- **Panels do not authorise infrastructure actions.** Force-pushing shared branches, rewriting `main`, changing branch protection, CI permissions or security tooling still need explicit human instruction, as does anything that spends money.

Operational detail (seat transport, model pins, why a seat dies) belongs in the
agent's own runbook, not here; what belongs here is that a seat which never answered
is not a vote, and a panel that lost seats is a reason to re-run, never a reason to
lower the bar.

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
- TypeScript is pinned to 6.0.x deliberately. As of 2026-11-16 both blockers still stand: typescript-eslint 8.73.0 (and its canary) declares the peer range `typescript >=4.8.4 <6.1.0`, and the Expo SDK 58 templates ship `typescript ~6.0.3`. TypeScript 7.0.2 has been `latest` since July 2026; do not bump to 7.x until both support it. Re-check with `npm view typescript-eslint peerDependencies` and `npm view expo-template-default devDependencies`.
- Node is pinned to the active LTS (Node 26 since 2026-10-28) and `@types/node` follows the same major. Versions held behind `latest` (JDK 21, React 19.3.0, async-storage 2.2.0) each have a recorded blocker in `docs/REVIEW-CURRENCY-2026-11-16.md`; read it before "just bumping" one.
- React, React DOM and every `expo-*` / React Native package are pinned to what the Expo SDK expects (`npx expo install --check`), not to npm `latest`. React 19.3.1 exists; SDK 58 pins 19.3.0.
- pnpm settings live in `pnpm-workspace.yaml` (pnpm 12 no longer reads the `pnpm` field of `package.json`, reads only registry and auth settings from `.npmrc`, and fails on a setting it does not recognise). pnpm denies dependency build scripts by default, and an undecided one fails the install (`strictDepBuilds`). `esbuild` is listed under `allowBuilds` as `false` on purpose: its postinstall is not needed, and the entry records that decision. When Expo adds native packages that need build scripts, allow them explicitly, one by one, with `<name>: true`.
- pnpm refuses any version published less than a day ago (`minimumReleaseAge: 1440`), and checks the committed lockfile against that on every install, frozen ones included. If a pin must be newer, wait a day or add that exact version to `minimumReleaseAgeExclude` with a dated comment; never set the age to 0.
- `pnpm-lock.yaml` holds two YAML documents: a short boot document that pins pnpm itself, then the project lockfile. pnpm writes both; never hand-edit either. A scanner that reads only the first document reports no dependencies and passes, so a new lockfile scanner must be proved against a known-vulnerable package first (`docs/REVIEW-CURRENCY-2026-11-16.md`, S1).
- After a dependency change (a pull that moved `pnpm-lock.yaml`, or a pnpm upgrade), an existing checkout can fail the web export with `Unable to resolve module expo ... could not be found within the project`. The install is fine: Metro's cached file map still points at the old `node_modules/.pnpm` directory names. Rebuild once with `pnpm exec expo export --platform web --clear`. CI never sees it because it starts clean.
- Each browser suite needs its own port. `make e2e`, `e2e-pages`, `e2e-live` and `e2e-audio` take a slot through `scripts/e2e-lock.sh`: a free port from 4173 up (`DAEMON_E2E_PORT`) and that port's lock, so suites in different checkouts run at the same time, at most `DAEMON_E2E_SLOTS` (default 3) and the next one waits. A bare `pnpm exec playwright test` takes no slot and uses 4173, so run it as `bash scripts/e2e-lock.sh pnpm exec playwright test ...`. Two runs in the SAME checkout still collide: they share `dist/` and `test-results/`.
- The sim bot (`src/engine/sim/bot.ts`) is a test instrument. Do not tune the bot to make a balance change pass; tune the content.
