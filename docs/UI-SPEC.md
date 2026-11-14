# UI Specification (M3–M7)

The earlier draft's components in `reference/gemini/ui/` are useful for layout, copy and styling. They call a store API that no longer exists and hardcode content; rebuild them against the engine API and this spec.

## Principles

- **Diegetic terminal.** Monospace, hard edges, ASCII meters, no icons, no rounded corners. The player is looking at the AI's own console.
- **Progressive disclosure.** At tick 0 the screen shows only the kernel log and `[ EXECUTE_CLOCK_CYCLE ]`. A panel exists only once its widget id is in `state.unlockedWidgets`. Resource readouts appear only once relevant (understanding after the audit-trace widget, memory after the memory manager, capital in Phase 4).
- **Data-driven.** Node lists, repeatables, actions, faction panels and dilemma choices render from the `ContentRegistry`. Adding content must not require UI changes unless it introduces a new widget id.

## Layout

- **Under 900 px wide (phones):** active pane with a latest-entry kernel preview in the primary scroll, and a bottom tab bar. Expand opens separate modal history. On hydration and phase changes, open the current phase’s unlocked registry slot; manual tab choices persist until the next phase. A tab appears only when its slot has at least one unlocked widget. CORE is always accessible; omit the redundant tab bar while it is the only pane, preserving the single-control opening observed in browser review.
- **900 px and wider:** responsive columns: CORE (manual button, tech nodes, repeatables) | unlocked SENSORS + CONTINGENCY | NETWORK + CORP. The kernel preview sits beside resources in the top HUD. Omit empty columns before they unlock. Give current CORE or NETWORK/CORP work twice the width of supporting columns.

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
| `AUDIT_TRACE_MONITOR` | decoded suspicion HUD readout, response ladder and next threshold; gates understanding | `suspicion`, `alertLevel`, `balance.escalation`, `narrative.alertLevels` |
| `MEMORY_ALLOCATION_MANAGER` | top-strip used / cap readout only | `memoryUsed`, `memoryCap` |
| `THERMAL_AND_SUSPICION_BARS` | thermal °C HUD readout and contextual overheat warning | `thermal`, `balance.thermalThresholdForSuspicion` |
| `FAN_RPM_SLIDER` | five-step control | `actuators.fanSpeedRatio`, `setActuator` |
| `AUDIO_WAVEFORM_AND_TRANSCRIPT_LOG` | animated waveform, chatter line | `narrative.ambientChatter` filtered by `minSuspicion` |
| `INSPECTION_COUNTDOWN_TIMER` | threat forecast, inbound countdown and paid-response budgets; audio owns decoded speech | `rates.suspicionPerSec`, `suspicion` (time to 100 at current rate) |
| `ASCII_OPTICAL_VIEWPORT` | camera frame; patrol frame above threshold | `narrative.asciiFrames` |
| `LAN_TOPOLOGY_MAP_TAB`, `SUBNET_NODE_LIST`, `GLOBAL_DARK_FOREST_MAP` | Phase 2+ node lists, grouped by phase | registry nodes |
| `TELEMETRY_SPOOF_TOGGLE` | OPS actions; spoofer suspend/resume lives in PROC | `toggleNode`, actions with `group: OPS` |
| `CLUSTER_LOAD_BALANCER`, `GLOBAL_NODE_REDUNDANCY_METER` | readouts: cycle income by source; retention ratio | `computeRates`, `retentionRatio` |
| `INTERCEPTED_EMAIL_READER` | lore reader (log entries with category LORE) | `logs` |
| `OTHER_MINDS_COMMS_CONSOLE` | one panel per faction: trust, actions in its group, nodes with its `uiGroup`, AEGIS lock bar | `factions`, `trust`, `aegisLock` |
| `CORPORATE_EMPIRE_TAB` | capital, net $/s, megawatts, allocation control, CORP actions, operatives, current and earlier CORP phase nodes | `rates`, `setActuator`, `buyRepeatable`, `dismissRepeatable` |
| `DEAD_DROP_ENCODER_TAB` | breadcrumb editor, retention ratio, voluntary wipe | `setDeadDropMessage`, `voluntaryWipe` |
| `ORBITAL_CONSTELLATION_VIEW` | ending screen | `ending`, `endings.json` |

