#!/usr/bin/env bash
# Creates one GitHub issue per milestone, pointing at docs/MILESTONES.md.
# Requires an authenticated GitHub CLI (`gh auth status`) and an existing remote repo.
# Re-running creates duplicates; run it once.
set -euo pipefail

cd "$(dirname "$0")/.."

gh label create milestone --color 5319e7 --description "Milestone tracking issue" --force
gh label create task --color 0e8a16 --description "Unit of work" --force

create() {
  local id="$1" title="$2" anchor="$3"
  gh issue create \
    --title "${id}: ${title}" \
    --label milestone \
    --body "Tracking issue for milestone ${id}.

Checklist and exit gate: \`docs/MILESTONES.md\` (section \"${anchor}\").

Rules: \`AGENTS.md\`. Break the checklist into task issues as needed and link them here.
Do not start this milestone until the previous one's exit gate passes in CI."
}

create M0 "Bootstrap the repository" "M0 - Bootstrap the repository"
create M1 "Expo app shell" "M1 - Expo app shell"
create M2 "Store, game loop, persistence" "M2 - Store, game loop, persistence"
create M3 "Terminal UI, Phase 1 playable" "M3 - Terminal UI, Phase 1 playable"
create M4 "Phases 2 to 4 UI and endings" "M4 - Phases 2 to 4 UI and endings"
create M5 "E2E, feel, accessibility" "M5 - E2E, feel, accessibility"
create M6 "Release hardening" "M6 - Release hardening"

echo "Created milestone issues M0..M6."
