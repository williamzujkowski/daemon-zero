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

## Build 3: Phase 1 widgets and dilemmas (#18)

The registry covers exactly the 18 manifest IDs. Phase 1 bodies are implemented;
later-phase entries have frames only until M4. Thermal/suspicion and memory show
numbers and accessible values. Fan controls expose five settings. Audio and
camera use authored narrative, with decoded speech gated by the parser. The
forecast is explicitly a current-rate projection, not a scheduled event.

Three headed passes cover all fixtures at both requested sizes. Pass 1's audit
incorrectly included background controls behind the modal; pass 2 checks only
the modal's focus scope. Component verification also exposed missing web ARIA
meter values, fixed before pass 3. The final pass includes actual keyboard
reachability in Core and Sensors, 44 px controls, accessible numeric meters,
scroll-width checks, resource/widget gating, Escape and backdrop resistance,
and scrolled screenshots of camera/forecast and modal choices. Zero console
warnings/errors. Remaining content finding: #19, uneven authored ASCII borders;
no content was changed. Screenshots are attached, not committed.

125 Vitest tests pass under the single existing runner, including the registry,
fan input, feeds, meter values, unaffordable/free/paid choices, frozen dilemma
ticks and resumed time after a choice. `make verify` passes with unchanged lint,
strict flags and coverage floors, including src/app. Engine/content are unchanged.
The UI spec now explicitly identifies scramble reveals and haptics as the M5
feel pass already assigned in the milestone plan.

Final real-time playthrough and Android Back evidence are being recorded before
this PR is marked ready. No iOS, physical device, signed release, native screen
reader or midrange-device performance claims are made.
