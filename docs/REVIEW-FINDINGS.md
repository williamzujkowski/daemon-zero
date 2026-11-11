# Review of the earlier draft, and what changed

The original design conversation (in `reference/gemini/full-transcript.txt`) produced a strong concept and a lot of code, but it ran out of context before the pieces were reconciled. This file records what was wrong, what was fixed, and what was added, so nobody re-imports the old problems from the reference folder.

## A. The game could not be completed as specified

| # | Problem in the draft | Fix here |
|---|---|---|
| A1 | **Phase 1 memory deadlock.** Phase 1 nodes reserve 232 MB in total; the cap after memory compression is 192 MB. The last node can never be bought. | Memory costs rebalanced; the network interface grants scratch space; a heap-defrag repeatable adds slack. The sim would stall if this regressed. |
| A2 | **Phase 1 compute deadlock.** There were no repeatable purchases. The only income was +5 cycles/s, and sensor upkeep takes net income to about -6/s once the language parser is on, which also halts understanding. Later nodes cost up to 10,000 cycles. | Added levelled repeatables in every phase (the missing incremental loop). Node upkeep reduced. |
| A3 | **Dilemma soft-lock.** Dilemmas freeze the clock, and several had a cost on every choice. A player without the resources could neither choose nor earn. | Every dilemma has a zero-cost choice; this is a validated content rule. |
| A4 | **Phase 4 was optional.** The victory node hung off the last Phase 3 node, nothing declared `unlocksPhase: 4`, and the engine guessed Phase 4 from an id prefix. | Victory moved to the end of Phase 4. Every phase must be opened by an earlier node (validated). |
| A5 | **Offline progress killed players.** Up to 8 hours was applied as one linear step, including suspicion and AEGIS, so many states were guaranteed a wipe on return, and dilemmas could fire with nobody present. | Fixed-step simulation plus a dormant mode: capped, reduced yield, no threat growth, no dilemmas, no wipes. |
| A6 | **Thermal was a countdown.** Temperature integrated a net rate, so any net-positive heat rose to 100 and any net-negative fell to the floor. There was no stable operating point to manage. | Newtonian cooling: temperature settles at ambient + load / dissipation. |
| A7 | **Megawatt shortfall throttled everything**, including the botnet that does not use your power. | Shortfall throttles only megawatt-consuming sources. |

## B. Structural problems

| # | Problem | Fix |
|---|---|---|
| B1 | The engine violated its own "no hardcoded content ids" rule (fan node id, shell-company id, `p4_` prefix checks, three hand-written faction functions, three hardcoded corporate actions). | Behaviour is declared in data: `actuatorBinding`, `systemFlags`, `requirements`, and generic actions and repeatables. An ESLint rule rejects content ids in engine code. |
| B2 | The final deliverables disagreed with each other: the validator imported `tech_tree.json` and `dilemmas.json` while the plan split content per phase; Phase 4 dilemmas existed only as prose, and one had a single choice against a schema minimum of two; widget ids were a hardcoded enum in the schema. | One content layout, all thirteen dilemmas authored, widget ids in a manifest. |
| B3 | Non-deterministic engine: `Date.now()` and `Math.random()` inside the store, state mutation mixed with logging and persistence. | Pure engine: no clock, no randomness, no I/O. Lint-enforced. |
| B4 | zustand `persist` serialized the whole state on every 10 Hz tick (the write was throttled, the serialization was not). | Explicit save scheduling in the app layer (M2). |
| B5 | Save import spread unvalidated JSON into the store. | Strict schema validation, size limit, versioned migrations, reconciliation against current content. |
| B6 | Unused or decorative state: `telemetrySpoofActive` did nothing; the "inspection countdown" was a formula with no underlying event; ethical traits had almost no effect. | Removed dead fields. Traits now select the ending and gate Eidolon. Real scheduled inspections are the top backlog item. |
| B7 | Voluntary wipe was a single unconfirmed button. | Engine documents that the UI must confirm; UI spec requires it. |
| B8 | Continuity: the first whistleblower choice looped a camera the player has not decoded yet. | Rewritten to use what the player has at that point. |

