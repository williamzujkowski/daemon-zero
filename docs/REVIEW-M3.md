# M3 browser review evidence

## Build 1: terminal foundation (#14)

Ran `make web` in headed Chrome through pinned Playwright MCP 0.0.85, with an
isolated profile and the localhost origin allow-list documented in TESTING.md.
Reviewed all five generated fixtures at 390×844 and 1440×900. Resource readouts
remain absent until their widgets unlock; no horizontal overflow or clipped
test-id elements were found. Every available control has an accessible name,
at least a 44 px target and is reachable through actual keyboard Tab navigation.

Pass 1 exposed that React Native Web did not translate the selected tab state
to `aria-selected`; explicit ARIA fixed it. Pass 2 rechecked selected tabs, all
fixtures and keyboard reachability, with zero console warnings or errors and
no remaining foundation findings. Final screenshots are attached to the PR,
including the mobile Sensors pane. They are ignored locally, never committed.
Widget bodies, purchase controls and the dilemma modal belong to the next two
build PRs; this PR renders only unlocked manifest titles for those widget frames.

`make verify-full` passed: strict typecheck, zero-warning lint, content validation,
115 Vitest tests with unchanged coverage floors, balance simulation, web export,
audit, gitleaks, OSV, Trivy and SBOM generation. The UI content-id rule now applies
to all UI modules, with widget literals permitted only in the registry; a lint
regression test checks both boundaries. Engine and content are unchanged.

Android/iOS, screen readers and native font scaling were not checked in this
foundation PR. Browser checks do not establish native accessibility behavior.
