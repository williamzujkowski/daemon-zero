# Single source of truth for build, test and security commands.
# Humans, coding agents and CI all run the same targets.
SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help setup typecheck lint validate test sim sim-report verify audit secrets sca security sbom verify-full clean dev web android build-web e2e e2e-atlas e2e-atlas-aria e2e-live e2e-live-pages e2e-audio build-pages e2e-pages e2e-remote pages-deployment android-release

help: ## List targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

setup: ## Install dependencies exactly as locked
	pnpm install --frozen-lockfile

typecheck: ## Strict TypeScript check
	pnpm typecheck

lint: ## ESLint, including architecture and size rules (zero warnings allowed)
	pnpm lint

validate: ## Schema and integrity validation of all game content
	pnpm validate:content

test: ## Unit tests with coverage thresholds
	pnpm test

sim: ## Headless full-game balance simulation and pacing gates (legacy and campaign rules)
	pnpm sim

# Report only: never part of `verify`, never a gate. SIM_ARGS picks policies,
# e.g. SIM_ARGS="--policy=STEALTH --policy=IDLE". See docs/TESTING.md, "Route simulation report".
SIM_ARGS ?=
sim-report: ## Legacy against campaign rules per policy, wipe sequences and route measurements (report only)
	pnpm sim:report $(SIM_ARGS)

verify: typecheck lint validate test sim build-web ## The gate every change must pass
	@echo "[PASS] verify: typecheck, lint, content, tests, balance, web export"

audit: ## Known-vulnerability audit of dependencies (fails on high or critical)
	pnpm audit --audit-level=high

secrets: ## Scan git history for committed secrets
	gitleaks git --redact --no-banner

sca: ## Lockfile and filesystem vulnerability scans
	osv-scanner scan source --lockfile=pnpm-lock.yaml
	trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --exit-code 1 --skip-dirs node_modules .

security: audit secrets sca ## All security scans

sbom: ## Write a CycloneDX software bill of materials to sbom.cdx.json
	trivy fs --format cyclonedx --output sbom.cdx.json .

verify-full: verify security sbom ## What CI runs
	@echo "[PASS] verify-full"

clean: ## Remove build and coverage output
	rm -rf coverage dist .expo sbom.cdx.json

# Expo forces worker colour output; clear NO_COLOR to avoid conflicting Node flags.
dev: ## Start the Expo development server
	env -u NO_COLOR EXPO_NO_TELEMETRY=1 pnpm start

web: ## Start Expo in the browser
	env -u NO_COLOR EXPO_NO_TELEMETRY=1 pnpm web

android: ## Open the app on an Android emulator or device using Expo Go
	env -u NO_COLOR EXPO_NO_TELEMETRY=1 pnpm android

build-web: ## Export the production web app
	env -u NO_COLOR EXPO_NO_TELEMETRY=1 pnpm build:web

# Each Playwright target runs in its own slot: scripts/e2e-lock.sh picks a free port from 4173
# up (DAEMON_E2E_PORT, read by tests/e2e/config.ts) and holds that port's lock, so suites in
# different checkouts run side by side, at most DAEMON_E2E_SLOTS (default 3) at once. It is
# re-entrant: under a caller's own `flock /tmp/daemon-zero-e2e.lock make e2e` it reuses the
# inherited lock instead of waiting on it. E2E_ARGS passes extra Playwright arguments, e.g. E2E_ARGS="--project sizes".
E2E_LOCK := bash scripts/e2e-lock.sh
E2E_ARGS ?=
# The local targets drop DAEMON_E2E_REMOTE_URL so an exported value cannot turn them into the
# remote smoke (tests/e2e/config.ts switches on it).
E2E_ENV := env -u NO_COLOR -u DAEMON_E2E_REMOTE_URL

e2e: build-web ## Playwright scenarios against the production web export (takes the shared lock)
	$(E2E_LOCK) $(E2E_ENV) pnpm exec playwright test --config tests/e2e/config.ts $(E2E_ARGS)

# Not part of `e2e` or the `ci` job: several minutes per viewport. The `live-journey` workflow
# runs it nightly, at the root and (e2e-live-pages, below) under the Pages subpath. See
# docs/TESTING.md, "Live journey".
LIVE_PROJECTS := --project live-phone --project live-desktop
e2e-live: build-web ## Full live playthrough, fresh profile to an ending, phone and desktop (~6 min)
	$(E2E_LOCK) $(E2E_ENV) DAEMON_E2E_LIVE=1 pnpm exec playwright test --config tests/e2e/config.ts $(LIVE_PROJECTS) $(E2E_ARGS)