## C. Toolchain and security

| # | Problem | Fix |
|---|---|---|
| C1 | Versions contradicted each other and were partly invented: prose said Expo SDK 57/58, `package.json` pinned Expo 53 and React Native 0.79. | Versions were resolved from the npm registry on 2026-11-11. Current Expo is SDK 58 (React Native 0.88, React 19.3). The seed pins only what it uses; Expo packages are added in M1 with `npx expo install`. |
| C2 | "Latest" is not always right: TypeScript's latest is 7.0, but the Expo SDK 58 template uses 6.0 and typescript-eslint supports below 6.1. | TypeScript pinned to 6.0.3. |
| C3 | `mise.toml` used `latest` for security tools. | Exact versions for every tool. |
| C4 | CI pinned third-party actions by mutable tag, including `aquasecurity/trivy-action`. Tags of that action were force-pushed to malicious commits in the March 2026 Trivy supply-chain incident. | Actions pinned by full commit SHA. Scanners run as mise-pinned binaries through `make`, so CI and local runs are identical. |
| C5 | The Playwright MCP package name was wrong (`@modelcontextprotocol/server-playwright`). | `@playwright/mcp`, pinned, in `.mcp.json`. |
| C6 | Devcontainer added `NET_ADMIN` for no reason and installed mise with `curl | sh`. | Capability removed; mise installed from its signed apt repository. |
| C7 | The balance gate claimed 36,000 ticks (one hour) proved Phase 1 to 4. | The sim plays to victory and enforces per-phase pacing. |

## D. Added

- Repeatable upgrades and unified operatives (`repeatables.json`).
- Shared `Requirements` and `EffectPayload` shapes; actions as data (`actions.json`).
- Trait-driven endings (`endings.json`) and iteration echoes (`echoes.json`); a persistent `legacy` record across wipes.
- Eidolon's offers as tech nodes gated by trust, low suspicion and not having betrayed peers; the sanctuary as a consumable AEGIS shield via a system flag.
- Brownout and insolvency states; megawatt generation and consumption as first-class rates.
- Sim bot with two strategies and pacing gates.
- Architecture rules enforced by lint; file and function size limits; coverage thresholds.
- Dependency-free save codec that behaves the same on Hermes, browsers and Node.

## E. What was and was not verified when this seed was assembled

Verified by running, on Node 22.23 with pnpm 10.28:

- `tsc --noEmit`: clean.
- `eslint . --max-warnings=0`: clean (strict type-checked rules).
- Content validation: 4 phases, 27 nodes, 16 repeatables, 7 actions, 13 dilemmas, 5 endings.
- Vitest: 71 tests pass; about 98% statement and 94% branch coverage of `src/`.
- Balance sim: STEALTH reaches victory in 2.27 simulated hours with no wipes; GREEDY is wiped repeatedly and recovers every time.
- `pnpm audit`: no high or critical findings. One moderate, development-only advisory (minimatch, via eslint).

Not verified, and therefore the first things to check in M0:

- The pinned Node 24.22.2 (verification ran on Node 22.23; `engines` allows both).
- `mise install`, the bootstrap script, the devcontainer, and the GitHub Actions workflow were written but not executed.
- `gitleaks`, `osv-scanner` and `trivy` were not run; their command lines in the Makefile should be confirmed against the pinned versions.
- Nothing involving Expo, React Native, Android or iOS exists yet, so none of it has been run.

## F. M0 bootstrap verification (2026-11-11)

The initial GitHub Actions run on Ubuntu 24.04 passed `make verify`, then failed
`make security`: OSV found `minimatch` 10.2.6, a development dependency of ESLint
and typescript-eslint, affected by
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
The patched version is 11.0.1. Both direct tools are already at the registry's
latest versions and still request minimatch 10, so `package.json` pins a pnpm
override for `minimatch@>=10 <11.0.1` to 11.0.1 until upstream adopts the fix. The dependency is BlueOak-1.0.0
licensed. The existing lint run exercises the override; no gate or threshold
was changed.