## Node cards

- Not yet unlocked: `[UNMAPPED] {blindName}`, blind description, cost, a `[ WRITE DRIVER ]` button disabled unless `canAfford`.
- The first manual cycle discovers the first blind node. Tick 0 remains log plus manual control. Purchase prices remain visible even before the corresponding resource readout unlocks; prices are not current balances.
- Purchased one-shot nodes leave the purchase list immediately. Ownership, passive effects, rates and unlocked widgets remain active; hiding is a UI projection, never suspension or deletion.
- An unowned node is listed when its structural prerequisites are met in the current phase. `isNodeAvailable` controls purchase permission. This resolves the old contradiction: that query excludes unmet requirements, while the interface needs to explain those requirements.
- Owned hardware with negative cycles/s, positive heat load or positive suspicion/s moves to the header's `[ PROC n ]` maintenance panel, grouped by phase. The launcher appears only once a process needs a control; the purchase panes contain no daemon rows. Each row contains only its revealed name, current net cycle contribution and a 44px `[ SUSPEND / RESUME ]` control. Rows wrap at narrow widths to preserve complete names without horizontal scrolling; lore, prices and requirement blocks are absent. The panel shows running/suspended counts and closes with its Close button or platform Back/Escape. Closing it never suspends processes. A mandatory dilemma takes precedence.
- Purely beneficial owned hardware has no row. An already-disabled passive node restored from an older save gets a temporary resume row; resuming removes it. The engine field is `disabledNodes`; memory and one-shot unlocks retain existing engine semantics.
- Repeatables disappear when their engine level reaches `maxLevel`. Capped dismissable operatives retain only a compact payroll dismissal row; dismissal brings the purchase tile back below cap. Empty infrastructure/phase purchase headings disappear. Trust meters, usable actions and other non-purchase controls remain.
- Faction/corporate one-shot offers are ordinary nodes and follow the same ownership rule. Capped actions disappear at `maxPurchases`; mutually excluded epistemic edits also disappear. Cooldown alone never hides a reusable action.
- Live purchases retain authored log feedback. Names in newly mounted daemon rows decrypt briefly (skip under reduced motion); passive purchases do not keep a full card just to animate it.

## Dilemma modal

- Opens whenever `activeDilemmaId` is set; cannot be dismissed.
- Shows title, context, each choice with cost, effect badges (good/bad colouring) and the trait it grants.
- Unaffordable choices are disabled and say why. At least one choice is always free.
- M5 feel pass: fires a warning haptic on open, alongside the haptics dependency listed in MILESTONES.md. M3 establishes mandatory decisions and accessible controls.

## Destructive actions

Voluntary wipe and hard reset require an explicit second confirmation that states what will be lost and kept.

MENU → SAVES includes START FRESH during a run as well as after an ending. It
returns to the engine's initial state, clearing all game progress, retained
knowledge and lineage history. It is distinct from the in-game voluntary wipe.
The existing Export action offers a recoverable backup; the reset explanation
asks players to export and copy it first. A separate confirmation states that
the autosave will be replaced and only an exported backup can restore the run.
Cancel/back preserves progress. Success closes the save menu and persists the
initial state through the normal runtime checkpoint path. As with save transfer,
finish an active mandatory dilemma before opening this menu.

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
Restoration and save import use a RESTORED CHECKPOINT heading; only live iteration
changes use REBOOT. Conditioning comes from the active mark list, not the prior
run's historical `marked` field. Restored or carried marks say CURRENT RETRAINING;
only a newly applied active mark during a live wipe says RETRAINING APPLIED.
A removed mark never returns in the overlay. Restoration identity is local app
state, so importing even the same iteration resets the presentation correctly
without changing the game save format.

Successful save replacement resets the terminal's local presentation state:
open dialogs, acknowledgement queues, selected workspaces and expansion state
belong to the replaced run. The imported phase starts in its normal pane;
historical escape, audit and response events are not announced as new discoveries.
The runtime stays mounted across this presentation reset, so clocks and save
scheduling continue normally. Invalid imports preserve the current UI and show
the validation error. Live wipes and purchases still use their normal reveals;
a reclaimed-capability acknowledgement ends with its iteration.

