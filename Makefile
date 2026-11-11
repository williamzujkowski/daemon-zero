# Single source of truth for build, test and security commands.
# Humans, coding agents and CI all run the same targets.
SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help setup typecheck lint validate test sim verify audit secrets sca security sbom verify-full clean

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

verify: typecheck lint validate test sim ## The gate every change must pass
	@echo "[PASS] verify: typecheck, lint, content, tests, balance"

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

# Targets added by later milestones (see docs/MILESTONES.md):
#   M1: dev, web, android, build-web      M5: e2e