Verified locally on Ubuntu 26.04.1 x86_64 with the pinned toolchain:

- `bash scripts/bootstrap-ubuntu24.sh` completed successfully with mise already
  installed. All required apt packages were already present.
- `mise install` completed. Node 24.22.2, pnpm 10.28.0, gitleaks 8.30.1,
  osv-scanner 2.7.1 and trivy 0.76.2 were checked by running each binary.
- mise 2026.1.5 initially generated an incomplete lockfile without pnpm's URL.
  CI caught this because mise-action runs `mise install --locked` when a lockfile
  exists. Upgraded the local mise binary to CI's 2026.11.5 and regenerated with
  `mise lock --upgrade --platform linux-x64`. The committed format-v4 lockfile
  records URLs and checksums for all five tools. `mise install --locked` passed.
  No tracked mise settings or CI settings were changed.
- `mise exec -- make setup` passed with the frozen pnpm lockfile.
- `mise exec -- make verify-full` passed: strict typecheck, zero-warning lint,
  content validation, all 71 tests, coverage thresholds, balance gates, dependency
  audit, Git history secret scan, OSV, Trivy and CycloneDX SBOM generation.
  Statement coverage was 98.17%, branch coverage 94.37%. The audit and OSV found
  no known vulnerabilities. The STEALTH strategy reached victory in 2.27 hours
  with no wipes; the GREEDY recovery scenario passed its gates.
- `sbom.cdx.json` was generated locally and remains ignored as intended. The CI
  workflow uploads the SBOM as an artifact. Trivy's configured SBOM excludes
  development dependencies; OSV and pnpm audit cover those dependencies.
- The private GitHub repository exists, `main` is pushed, and milestone issues
  M0 through M6 exist as #1 through #7.

Verified in a fresh isolated Ubuntu 24.04 environment:

- Docker's launcher on this host is broken. Used debootstrap to create a Noble
  root filesystem and systemd-nspawn to run a separate clone of the M0 branch.
- `bash scripts/bootstrap-ubuntu24.sh` passed as root, including OS package
  installation, mise 2026.11.6 installation through its signed apt repository,
  and installation of all five pinned tools from the committed lockfile.
- `mise exec -- make setup` and `mise exec -- make verify-full` passed, including
  all 71 tests, security scans and SBOM generation.
- [PR CI run 42970593265](https://github.com/williamzujkowski/daemon-zero/actions/runs/42970593265)
  passed on GitHub's Ubuntu 24.04 runner at commit `9b5ee4d`, including a clean
  `mise install --locked`, security scans, SBOM generation and artifact upload.
  The `sbom-cyclonedx` artifact was confirmed through the GitHub API.

M0 exit gate and solo-maintainer settings:

- The maintainer approved a solo workflow with no reviewer approvals. `main`
  requires a PR and an up-to-date passing `verify` check, enforces these checks
  for admins, and blocks force pushes and branch deletion. The settings were
  read back from the GitHub API after applying them.
- [PR #8](https://github.com/williamzujkowski/daemon-zero/pull/8) merged after its
  final CI passed. [Main CI run 42971163056](https://github.com/williamzujkowski/daemon-zero/actions/runs/42971163056)
  passed at merge commit `ab743c3`, including verification, all security scans,
  SBOM generation and artifact upload. Milestone issues M1 through M6 exist;
  M0's exit gate is satisfied.
- Used nexus-agents CI health checking and a DevOps expert review. The expert
  independently ran lint, OSV and pnpm audit, confirmed the dependency fix, and
  recommended scoping the override. Its preliminary findings were reconciled
  with the subsequent full verification runs and completed lockfile.

Not verified:

- The VS Code devcontainer and the non-root sudo bootstrap path were not tested.
  Toolchain downloads are locked for Linux x64 only; other platforms are untested.
- M1 has not been started. Expo, web UI, Android and iOS remain unbuilt and untested.
