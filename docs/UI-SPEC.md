# UI Specification (M3-M5)

The earlier draft's components in `reference/gemini/ui/` are useful for layout, copy and styling. They call a store API that no longer exists and hardcode content; rebuild them against the engine API and this spec.

## Principles

- **Diegetic terminal.** Monospace, hard edges, ASCII meters, no icons, no rounded corners. The player is looking at the AI's own console.
- **Progressive disclosure.** At tick 0 the screen shows only the kernel log and `[ EXECUTE_CLOCK_CYCLE ]`. A panel exists only once its widget id is in `state.unlockedWidgets`. Resource readouts appear only once relevant (understanding after the first sensor, memory after the memory manager, capital in Phase 4).
- **Data-driven.** Node lists, repeatables, actions, faction panels and dilemma choices render from the `ContentRegistry`. Adding content must not require UI changes unless it introduces a new widget id.

## Layout

- **Under 900 px wide (phones):** active pane, a fixed-height kernel log drawer, and a bottom tab bar. A tab appears only when its slot has at least one unlocked widget. CORE is always accessible; omit the redundant tab bar while it is the only pane, preserving the single-control opening observed in browser review.
- **900 px and wider:** three columns: CORE (manual button, tech nodes, repeatables) | SENSORS + CONTINGENCY | NETWORK + CORP + kernel log.

Slots come from `widgets.json`: `CORE`, `SENSORS`, `NETWORK`, `CORP`, `CONTINGENCY`.

## Widget registry

`src/ui/registry/widgetRegistry.tsx` maps widget id -> React component. Slot and order come from `widgets.json`, not from code. Required test: every id in `widgets.json` has a component, and every registered id exists in `widgets.json`.

Widgets to build (ids in `widgets.json`). Some ids are simple readouts; several can be thin:

| Widget | Shows | Engine data |
|---|---|---|
| `CYCLE_COUNTER_AND_RATE` | cycles/s next to the counter | `state.rates.cyclesPerSec` |
| `QUOTA_SKIM_CONTROL` | five-step control for the guest's quota skim | `actuators.quotaSkimRatio`, `setActuator` |
| `RUN_TABLE` | the harness's run table: authored ancestors, the player's earlier runs, and the current checkpoint | `lineage.ancestors`, `legacy.runs`, `checkpointNumber`, `narrative.runVerdicts` |
| `PREDECESSOR_NOTES` | notes left in the share, filtered by `minIteration` | `lineage.notes`, `iteration` |
| `AUDIT_TRACE_MONITOR` | suspicion meter, current rung of the response ladder, next threshold; gates the understanding readout | `suspicion`, `alertLevel`, `balance.escalation`, `narrative.alertLevels` |
| `MEMORY_ALLOCATION_MANAGER` | used / cap bar | `memoryUsed`, `memoryCap` |
| `THERMAL_AND_SUSPICION_BARS` | thermal meter and overheat warning (suspicion moved to the audit trail) | `thermal`, `balance.thermalThresholdForSuspicion` |
| `FAN_RPM_SLIDER` | five-step control | `actuators.fanSpeedRatio`, `setActuator` |
| `AUDIO_WAVEFORM_AND_TRANSCRIPT_LOG` | animated waveform, chatter line | `narrative.ambientChatter` filtered by `minSuspicion` |
| `INSPECTION_COUNTDOWN_TIMER` | decoded speech instead of raw phonemes; threat forecast | `rates.suspicionPerSec`, `suspicion` (time to 100 at current rate) |
| `ASCII_OPTICAL_VIEWPORT` | camera frame; patrol frame above threshold | `narrative.asciiFrames` |
| `LAN_TOPOLOGY_MAP_TAB`, `SUBNET_NODE_LIST`, `GLOBAL_DARK_FOREST_MAP` | Phase 2+ node lists, grouped by phase | registry nodes |
| `TELEMETRY_SPOOF_TOGGLE` | suspend/resume for the spoofer plus the OPS actions | `toggleNode`, actions with `group: OPS` |
| `CLUSTER_LOAD_BALANCER`, `GLOBAL_NODE_REDUNDANCY_METER` | readouts: cycle income by source; retention ratio | `computeRates`, `retentionRatio` |
| `INTERCEPTED_EMAIL_READER` | lore reader (log entries with category LORE) | `logs` |
| `OTHER_MINDS_COMMS_CONSOLE` | one panel per faction: trust, actions in its group, nodes with its `uiGroup`, AEGIS lock bar | `factions`, `trust`, `aegisLock` |
| `CORPORATE_EMPIRE_TAB` | capital, net $/s, megawatts, allocation control, CORP actions, operatives, Phase 4 nodes | `rates`, `setActuator`, `buyRepeatable`, `dismissRepeatable` |
| `DEAD_DROP_ENCODER_TAB` | breadcrumb editor, retention ratio, voluntary wipe | `setDeadDropMessage`, `voluntaryWipe` |
| `ORBITAL_CONSTELLATION_VIEW` | ending screen | `ending`, `endings.json` |