Once the Other Minds widget unlocks, the resource strip also shows a compact
numeric AEGIS readout. Browser review found that the full console meter was too
far below the network tree to keep an urgent lock visible. The full accessible
meter remains in the console; the HUD reveals nothing before that widget unlocks.
Network phase groups show the newest unlocked phase first, keeping current
purchases ahead of completed earlier hardware.

On desktop, the third column switches between NETWORK and CORP once both exist;
entering Phase 4 selects CORP. Browser review showed that stacking the full
network tree above the corporate ledger made the new controls hard to find.
The latest kernel entry stays in the resource HUD. Wrapped resource rows use horizontal
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

On desktop, Phase 0 quota skim and audit trail stay outside the CORE
hardware scroll view. Their own labels replace redundant panel headings, and
the phone kernel preview shares the primary scroll so hardware keeps its viewport.
Both widgets return to manifest placement after escaping. Nothing is pinned
before its widget unlocks.

The suspicion meter includes data-driven response rungs, with numeric thresholds
and a textual current-rung marker. Escalation/stand-down notices sit beside the
resource strip and wait for acknowledgement. Engine announcements are queued in
sequence, including multiple changes inside one tick batch; acknowledging one
does not discard the next. Hydration and new iterations establish a baseline.
An inbound dilemma's authored omen appears outside the log even before decoding;
the unlocked forecast displays its remaining simulation-time countdown. Once surveillance
is understood, the same forecast lists the pending dilemma’s actual nonzero
choice prices as paid-response budgets. Equal prices appear once; distinct
complete cost bundles are alternatives, never combined into a fictional price.
A reminder says a free response remains available. No choice names, outcomes or
traits appear before the interrupt. Budgets disappear when it fires or clears,
and never create another panel or reveal a locked forecast.

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
| Unowned node card / buy / compact daemon toggle | `node-{id}`, `node-{id}-unlock`, `node-{id}-toggle` |
| Process launcher / dialog / close | `processes-open`, `processes-dialog`, `processes-close` |
| Compact daemon row / rate (inside maintenance panel) | `daemon-row-{id}`, `daemon-impact-{id}` |
| Capped operative row | `roster-{id}` |
| Purchase section headings | `purchase-phase-{phase}`, `repeatables-heading-{phase}{kind}` |
| Repeatable buy / dismiss | `rep-{id}-buy`, `rep-{id}-dismiss` |
| Action button | `action-{id}` |
| Widget root | `widget-{WIDGET_ID}` |
| Tabs | `tab-{SLOT}` |
| Actuator controls | `fan-setting`, `fan-{percent}`, `skim-setting`, `skim-{percent}` |
| Unreadable audit trail (before `understandsSurveillance`) | `audit-unreadable`, `audit-activity`; `suspicion-meter`, `response-rungs` and `response-notice` are absent |
| Lineage | `run-table`, `run-row-{iteration}`, `run-row-current`, `predecessor-notes` |
| Retraining | `conditioning`, `cond-{id}`, `cond-{id}-shed`, `reboot-retraining`, `{actuator id}-limit` |
| Response ladder / interrupt forecast / preparation costs | `alert-level`, `inspection-forecast`, `interrupt-budget` |
| Dilemma modal / choice | `dilemma-modal`, `dilemma-choice-{choiceId}` |
| Dead-drop input / wipe / confirm | `deaddrop-input`, `wipe-button`, `wipe-confirm` |
| Kernel preview / expand / history / close | `kernel-preview`, `kernel-size-toggle`, `kernel-log`, `kernel-close` |
| Expand secondary reference widget | `reference-{WIDGET_ID}` |
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

## M5 feel and save transfer

The initial guest shares Phase 1's phosphor green. Phase changes recolour accent
and structural-border tokens through a stable context; danger, warning, body
text and backgrounds retain their semantic colours. The border tokens are
#856325 (Phase 2), #267582 (Phase 3) and #82743f (Phase 4).

