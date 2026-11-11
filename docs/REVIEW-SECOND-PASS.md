# M4.5 UI review evidence

## Baseline and scope

The working tree initially had only two untracked local research registry files.
After the maintainer authorized ignoring them, local exclusions temporarily kept
the clean-main check intact; permanent exact-path .gitignore entries were
committed on the work branch and the temporary exclusions removed. Their contents
were preserved. Main was pulled with --ff-only and its HEAD matched PR #37's
merge, `32165b49cfbf793842bb07235934598a15b52029`.
`make setup` and `make verify` passed on that base with 180 tests before branching
for UI work. Repository-pinned tools were selected with mise exec.

All save inputs and screenshots here were generated after that merge. The first
fresh CLI output had 25 cases, SHA256
`acc223abbf64f49009a72e7ee42646837d7a17689f3f07743ff4622a74c3b151`.
The UI review extension emits 33 cases, SHA256
`dffca1d4634781f72bf8bae879981d67d879767db1cab1adcaa78650e286cfdd`.
A further fresh engine-produced scenario captures page → ticket → nominal in a
tick batch to test queued announcements. No old M3/M4 save code or screenshot
was reused. The historical version 1 input is separately documented below.

Only UI, fixtures/tests and documentation changed. src/engine, src/content,
package/lock files, ESLint, TypeScript and Vitest configuration are unchanged.
No query, balance, state or narrative changes were needed. The opening's
maintainer play/sign-off remains a separate milestone exit gate.

## Implementation and mounted checks

- Guest quota/audit widgets are outside hardware scrolling; they remain gated
  and return to manifest placement after escape. Tests exercise the skim action.
- The suspicion meter has labelled numeric rungs and a current marker. Header
  notices queue engine response announcements until each is acknowledged,
  including multiple changes in one tick batch. No UI clock/timer was added.
- Authored omens appear outside the log before decoding. The unlocked forecast
  counts down the same pending interrupt; a real tick opens the blocking dilemma.
- A real escape purchase opens an acknowledged host boundary, with authored phase
  prose and an explicit warning that simulation continues. Mandatory dilemmas
  retain priority; cold restored host saves do not invent a boundary crossing.
- Initial manual instructions get non-balance feedback. Every phase with a cycle
  readout gets a nearby deficit/brownout explanation. Remembered cards show their
  actual engine price and first-mapping comparison; a test buys at that price.
- Camera rendering preserves every authored row/character in equal-width cells.
  Existing content assertions now compare rows rather than one wrapped paragraph;
  they were not removed or weakened. Both camera states receive browser captures.
- The drawer identifies the guest preview, tests phase-0 replacement, and keeps
  its production exclusion checks. Fixture documentation covers all 33 inputs.

`make verify` and `mise exec -- make verify-full` pass with 191 Vitest tests.
Statements: 98.98% overall, 98.79% app, 99.21% UI, 99.39% UI/widgets. All original
coverage floors and strict/lint rules remain intact. Security/SBOM gates pass.

## Visible review loop

Pinned Playwright MCP 0.0.85 used visible Chrome, an isolated profile and the
existing localhost allow-list. The review ran against make web at 390×844 and
1440×900, using new isolated contexts and fresh post-merge saves. Captures are
outside Metro's watched tree and are attached to the PR, never committed.

Three passes total. The first exposed Expo's transient refresh indicator in
some captures; the second waited four real seconds for imports/indicator to
finish before freezing fixture time. No DOM was hidden or screenshot masked.
Before the final pass, response messages were strengthened to queue each update
instead of replacing an unread one. The final pass includes the real engine's
batched escalation and two stand-down announcements and acknowledges them in
sequence. No fourth review pass was used.

Final result: 38 fixture/viewport cases, 71 audit rows and 78 screenshots, zero
console errors/warnings or page errors, and zero outstanding UI audit findings.
Coverage includes all four guest states plus tick 0/manual feedback, each response
rung/stand-down/queue, actual escape and entry, thermal/dilemma/decoded forecast,
clear/patrol camera, remembered guest/host, host/corporate deficits, Phase 3 AEGIS
and an ended run. Checks cover unlock gates, horizontal overflow, named 44 px
controls, actual keyboard reachability and numeric meter values. Pinning was
checked while hardware scrolled; camera row endpoints stay aligned.

## Version 1 compatibility and Android

The test save was newly produced after PR #37 by running the historical public
engine at `a11c35f` for 180 simulated seconds, then serializing. It is genuine
version 1 output, not a hand-edited version 2 input or reused review code. Its
provenance/SHA and exact generation are in tests/fixtures/README.md.

The normal production-web save envelope cold-loaded it, checkpointed version 2,
and preserved all five hardware IDs across reload with no console warnings,
errors or dev hook. A mounted cold-hydration test checks the migration fields and
absence of a fabricated escape modal.

Android actually booted: Pixel 7 API 36 x86_64 emulator with Expo Go, SDK 58.
The same raw version 1 save was placed in the app's normal AsyncStorage envelope
while Expo Go was stopped. The actual app displayed the restored Phase 1 hardware;
its checkpoint rewrote to version 2 with the new quota/legacy fields. A force-stop
and cold relaunch preserved version 2 and all five IDs. Screens and storage were
checked after the app loaded, allowing a warm deep-link retry. The original
native database was freshly backed up and restored afterward. No physical
Android device, iOS, signed release or full native playthrough was verified.

Open limitation: #39 (`second-pass`). Older Phase 1 saves migrate/load but lack
the new audit widget, hiding established understanding/response readouts. The UI
does not bypass gates or change engine migration to hide that issue.

## Real-time opening

The final fresh production-web Phase 0/1 playthrough is recorded in
PLAYTEST-SECOND-PASS.md when it finishes. An earlier short prototype opening was
stopped before the response-queue refinement and is not the final run's evidence.
The final run uses a unique page URL, normal timers, no development hook/imports
and no fast-forward. Small test-ID reads and UI actions replace repeated snapshots.
Agent playback does not replace the maintainer's required opening sign-off.