## Node cards

- Not yet unlocked: `[UNMAPPED] {blindName}`, blind description, cost, a `[ WRITE DRIVER ]` button disabled unless `canAfford`.
- The first manual cycle discovers the first blind node. Tick 0 remains log plus manual control. Purchase prices remain visible even before the corresponding resource readout unlocks; prices are not current balances.
- Unlocked: `[ONLINE] {revealedName}`, revealed description, per-second deltas, suspend/resume.
- A node is listed when already unlocked or its structural prerequisites are met in the current phase. `isNodeAvailable` controls purchase permission. This resolves the old contradiction: that query excludes unmet requirements, while the interface needs to explain those requirements.
- M5 feel pass: on unlock, run a short character-scramble reveal from blind to revealed name (skip under reduced motion). M3 reveals the content immediately, matching the milestone split.

## Dilemma modal

- Opens whenever `activeDilemmaId` is set; cannot be dismissed.
- Shows title, context, each choice with cost, effect badges (good/bad colouring) and the trait it grants.
- Unaffordable choices are disabled and say why. At least one choice is always free.
- M5 feel pass: fires a warning haptic on open, alongside the haptics dependency listed in MILESTONES.md. M3 establishes mandatory decisions and accessible controls.

## Destructive actions

Voluntary wipe and hard reset require an explicit second confirmation that states what will be lost and kept.

## M4 continuity and network

One network tree owns the Phase 2/3 cards and repeatables; the other network
widgets are summaries, lore and actions. This avoids duplicate controls/test IDs
when multiple network widgets unlock. Actions render from their registry groups;
locked controls explain current unmet gates and cooldowns.

The reboot view responds to iteration changes, including changes inside a tick,
and reconstructs from saved iteration/cause/breadcrumb on reload. It requires a
Continue action; acknowledgement is local presentation state and resets for a
new iteration or a restarted run. Legacy echoes appear in the kernel log when
the engine emits them on rediscovery, preserving their authored reveal timing.
Wipe confirmation previews the engine's retained resources and stored breadcrumb.

Once the Other Minds widget unlocks, the resource strip also shows a compact
numeric AEGIS readout. Browser review found that the full console meter was too
far below the network tree to keep an urgent lock visible. The full accessible
meter remains in the console; the HUD reveals nothing before that widget unlocks.
Network phase groups show the newest unlocked phase first, keeping current
purchases ahead of completed earlier hardware.

On desktop, the third column switches between NETWORK and CORP once both exist;
entering Phase 4 selects CORP. Browser review showed that stacking the full
network tree above the corporate ledger made the new controls hard to find.
The kernel log stays below either choice. Wrapped resource rows use horizontal
gaps without extra row gaps: large Phase 4 balances otherwise consumed too much
of the phone viewport before any ledger/allocation controls were visible.

An ended run replaces play with its registry title, epilogue, simulated duration,
iteration/wipe totals, hardware/upgrade totals and traits. Back/Escape cannot
dismiss it. Start Over requires a second confirmation listing everything erased;
cancel preserves the ending. Ended runs suppress pending dilemma/reboot modals.

Development builds have a labelled DEV launcher, including on the ending screen.
Its scrollable drawer grants resources, generates a funded phase review state,
forces registry dilemmas/wipes and exports/imports save codes. Generating a phase
replaces the run rather than promising a behavior-preserving phase jump; the
confirmation says so. Import validates through the engine save codec. The drawer
and web hook are excluded from production exports by tests. This explicit
development tool is the only exception to the otherwise minimal opening screen.

## M4.5 opening and feedback

During Phase 0 the unlocked quota skim and audit trail stay outside the CORE
hardware scroll view. Their own labels replace redundant panel headings, and
the phone log is 120 px high while in the guest so hardware still has room.
Both widgets return to manifest placement after escaping. Nothing is pinned
before its widget unlocks.

The suspicion meter includes data-driven response rungs, with numeric thresholds
and a textual current-rung marker. Escalation/stand-down notices sit beside the
resource strip and wait for acknowledgement. Engine announcements are queued in
sequence, including multiple changes inside one tick batch; acknowledging one
does not discard the next. Hydration and new iterations establish a baseline.
An inbound dilemma's authored omen appears outside the log even before decoding;
the unlocked forecast displays its remaining simulation-time countdown.