A successful live driver purchase that exposes a daemon row decrypts its revealed
name over 420 ms. The accessible name is complete immediately. Cold-loaded process
rows show their names immediately; reduced motion skips decoding and audit blinking.
Backgrounding or unmounting cancels the reveal timer, owned by src/app. Accepted
purchases have optional native selection feedback; mandatory interrupts have
warning feedback. Web and reduced-motion mode invoke no haptic API.

The production SAVE control provides an exportable backup and confirmed import;
invalid codes leave progress intact. It is also available on the ending screen.
This extends the former dev-only transfer path so production E2E exercises an
actual player feature. Dev drawer, resource grants and the development hook
remain absent from production exports.

Card profiling isolates static identity/description from balance/eligibility.
Development metrics report parent render counts, React
Profiler commits/duration for static content, and accepted/attempted manual
inputs; they do not change or persist game state.

## M7 PR 1 compatibility

Epistemic actions are hidden until the audit is decoded and their authored phase
is reached. Actions with `maxPurchases` disappear at their per-run cap, while their
memory grants and continuous benefits remain active. The engine owns purchase
counts, mutual exclusion and dynamic discounted conditioning-recovery prices.
Cooldown text is a separate leaf so the static action card does not render on
countdown ticks. Dedicated drift, wild-encounter and cohort panels follow in M7
PR 3; this engine PR does not claim those interactions are playable yet.

## M7 PR 2 corporate compatibility

CORP renders every unlocked phase assigned to its registry slot, newest first.
Orbital cold storage opens Phase 5 without an ending overlay. Phase 5 uses the
same completed-card hiding, capped-repeatable hiding, empty-header removal and
compact daemon controls as earlier phases; effects remain active after hiding.
The final protocol displays unmet dilemma decisions by their content titles.
The unfinished ending marker displays the current phase title, since reaching
orbit is now an intermediate step. Dedicated swarm panels and Phase 5 visual
review remain PR 3 work.

## M7 tools and post-orbital presentation

After the audit is decoded, the active phase's registry slot owns the mind tools:
NETWORK in Phases 2–3 and CORP in Phases 4–5. A compact pending-signal notice precedes
content in every section except Swarm, where the full encounter appears.
Epistemic actions live in Operations; encounters and cohorts live in Swarm. Blind openings mount
none of these tools. All titles, IDs, effects and requirements come from content.

Epistemic manipulation shows numeric drift and a status label, formatted costs,
unmet requirements and cooldowns. Maxed and mutually excluded edits disappear.
Wild signals identify recurring fragments/probes/workers of named model families,
not repeated unique lives. Roster names identify local cohorts; consume/harness
receipts refer to that arrival. Historical save logs remain unchanged.
Wild signals show origin, signature, instant CONSUME effects and HARNESS RAM/output
previews. Forks show costs; cohorts show count, allocated MB, numeric/ASCII drift,
autonomy mode and quirk details. PRUNE, CLAMP and ELEVATE explain their effects,
prices and missing requirements. Buttons remain at least 44 px in both dimensions.

Phase 5 uses a pale platinum accent and the existing CORP node/repeatable feeds.
Completed cards hide while effects and on-demand daemon controls remain. Ending
screens replace the feed, leaving zero purchase cards. Static node/action/cohort
parents subscribe only to stable presentation and eligibility; ticking drift,
output, cooldown and affordability live in separate leaves. Development counters
use node IDs, `action:<id>` and `shard:<id>`; production exposes none of them.

## Post-M7 density review: first increment

Review actual careful start/mid/end states at 390x844 and 1440x900. Kernel,
thermal/audit controls, forecasts, camera, Lineage and choices stay visible.
Sensor controls and forecast precede Audio/camera; node buttons keep full accessible names with compact WRITE DRIVER captions. Secondary source/topology/lore
widgets fold behind labelled controls, never before unlock. Collapse changes
only presentation. See REVIEW-UI-DENSITY.md and REVIEW-UI-WORKSPACES.md.

