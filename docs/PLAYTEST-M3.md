# M3 real-time web playtest

## Method

One continuous fresh run began on 2026-11-11 at 15:17:07.573 UTC in headed
Chrome, 1440×900, against the production Expo web export on localhost:8088.
Cleared the production origin's save and reloaded before starting. The initial
screen had only boot logs, the terminal header and manual control; the production
development hook was absent. No fixture imports, clock changes, live tick jumps
or dormant catch-up were used during this run.

Playwright read small values through test IDs about once per second and waited
on real timers. Every purchase, upgrade, fan setting and choice used ordinary
enabled UI controls. The controller attempted manual cycles up to four per
second while passive income was below 25/s, bought upgrades when their displayed
cost/output improved time to the visible target, and selected a free dilemma
choice. This is an agent-driven UI playthrough, not a human usability study or
an optimal balance strategy. UI action overhead and repeated fan-setting clicks
made the actual manual input rate lower than that target.

Only the start and Phase 2 endpoint receive playthrough screenshots. No page
snapshots were taken per step. Review-fixture screenshots were taken separately,
before this run, and the hook-based render sample is separate from this run.

## Observations

- First driver purchased at 5.0 seconds; thermal sensor at 17.5 seconds, fan at
  56.3 seconds, memory compression at 116.7 seconds and microphone at 212.5 seconds.
- After the language parser unlocked, the Whistleblower dilemma correctly
  disabled ordinary input. A stale harness read attempted one disabled manual
  click and timed out. Corrected the controller to respect the transition and
  continued the same game without reloading, importing or altering state. The
  overall wall duration includes this repair pause while the engine clock was
  frozen. Parser purchase timing was not journalled because that tool call
  failed; the run was not restarted to manufacture a complete event log.
- Chose “Pin Your Anomalies on Her” at 437.7 seconds (RUTHLESS). The costly
  alternative was unaffordable immediately after buying the parser. Filed #21
  to review whether a blind first run should get advance budgeting information.
- Camera unlocked at 680.4 seconds (11m 20.4s). The final network purchase
  occurred at 1202.2 seconds; Phase 2 was observed at 1202.7 seconds.
- The blind opening gives no current cycle balance before its readout unlocks,
  so progress toward the first driver is hard to judge. Filed #22 for M5 input
  feedback that preserves progressive disclosure.
- Available hardware appearing before completed cards kept the next purchase
  reachable. That order was fixed during the build-2 screenshot review.
- The camera's authored right border is ragged. Filed #19; its text is unchanged.
- Late Phase 1 mostly waits on cycle income after sensor unlocks. This run's
  conservative upgrade policy and controller overhead affect that wait; it does
  not establish a balance regression or dropped-input problem. Heat stabilized
  around 64°C at 50% fan. Filed #23 for a later human review of decision density.
  No browser console errors or warnings were observed
  during the recorded action batches.

## Result

**Reached Phase 2 in 20 minutes 2.7 seconds (1202.669 wall seconds).** Finished
at 15:37:10.242 UTC, with eight owned Phase 1 cards and the newly unlocked network
widget. The final card purchase was at 20m 2.2s. The camera-to-network interval
was 8m 41.8s between purchases, mostly cycle accumulation and upgrades. No wipe occurred. Console
capture in all action batches contains zero warnings/errors; the one tool error
was the expected disabled-input timeout described above, not a browser error.

The completed game restored on a later production-page navigation, with all
eight owned nodes and the network widget intact and no development hook. That
separate restore produced a normal DORMANT_RESUME after leaving the production
page for the post-play render sample; it happened after the measured endpoint.
Raw local journals/screenshots are ignored artifacts; start/end screenshots are
attached to PR #20 instead of committed.

## Follow-ups and limits

- [#19: camera content borders](https://github.com/williamzujkowski/daemon-zero/issues/19).
- [#21: first paid dilemma budgeting](https://github.com/williamzujkowski/daemon-zero/issues/21).
- [#22: blind opening input feedback](https://github.com/williamzujkowski/daemon-zero/issues/22).
- [#23: late Phase 1 accumulation interval](https://github.com/williamzujkowski/daemon-zero/issues/23).

The real-time progression run is web only. Android used an engine-generated save
fixture for Back, choice and restore checks; see REVIEW-M3.md. No iOS, physical
device, signed release, screen-reader study or native performance profile was run.