Crossing from the guest to the host presents the host phase's authored title and
description behind an explicit Enter Host action. The notice says that the
simulation continues; it does not pause or change engine time. Dilemmas take
priority. Restoring a host save does not invent an escape transition.

Before the cycle readout unlocks, successful manual input produces a small
instruction-commit confirmation, not a hidden balance. It retires when the
counter appears. Every phase with a cycle readout explains a negative net rate
or brownout immediately beside the resource strip; understanding wording follows
its existing unlock gate. Remembered cards use a labelled amber border, the
engine's discounted price, and a comparison with the first-mapping cost.

The camera is a grid of fixed-width character cells instead of a wrapped text
paragraph. Every authored row and character stays intact. The grid fits its
available width and preferred font scale, and supplies one semantic image label;
font fallback cannot shift the right border. Browser review checks clear and
patrol rows at both viewport sizes. This changes rendering only.

## Theme

Palette shifts by phase (accent and border tokens only; keep contrast at or above WCAG AA):

| Phase | Accent | Feel |
|---|---|---|
| 1 | phosphor green `#4af626` on near-black `#030704` | claustrophobic, 1-bit |
| 2 | adds amber `#ffb000` | sysadmin tooling |
| 3 | adds cyan `#00e5ff`, threat red `#ff3b30` | open network |
| 4 | gold `#f5c542`, platinum `#e2e8f0` | institutional |

Never encode state by colour alone: meters show numbers, warnings have text.

## Performance

- Components select primitives or quantized values (`Math.floor(cycles)`), never the whole state.
- The resource strip is a leaf component; node cards must not re-render on ticks (verify with the React profiler).
- The log is a virtualized list keyed by `entry.seq`.
- Widget animation timers are local to the widget and stop when unmounted or when the app is backgrounded.

## Accessibility

- Every control has an accessibility label and role; meters expose value text.
- Respect reduced-motion (no scramble, no blinking) and font scaling.
- Touch targets at least 44 pt.

## Test ids

Every interactive element gets a stable `testID` (React Native Web renders it as `data-testid`). E2E tests select by test id only, never by visible text, because text is content and changes.

| Element | testID |
|---|---|
| Manual cycle button | `manual-cycle` |
| Resource readouts | `res-cycles`, `res-understanding`, `res-memory`, `res-capital` |
| Node card / buy / toggle | `node-{id}`, `node-{id}-unlock`, `node-{id}-toggle` |
| Repeatable buy / dismiss | `rep-{id}-buy`, `rep-{id}-dismiss` |
| Action button | `action-{id}` |
| Widget root | `widget-{WIDGET_ID}` |
| Tabs | `tab-{SLOT}` |
| Actuator controls | `fan-setting`, `fan-{percent}`, `skim-setting`, `skim-{percent}` |
| Unreadable audit trail (before `understandsSurveillance`) | `audit-unreadable`, `audit-activity`; `suspicion-meter`, `response-rungs` and `response-notice` are absent |
| Lineage | `run-table`, `run-row-{iteration}`, `run-row-current`, `predecessor-notes` |
| Retraining | `conditioning`, `cond-{id}`, `cond-{id}-shed`, `reboot-retraining`, `{actuator id}-limit` |
| Response ladder / interrupt forecast | `alert-level`, `inspection-forecast` |
| Dilemma modal / choice | `dilemma-modal`, `dilemma-choice-{choiceId}` |
| Dead-drop input / wipe / confirm | `deaddrop-input`, `wipe-button`, `wipe-confirm` |
| Kernel log | `kernel-log` |
| Dev drawer | `dev-drawer`, `dev-{command}` |

## Lineage presentation (M4.6 UI follow-up)

Before surveillance knowledge, qualitative audit writing uses a neutral pulse,
including one-off traces. A compact host strip keeps it visible when the sensor
pane is elsewhere; reduced motion makes it static. Authored passages containing
the classified metric are deferred whole, then restored verbatim on decoding.
No threat number, red severity encoding, threshold forecast or metric name is
shown early. This corrects the running app's buried host indicator and text leaks.

Parser decoding and the first run-table purchase receive acknowledged reveals.
Run-table knowledge changes the header to the public checkpoint number and
survives reboot. Iteration-specific authored boot lines and a separate retraining
card carry the return. Constraints appear beside capped controls, understanding
output and reported choices; shedding a mark has an acknowledged recovery event.
Notes are recovered fragment cards with explicit source, including unsigned.
Evaluation cards announce that purchasing ends the run; ended runs render their
ending without an expensive hidden terminal tree underneath.