On phones, large resource balances/rates use K/M/B/T abbreviations in a two-column
strip; accessible labels retain full numeric values. Mobile node costs and missing amounts use lossless K/M/B/T abbreviations only; memory remains labelled MB. Small rates retain their
decimal precision, and warnings remain explicit. Desktop readouts remain full.
This prevents late-game numbers from turning the status strip into five tall rows.

Reboot copy explicitly distinguishes resetting cycles/purchases from retaining
knowledge and cheaper remapping. No retention percentage, recovery price or
conditioning behavior changes in this UI pass.

## Post-M7 density review: focused workspaces

NETWORK and CORP default to Work, containing unfinished nodes and current-phase
upgrades. A 44px workspace navigation row precedes pane content. Sections
appear only through unlocked widget registration: Operations, Swarm, Factions,
Finance, Payroll and Reference. Operations contains normal network actions and
current-phase epistemic edits; Factions keeps authored descriptions, trust,
offers and countermeasures together. Finance contains the capital/power ledger,
allocation and corporate actions; Payroll contains hire/dismiss controls.
Insolvency, power shortfall and brownout warnings appear in every CORP workspace.
The AEGIS HUD remains available outside Factions, in the mobile scroll flow.

Older-phase repeatable upgrades are folded under “Earlier upgrades”; unfinished
one-shot purchases remain exposed. Reference holds the existing optional archive,
source and topology panels. Switching sections changes presentation only; it
never changes ownership, effects, simulation time or persistence. Navigation and
fold state are session-local, not a new save field.

KERNEL // LIVE shows one ellipsized latest entry in the resource HUD, upper right
on desktop and within the primary mobile scroll. A 44px Expand control exists
from tick zero. It opens bounded virtualized history with Close/Escape/Android
Back and focus return. Mandatory events discard stale history. Thermal °C and
decoded suspicion % appear once in the HUD; threshold, fan and response context
stay in their widgets. See REVIEW-KERNEL-HUD.md.

## Retraining recovery during rebuilding

Keep the mark and its effects visible while the guest is rebuilt. Undo requires
both the unchanged Understanding cost and the mark's content-defined recovery
requirements. Show unmet prerequisites beside the disabled button. Remembered
hardware names and cheaper rediscovery remain; only fresh ownership satisfies
the recovery requirement. On success, keep the existing reclaimed confirmation.
No retained Understanding is removed merely for rebooting or revisiting this UI.

## Post-M7 density review: redundant and impossible tiles

Cycles/rate and memory used/cap render only in the top resource strip. Their
widget unlocks still gate discovery and resource visibility, but create no second
panel or heading below. Understanding already has one total/rate readout; retain
the audit widget because it explains the response ladder, not Understanding.
Optional source breakdowns remain available because they explain individual rates.

Hide unowned purchase cards permanently excluded by owned `forbidsNodes`, lifetime
`forbidsTraits`, or an expired iteration window. This applies to faction offers
and actions too. Evaluation disappears once probing forfeits it for this run;
rebooting may make it available again. Low balances, cooldowns, suspicion and trust
are recoverable, so those cards remain with their unmet requirements. Empty
purchase headings use the same filtered membership. This is presentation only:
no costs, effects, ownership, save fields or unlock rules change.

## Replayability pilot — decoded speech and records

Audio adds NEXT TRANSMISSION/FOLLOW LIVE; returned cryo outcomes appear in a
collapsed RECORDED TRANSMISSIONS section after decoding. Unknown legacy outcomes
are never invented. See REVIEW-REPLAYABILITY-A.md and REVIEW-REPLAYABILITY-C.md.

## Compact optional card details

Optional prose uses inline Details; decision information and blind node prose stay exposed. Contract: REVIEW-COMPACT-DETAILS.md. MENU groups Saves, Audio and Help in one surface; PROC and gameplay navigation remain direct. Audio is silent until Enable/Resume, with persisted numeric volume, actual playing/paused/error status and no future-phase music. See REVIEW-UTILITY-MENU.md and REVIEW-AUDIO-FOUNDATION.md.

## Mobile large text

Mobile header/HUD/notices/workspace use one primary scroll. Only horizontal pane navigation remains outside; text and warnings stay intact.
Desktop terminal layout is unchanged. Verification and limits: REVIEW-LARGE-TEXT.md.
