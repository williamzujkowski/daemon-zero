# Compact actuators and top forecast

Issue #96, post-M7 second pass following #89; baseline `4db4f61`.
Engine, content, balance, save schema, audio and dependencies are unchanged.

Quota skim and fan output use two labelled 44px decrement/increment buttons
beside the current percentage. Each press changes the current value by up to
10 percentage points: 35→45%, 95→100%, or 45→50% at a 50% cap. Decrease reaches
zero exactly; Increase reaches the live cap exactly. Controls disable at the
respective boundary and during mandatory interrupts. The dispatched action
reads the current game value and engine limit, including cap changes between
render and press. There are no slider semantics or direct UI state mutations.
Conditioning limits and their authored explanations remain beside the controls.

The fan control appears within the thermal tile only after its own widget
unlocks. The earlier thermal sensor still exposes its threshold without a fan
control. The separate fan wrapper/heading is gone; numeric temperature remains
in the HUD in °C. The quota stepper remains in its existing tile and guest
placement, with its explanation and blind audit feedback intact.

The unlocked interrupt forecast now sits immediately below the resource/kernel
HUD and above all workspaces. It appears once, with its countdown and complete
paid-response alternatives. Existing decoding gates, free-response reminder,
omens and mandatory decisions remain unchanged. Stable forecast text can share
a line on wide screens; no truncation hides warnings or reserve costs. On mobile
it belongs to the primary scroll, so it does not reserve a second fixed bar.

## Verification and measured trade-offs

Final `mise exec -- make verify-full` passes with 497 unit tests, coverage,
content, unchanged pacing, production export, security scans and SBOM. Production
E2E passes 88 cases. Tests include batched presses, 35% starting values, exact
minimum/maximum and partial capped steps, a cap arriving between render and
press, keyboard Enter/Space, discovery boundaries, shared thermal containment,
and a single forecast above workspaces. Earlier cap/recovery tests now exercise
the stepper through the live cap rather than targeting a removed preset.

Visible Chrome baseline/final captures cover all 18 careful start/mid/end states
at 390x844 and 1440x900, with no document overflow or console warnings/errors.
The guest quota tile shrinks from 113.2→86px on mobile and 94.2→67px on desktop.
In the Phase 1 sensor fixture, separate thermal/fan tiles were 80.6+138.8px,
plus their 14px gap; the merged tile is 134.6px, saving 98.8px of sensor content.

The top forecast occupies 64px on desktop and 86px on mobile in the reviewed
normal states. This improves forecast access across panes and deliberately
moves mobile purchases farther down the scroll after the forecast unlocks;
it does not promise more initially visible purchase cards in those states.
No forecast appears in the blind guest before its existing unlock. Six visible
production checks at 320x844 and 844x390 with doubled CSS text retained purchase,
menu, history and keyboard reachability without horizontal document overflow.
This is synthetic text stress, not browser zoom or screen-reader qualification.
Phase 4/5 Work and Swarm static counters remain 1→1 across 30 live ticks.

Android Expo Go emulator checks exercised the compact controls and top forecast
at system font scales 1.0 and 2.0. The original scoped SQLite database/journal
and font setting were restored; database file SHA-256 equality was verified.
The existing Metro server and original untracked MP3 were preserved. Screenshots
and measurements are attached to the PR, not committed as repository assets.
No physical Android, iOS, screen reader, audio listening or full new human
playthrough is claimed.
