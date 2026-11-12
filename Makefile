# Single source of truth for build, test and security commands.
# Humans, coding agents and CI all run the same targets.
SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help setup typecheck lint validate test sim verify audit secrets sca security sbom verify-full clean dev web android build-web e2e android-release

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

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

e2e: build-web ## Playwright scenarios against the production web export
	env -u NO_COLOR pnpm exec playwright test --config tests/e2e/config.ts

android-release: ## Build signed local release AAB and APK (external signing environment required)
	bash scripts/build-android-release.sh
