# Compact kernel and sensor HUD

Issue #94, post-M7 second pass following #89; baseline `1eddbc9`.
No engine, content, balance, save schema, audio or dependency changes.

The utility menu is centered on both axes, including its ending-screen surface.
The HUD contains a single latest kernel entry, visually ellipsized to one line,
with its complete disclosed text as its accessible name. Expand is available
from tick zero with a minimum 44px target. Full history is a bounded modal with
its own virtualized list, Close, Escape/Android Back and focus return. The mobile
preview belongs to the primary scroll; there is no reserved bottom log viewport
or virtualized list nested inside that scroll. Desktop places it to the right
of resources, wrapping when necessary, and removes the former empty log column.

Thermal appears once as a numeric °C readout after its sensor unlock. Suspicion
appears once as a percentage after both the audit widget and decoding unlock.
Mobile sensor labels and values share compact rows. The overheat threshold,
fan actuator, audit response ladder and qualitative blind activity remain
available in their existing contextual widgets. Classified log passages and
accessible names stay unreadable until decoding. The preview subscribes only
to the latest text, and has no live-region announcement on resource ticks.
History is discarded when a dilemma, phase/discovery, reboot or replacement save
changes its presentation scope; dismissed interrupts cannot resurrect history.

## Verification

`mise exec -- make verify-full` passes: 493 unit tests, coverage, content,
unchanged balance pacing, production web export, dependency/history/filesystem
security scans and SBOM. UI statement/branch coverage is 97.97% / 93.48%.
Production E2E passes 84 cases. New tests cover latest-entry selection, hidden
accessible text, full history, focus return, preemption, numeric units and
single-instance HUD containment. Production geometry tests cover centered menus.
Existing large-text tests retain actual purchases, warnings and pane navigation.
No gates or thresholds were weakened.

Two visible Chrome review passes covered all 18 careful campaign start/mid/end
fixtures across Phases 0–5 at 390x844 and 1440x900. A separate baseline capture
used the same fixtures. Final geometry places desktop preview to the right of
resources in all 18 states, with no console warnings/errors or document overflow.
At 390px the preview is 57px high. Removing the 120px bottom dock increases the
primary viewport by 120px; extra HUD sensors and preview use some of that gain.
The remaining visible space below the pane's top improves by 6–63px, usually
33px (Phase 5: 294.6→327.6px; first guest: 660→722.2px). These are measured layout
bounds, not claims that every fixture gains a whole purchase card. All content
continues to be reachable by scrolling.

Six further visible production checks at 320x844 and 844x390 with doubled CSS
font sizes/line heights kept purchases, Expand/history, menu and keyboard focus
reachable without horizontal document overflow. This is controlled text stress,
not an assistive-technology or browser-zoom qualification. Development counters
for Phase 4/5 Work and Swarm remain 1→1 across 30 live ticks, including static
node and cohort parents.

Android Expo Go boot, Expand/history, Android Back and menu were exercised on
the emulator at system font scales 1.0 and 2.0. Screenshots were inspected;
original scoped SQLite database and journal were restored with SHA-256 equality,
and the original font setting was restored. Expo Go's floating Tools overlay
intercepted initial automation taps; retapping the unobscured Expand area passed.
The existing Metro server was retained. Screenshots and measurements are PR
attachments, not repository assets.

No physical Android, iOS, screen reader, audio listening or full new human
playthrough was performed. Existing physical-device qualification remains open.
