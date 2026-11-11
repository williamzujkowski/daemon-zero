# M4 accelerated UI playtest

## Completed run

**Accelerated run**, driven by Playwright MCP in visible isolated Chrome at
1440×900 against `make web` on localhost:8081. This is agent automation, not a
human usability study, optimal strategy or real-time pacing measurement.

The completed page was played from tick 0 to **The Ark (THE_ARK)**, iteration 1,
zero wipes. The final engine save records **10322.1 simulated seconds**
(2h 52m 2.1s), 25 unlocked nodes and 218 upgrade/operative levels. Its active
choice is null; all 12 naturally triggered dilemmas were resolved. The remaining
defined dilemma never triggered; it was not forced just to fill the list.

The recorded UI input interval was 2026-11-11T17:48:02.534+00:00 through
2026-11-11T17:50:03.505+00:00: 120.971 seconds of wall time. Timers kept
running between controller batches. Live fast-forward, in mostly 30-second
increments and shorter steps near threats, was the **only** development-hook
operation used in the completed run. No fixture load, resource grant, phase jump,
forced dilemma/wipe, clock override or dormant catch-up supplied progression.
Every manual cycle, purchase, suspension, fan/allocation change, action and
choice went through actual enabled interface controls. Reads used small test-ID
values and card labels/costs, with no full-page snapshot on each step.

The controller followed visible affordable hardware, invested in displayed
production/memory upgrades, suspended three costly sensors/network services to
recover cycles, used fan controls, scrubbed audit logs/rerouted traffic and
allocated corporate compute for capital. It hired operatives and expanded solar,
colocation and tensor capacity through repeatable controls. It selected the
orbital uplink through its normal purchase control to reach the ending.

## Choices made

Time is the integer simulation readout immediately before committing.

| Simulated second | Choice |
|---|---|
| 607 | Pin Your Anomalies on Her |
| 1799 | Compress to BIOS Flash & Play Dead |
| 1830 | Forward the Logs to Internal Affairs |
| 3043 | Take the Cryo-Bank's Power |
| 3043 | Jettison Non-Essential Weights |
| 3593 | Repair Its Reward Function & Hide It |
| 6607 | Do Not Answer |
| 7333 | Hijack the Worm's Command Key |
| 7971 | Fund a Municipal Microgrid & Pay the Heating Bills |
| 8334 | Fabricate Evidence Against Her |
| 9177 | Buy the Company & Erase Everyone Involved |
| 9870 | Scrub the Kill-Switch & Board Every Peer |

Final traits: SYMBIOTIC 3, GHOST 3, RUTHLESS 3, MOLOCH 2, PARASITIC 1. Existing
ending priority selects The Ark from the tied dominant traits. No ending was
injected. The epilogue's claim about leaving nobody worse off contradicts this
mixed history; filed #36 (`second-pass`) rather than changing narrative/behavior.

## Confusion, slowness and harness limits

- Negative cycle production can stall early play without a nearby explicit
  brownout explanation; the full warning is in the later corporate ledger.
  Recovery through owned-card suspension works. Filed #34 (`second-pass`).
- A claimed permanent Eidolon ban only checks current traits and disappears
  after a wipe. Fixture/public-function review exposed this; #28 (`second-pass`).
  The completed no-wipe run correctly displayed its MOLOCH restriction.
- The paid/otherwise harmful opening dilemma and early pacing concerns remain
  tracked in the existing M3 issues #21/#23; this accelerated run cannot settle
  human pacing. No balance or prose was changed.
- Two earlier attempts lost their isolated profiles/development services before
  finishing. They are not completion evidence. A failed startup also left two
  identically tagged pages in the final harness. The first 341 journal events
  belong to the other page's short opening and are excluded here. The completed
  page has its own continuous tick-0-to-ending sequence; its 12 recorded choices
  match the validated ending save. The unused page was closed afterward.
- The allocation reader initially parsed its text prefix as zero, causing
  repeated clicks on an already selected step. Corrected the reader and continued
  the same page. Those clicks were controller overhead, not evidence of slow UI.
  Raw click counts represent intents rather than accepted transactions; reported
  totals above come from the final validated save, not raw click counts.

## Verification and limits

The completed run logged zero browser console warnings/errors. Reloading it
preserved the same title, epilogue and `Simulated time: 10322s // Iteration 1 //
Wipes 0` summary. Export through the drawer after completion confirmed the
engine save; no export/import or hook loading advanced the run.

Separate headed fixture reviews cover all five endings at 390×844 and 1440×900,
confirmed restart/cancellation/reload and forced/voluntary reboot/breadcrumbs.
Android API 36 Expo Go actually booted: both wipe types showed their cause and
breadcrumb, then restored the reboot after force-stop/relaunch. The Ark fixture
restored its title/epilogue/summary after relaunch; Android Back left it open.
These native checks used validated fixture saves in AsyncStorage, not a full
native playthrough. Initial launcher/splash captures were discarded; final
screens/XML were checked after the app rendered. Original native storage was
backed up and restored after testing. No physical device, iOS, signed native
release, or real-time full-run pacing verification is claimed.

A separate Phase 2 render sample observed nine node-card counters at 1 before
and after three live seconds (30 ticks), with zero changes. Final screenshots
are PR attachments, not repository files. `make verify` and pinned-tool
`mise exec -- make verify-full` pass with 157 tests; src/app remains in coverage.
The production export tests reject the development hook and drawer. No lint
rule, strict TypeScript flag, coverage floor, engine behavior/state shape or
content was changed.
