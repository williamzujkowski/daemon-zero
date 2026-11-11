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

## Build 2: nodes and repeatables (#16)

Three headed browser passes covered all five fixtures at both sizes. Pass 2
visual inspection exposed excessive scrolling past completed hardware to reach
the next purchase. Pass 3 places available hardware and upgrades before owned
cards, and rechecks controls, selected tabs, gating, horizontal overflow and
actual Tab reachability. Zero console warnings/errors; no remaining findings
within this PR's scope. Final pass screenshots are attached to the PR.

Blind cards reveal names/descriptions only on purchase. Engine actions handle
unlock, suspend/resume and upgrades; engine queries determine permission and
prices. Requirements are described without raw implementation fields. The spec
now distinguishes structural discovery from purchase permission and explains
why the first manual probe reveals hardware while tick 0 stays minimal.

`make verify-full` passed with 119 Vitest tests; `make verify` passed again after
the final order change. All existing thresholds, flags and rules are retained;
engine/content are unchanged. A mounted test crosses an affordability boundary
with live ticks and asserts unchanged committed card counts. Headed Chrome also
checks counts across 2.5 real seconds while the cycles counter advances. Render
counts are cumulative across fixture loads so cards retained by React remain
represented. Affordability is a separate subscribing button leaf.

Native purchase input and native performance were not checked in this PR. The
dilemma fixture blocks ordinary input, but its modal arrives in build 3.