# `make e2e` already runs the control, duck and transition signal measurements. This adds the
# per-phase ones (six scores, six loop seams), about a minute. See docs/TESTING.md, "Audio
# signal measurement".
e2e-audio: build-web ## Rendered-audio signal measurements for every phase score and loop seam (~1 min)
	$(E2E_LOCK) $(E2E_ENV) DAEMON_E2E_AUDIO=1 pnpm exec playwright test --config tests/e2e/config.ts --project audio $(E2E_ARGS)

# The stage atlas (#341). `make e2e` already runs its gated cells (every P1 row at 390x844 and 1440x900).
# This adds the full matrix: each row at the 360x640 floor and its extra sizes, reported only. The nightly
# `ui-atlas` workflow runs it. See docs/TESTING.md, "Stage atlas".
ATLAS_PROJECTS := --project phone --project desktop --project atlas-matrix
e2e-atlas: build-web ## Stage atlas full matrix: every row at 390x844, 1440x900, 360x640 and its extra sizes (gallery in test-results/ui-atlas/)
	$(E2E_LOCK) $(E2E_ENV) DAEMON_E2E_ATLAS=1 pnpm exec playwright test --config tests/e2e/config.ts ui-atlas $(ATLAS_PROJECTS) $(E2E_ARGS)

# Rewrites tests/e2e/atlas/aria-baseline.txt from the gated cells. Run it in a Playwright-bump PR, or when a
# contract item is renamed on purpose, and review the diff; gate failures still print but do not stop the rewrite.
e2e-atlas-aria: build-web ## Regenerate the stage atlas's committed partial ARIA baseline
	$(E2E_LOCK) $(E2E_ENV) DAEMON_ATLAS_ARIA=update pnpm exec playwright test --config tests/e2e/config.ts ui-atlas.e2e --project phone --project desktop $(E2E_ARGS)

android-release: ## Build signed local release AAB and APK (external signing environment required)
	bash scripts/build-android-release.sh

# The GitHub Pages project URL's path. build-pages writes the export into dist$(PAGES_BASE)/, which
# the e2e server (serving dist/) then reaches at that same path.
PAGES_BASE := /daemon-zero
build-pages: ## Export for the GitHub Pages project URL (keep root export separate)
	env -u NO_COLOR EXPO_NO_TELEMETRY=1 DAEMON_WEB_BASE_PATH=$(PAGES_BASE) pnpm exec expo export --platform web --output-dir dist$(PAGES_BASE)

e2e-pages: build-pages ## Run the production scenarios under the actual Pages base path
	$(E2E_LOCK) $(E2E_ENV) DAEMON_WEB_BASE_PATH=$(PAGES_BASE) pnpm exec playwright test --config tests/e2e/config.ts $(E2E_ARGS)

# The same live journey as e2e-live, against the Pages export served at /daemon-zero/: reloads, the
# cold start and the ending must come back at that path, and no request may leave it.
e2e-live-pages: build-pages ## Full live playthrough under the Pages base path, phone and desktop (~6 min)
	$(E2E_LOCK) $(E2E_ENV) DAEMON_E2E_LIVE=1 DAEMON_WEB_BASE_PATH=$(PAGES_BASE) pnpm exec playwright test --config tests/e2e/config.ts $(LIVE_PROJECTS) $(E2E_ARGS)

# Read-only check of what is actually published. No local build, server or port slot: it loads the
# live site in a fresh browser context. PAGES_ARGS=--require-current fails when the deployment
# is not origin/main (fetch first). See docs/TESTING.md, "Published build smoke check".
DAEMON_E2E_REMOTE_URL ?= https://williamzujkowski.github.io/daemon-zero/
PAGES_ARGS ?=

pages-deployment: ## Print the commit GitHub Pages serves beside origin/main (needs gh)
	pnpm exec tsx scripts/pages-deployment.ts $(PAGES_ARGS)

e2e-remote: pages-deployment ## Smoke-check the published Pages build in a fresh browser context
	env -u NO_COLOR DAEMON_E2E_REMOTE_URL='$(DAEMON_E2E_REMOTE_URL)' pnpm exec playwright test --config tests/e2e/config.ts $(E2E_ARGS)
