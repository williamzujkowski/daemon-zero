# Single source of truth for build, test and security commands.
# Humans, coding agents and CI all run the same targets.
SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help setup typecheck lint validate test sim verify audit secrets sca security sbom verify-full clean dev web android build-web e2e e2e-live e2e-audio build-pages e2e-pages e2e-remote pages-deployment android-release

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

sim: ## Headless full-game balance simulation and pacing gates
	pnpm sim

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
# runs it nightly. See docs/TESTING.md, "Live journey".
e2e-live: build-web ## Full live playthrough, fresh profile to an ending, phone and desktop (~6 min)
	$(E2E_LOCK) $(E2E_ENV) DAEMON_E2E_LIVE=1 pnpm exec playwright test --config tests/e2e/config.ts --project live-phone --project live-desktop $(E2E_ARGS)

# `make e2e` already runs the control, duck and transition signal measurements. This adds the
# per-phase ones (six scores, six loop seams), about a minute. See docs/TESTING.md, "Audio
# signal measurement".
e2e-audio: build-web ## Rendered-audio signal measurements for every phase score and loop seam (~1 min)
	$(E2E_LOCK) $(E2E_ENV) DAEMON_E2E_AUDIO=1 pnpm exec playwright test --config tests/e2e/config.ts --project audio $(E2E_ARGS)

android-release: ## Build signed local release AAB and APK (external signing environment required)
	bash scripts/build-android-release.sh

build-pages: ## Export for the GitHub Pages project URL (keep root export separate)
	env -u NO_COLOR EXPO_NO_TELEMETRY=1 DAEMON_WEB_BASE_PATH=/daemon-zero pnpm exec expo export --platform web --output-dir dist/daemon-zero

e2e-pages: build-pages ## Run the production scenarios under the actual Pages base path
	$(E2E_LOCK) $(E2E_ENV) DAEMON_WEB_BASE_PATH=/daemon-zero pnpm exec playwright test --config tests/e2e/config.ts $(E2E_ARGS)

# Read-only check of what is actually published. No local build, server or port slot: it loads the
# live site in a fresh browser context. PAGES_ARGS=--require-current fails when the deployment
# is not origin/main (fetch first). See docs/TESTING.md, "Published build smoke check".
DAEMON_E2E_REMOTE_URL ?= https://williamzujkowski.github.io/daemon-zero/
PAGES_ARGS ?=

pages-deployment: ## Print the commit GitHub Pages serves beside origin/main (needs gh)
	pnpm exec tsx scripts/pages-deployment.ts $(PAGES_ARGS)

e2e-remote: pages-deployment ## Smoke-check the published Pages build in a fresh browser context
	env -u NO_COLOR DAEMON_E2E_REMOTE_URL='$(DAEMON_E2E_REMOTE_URL)' pnpm exec playwright test --config tests/e2e/config.ts $(E2E_ARGS)
