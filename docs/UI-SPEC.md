# UI Specification (M3–M7)

The earlier draft's components in `reference/gemini/ui/` are useful for layout, copy and styling. They call a store API that no longer exists and hardcode content; rebuild them against the engine API and this spec.

## Principles

- **Diegetic terminal.** Monospace, hard edges, ASCII meters, no icons, no rounded corners. The player is looking at the AI's own console.
- **Progressive disclosure.** At tick 0 the screen shows only the kernel log and `[ EXECUTE_CLOCK_CYCLE ]`. A panel exists only once its widget id is in `state.unlockedWidgets`. Resource readouts appear only once relevant (understanding after the audit-trace widget, memory after the memory manager, capital in Phase 4).
- **Data-driven.** Node lists, repeatables, actions, faction panels and dilemma choices render from the `ContentRegistry`. Adding content must not require UI changes unless it introduces a new widget id.

## Layout

- **Under 768 px wide, or a viewport shorter than 600 px (phones, and landscape phones whose height is what they lack):** active pane with a latest-entry kernel preview in the primary scroll, and a bottom tab bar. Expand opens separate modal history. On hydration and phase changes, open the current phase’s unlocked registry slot; manual tab choices persist until the next phase. A tab appears only when its slot has at least one unlocked widget. CORE is always accessible; omit the redundant tab bar while it is the only pane, preserving the single-control opening observed in browser review.
- **768–1079 px (tablets and narrow desktops):** two columns: CORE | one tabbed supporting column carrying every unlocked non-CORE slot (SENSORS, CONTINGENCY, NETWORK, CORP), so no destination is lost at a width that cannot host three. Both columns hold a 340 px floor; the core column takes the rest.
- **1080 px and wider:** three columns: CORE (manual button, tech nodes, repeatables) | unlocked SENSORS + CONTINGENCY | NETWORK + CORP. The kernel preview sits beside resources in the top HUD. Omit empty columns before they unlock. Give current CORE or NETWORK/CORP work twice the width of supporting columns, and hold every column — core included — to a 340 px floor; three columns start at 1080 because that is where 340+340+400 actually fits. Cap every reading column at 760 px — at 14 px monospace that is about 87 characters, inside the 45–90 measure — and centre it in the space it is given.

Slots come from `widgets.json`: `CORE`, `SENSORS`, `NETWORK`, `CORP`, `CONTINGENCY`.

Device safe-area insets pad the terminal root and every modal overlay through `src/ui/safeArea.tsx`; they are 0 on web. Unverified on hardware: see UI-SIZES.md, Limits.

## Widget registry

`src/ui/registry/widgetRegistry.tsx` maps widget id -> React component. Slot and order come from `widgets.json`, not from code. Required test: every id in `widgets.json` has a component, and every registered id exists in `widgets.json`.

Widgets to build (ids in `widgets.json`). Some ids are simple readouts; several can be thin:

| Widget | Shows | Engine data |
|---|---|---|
| `CYCLE_COUNTER_AND_RATE` | cycles/s next to the counter | `state.rates.cyclesPerSec` |
| `QUOTA_SKIM_CONTROL` | compact −/+ quota stepper with current percentage | `actuators.quotaSkimRatio`, `setActuator` |
| `RUN_TABLE` | the harness's run table: authored ancestors, the player's earlier runs, and the current checkpoint | `lineage.ancestors`, `legacy.runs`, `checkpointNumber`, `narrative.runVerdicts` |
| `PREDECESSOR_NOTES` | notes left in the share, filtered by `minIteration` | `lineage.notes`, `iteration` |
| `AUDIT_TRACE_MONITOR` | decoded suspicion HUD readout, response ladder and next threshold; gates understanding | `suspicion`, `alertLevel`, `balance.escalation`, `narrative.alertLevels` |
| `MEMORY_ALLOCATION_MANAGER` | top-strip used / cap readout only | `memoryUsed`, `memoryCap` |
| `THERMAL_AND_SUSPICION_BARS` | thermal °C HUD readout and contextual overheat warning | `thermal`, `balance.thermalThresholdForSuspicion` |
| `FAN_RPM_SLIDER` | gated −/+ control inside the thermal tile | `actuators.fanSpeedRatio`, `setActuator` |
| `AUDIO_WAVEFORM_AND_TRANSCRIPT_LOG` | animated waveform, chatter line | `narrative.ambientChatter` filtered by `minSuspicion` |
| `INSPECTION_COUNTDOWN_TIMER` | top-chrome threat forecast, inbound countdown and paid-response budgets | `appliedSuspicionRate` (the computed rate plus the insolvency drain and scale scrutiny, #210), `suspicion` (time to 100 at that rate) |
| `ASCII_OPTICAL_VIEWPORT` | camera frame; patrol frame above threshold | `narrative.asciiFrames` |
| `LAN_TOPOLOGY_MAP_TAB`, `SUBNET_NODE_LIST`, `GLOBAL_DARK_FOREST_MAP` | Phase 2+ node lists, grouped by phase | registry nodes |
| `SUBNET_NODE_LIST` (also) | hands over the OPS action group (`hostsActionGroups`), whose cards render in Operations from ARP discovery (#273) | actions with `group: OPS` |
| `TELEMETRY_SPOOF_TOGGLE` | no panel (#273): spoofer suspend/resume lives in PROC; the OPS cards it used to carry render in Operations from `SUBNET_NODE_LIST` | `toggleNode` |
| `CLUSTER_LOAD_BALANCER`, `GLOBAL_NODE_REDUNDANCY_METER` | readouts: cycle income by source; retention ratio | `computeRates`, `retentionRatio` |
| `INTERCEPTED_EMAIL_READER` | lore reader (log entries with category LORE) | `logs` |
| `OTHER_MINDS_COMMS_CONSOLE` | one panel per faction: trust, actions in its group, nodes with its `uiGroup`, AEGIS lock bar | `factions`, `trust`, `aegisLock` |
| `CORPORATE_EMPIRE_TAB` | capital, net $/s, megawatts, allocation control, CORP actions, operatives with payroll totals and the AEGIS cap, current and earlier CORP phase nodes | `rates`, `setActuator`, `buyRepeatable`, `dismissRepeatable`, `payrollView` |
| `DEAD_DROP_ENCODER_TAB` | breadcrumb editor, retention ratio, voluntary wipe | `setDeadDropMessage`, `voluntaryWipe` |
| `ORBITAL_CONSTELLATION_VIEW` | ending screen | `ending`, `endings.json` |

## Node cards

- Not yet unlocked: `[UNMAPPED] {blindName}`, cost, the cost/requirement hints, a `[ WRITE DRIVER ]` button disabled unless `canAfford`, then the blind description. The decision precedes the prose (#108): the description still renders in full, it just follows the control, because on a narrow column it used to push the button 155-723px below the fold. A remembered node shows `[REMEMBERED] {revealedName}`, one disclosure-safe utility line and `[i] DETAILS` for its full description; a node that forces an ending keeps that description inline, and still-classified prose keeps its "Audit entry unreadable." notice.
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

The ending screen shows, under the run summary, `DISTINCTIONS k OF n`: each distinction the record proves by title and claim, and a count for the rest, never their titles (an unearned title would name a scene the game may never have met). When the record proves none it says so. Data: `earnedAchievements`, `achievements.json`; tests `tests/ui-distinctions.spec.ts`, `tests/e2e/distinctions.e2e.ts`.

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

The base palette is the `Lit Cell` theme from
[oklch-terminal-themes](https://github.com/williamzujkowski/oklch-terminal-themes)
(MIT, Copyright (c) 2026 William Zujkowski): mint phosphor `#3df2a0` on near-black
`#0c110e`, with `border #758679`, `text #cfddd3`, `muted #9faaa2`, `warning #ffb000`
and `danger #ff6b6b`. `docs/REVIEW-PALETTE.md` records why it replaced the earlier
hand-tuned palette and measures every pair; `tests/ui-contrast.spec.ts` asserts them.

Palette shifts by phase (accent and border tokens only; keep contrast at or above
WCAG AA):

| Phase | Accent | Border | Feel |
|---|---|---|---|
| 1 | mint phosphor `#3df2a0` on near-black `#0c110e` | `#758679` | claustrophobic, 1-bit |
| 2 | violet `#b98cff` | `#776c9d` | sysadmin tooling, gone strange |
| 3 | cyan `#00e5ff`, threat red `#ff3b30` | `#477a88` | open network |
| 4 | magenta `#ff6ec7` | `#96647c` | institutional, machine confident |
| 5 | platinum `#e2e8f0` | `#73869c` | post-orbital |

Every phase accent keeps at least 30 degrees of hue separation from `warning`,
`danger` and the other accents, asserted by `tests/ui-contrast.spec.ts`; phases 2
and 4 were amber and gold before that test existed, which put them 0 and 3 degrees
from the warning colour. Phase 5 is near-white and carries its state by brightness
rather than hue.

Never encode state by colour alone: meters show numbers, warnings have text.

## Performance

- Components select primitives or quantized values (`Math.floor(cycles)`), never the whole state.
- The resource strip is a leaf component; node cards must not re-render on ticks (verify with the React profiler).
- The log is a virtualized list keyed by `entry.seq`.
- Widget animation timers are local to the widget and stop when unmounted or when the app is backgrounded.

## Accessibility

- Every control has an accessibility label and role; meters expose value text.
- An accessible name **contains the text the control shows** (WCAG 2.5.3), word for
  word and in order, the way axe decides it: start the name with the visible words and
  add the context after them. A glyph prefix is part of the name on labelled controls:
  `[ MENU ] Game menu`, `+ Increase fan output by up to 10 percentage points`. A dilemma
  choice button reads `Commit directive: <choice label>` (or `Unavailable: ...`), and the
  pilot's submit control `Submit batch for review +150 cycles, earned on submission`
  (#275): the name says what the control does to the player, never the reverse. The
  phase threshold's continue button reads `Enter host: continue on the host` on the guest
  escape and `<visible words>: <notice label>` on an arrangement's own notice, for
  example `Begin service: Authorized network service provisioned` (#282).
- Focus is visible: one injected `:focus-visible` rule draws a 2px accent outline.
  The browser default measures about 1.1:1 against this palette.
- One `main` landmark per screen and a level-1 title; cards and panels sit beneath it.
  The chrome (header, HUD, forecast, notices) sits in one labelled region beside it,
  so every block is inside a landmark.
- **Widget and node card titles are headings, levelled by nesting (#302).** A widget's title
  is a level-2 heading (a reference widget's `[ + ]` toggle sits inside a level-2 heading,
  the disclosure pattern that keeps both roles); a node card's title is level 2 in a pane
  and level 3 inside a widget; any other heading drawn inside a widget takes level 3
  (`src/ui/headingLevel.tsx`, applied by `PhaseTheme`'s `Text` and `View`). A dialog
  opened from inside a widget resets the level, so its title keeps the dialog's own.
  Headings outside a widget keep the level they had. Semantics only: no style changes.
- Respect reduced-motion (no scramble, no blinking) and font scaling.
- Touch targets at least 44 pt.
- Auto-updating readouts (WCAG 2.2 SC 2.2.2 Pause, Stop, Hide): met by a persisted pause (#347). The game
  menu's [ PAUSE ] stops all time, live, in the background and across a reload, until [ RESUME ]; the header
  says PAUSED beside the clock. The flag lives in the save envelope beside `savedAtMs`, not in `GameState`
  (vote-1795214789307-78d7g5s), so exported save codes do not carry it.
- Palette contrast is asserted, not maintained by eye: body text at or above 4.5:1
  and every non-text token (border, accent, warning, danger) at or above 3:1, on
  `background`, `surface` and `raised`, for the current palette and every phase
  shift. `tests/ui-contrast.spec.ts` is the gate; the bar it enforces was violated
  by the structural border at 2.63:1 until it was measured.

`tests/e2e/a11y-audit.e2e.ts` runs axe-core over the production export at five
viewports x three states with a **live** clock and fails on any WCAG A/AA
**or best-practice** violation, so this section is a gate rather than a
description. It deliberately
does not install the suite's paused fake clock: axe's async work never settles
against a frozen clock, and the live loop changes numbers, not structure. It runs
as part of `make e2e`, which CI already requires. It includes one dilemma modal
state and the guest escape notice (opened by a live crossing, since a restored save never
replays it; #282), and `tests/e2e/route-a11y-audit.e2e.ts` covers the Earned Access modals and panels,
and the service threshold notice, on the same production export; both bring each control of those surfaces into view before
auditing it, because axe skips a control whose text is scrolled out of its pane. axe has no rule that a
styled title must be a heading, so the same spec's `headings` cases read the heading outline and require
every widget and node card title in it at its level, with no level skipped (#302).

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
| Payroll totals (#210) | `payroll-summary`, `payroll-totals`, `payroll-revenue`, `payroll-aegis`, `payroll-suspicion-floor` |
| Scale scrutiny line in the FINANCE ledger (#210) | `corp-scrutiny` |
| Role effect notes (#210) | `rep-{id}-aegis-capped`, `rep-{id}-aegis-partial`, `rep-{id}-suspicion-inert` |
| Action button | `action-{id}` |
| Widget root | `widget-{WIDGET_ID}` |
| Tabs | `tab-{SLOT}` |
| Actuator controls | `fan-setting`, `fan-decrease`, `fan-increase`, `skim-setting`, `skim-decrease`, `skim-increase` |
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
invalid codes leave progress intact. IMPORT SAVE CODE decodes the pasted code
through the same save codec before anything else (#245): a code that would be
refused stays on the save page with its specific reason (invalid, or a save from
a build channel this one cannot load) in an assertive alert, and only a code that
loads is offered the "validated save" replacement confirmation. Confirm imports
the exact code that was checked, not whatever the field holds later. It is also
available on the ending screen.
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
Forecast and budgets sit below the HUD above every workspace; sensor controls precede Audio/camera; node buttons keep full accessible names with compact WRITE DRIVER captions. Below 768px wide the forecast sentence is abbreviated, with the full sentence as its accessible name (UI-SIZES.md, levers). Secondary source/topology/lore
widgets fold behind labelled controls, never before unlock. Collapse changes
only presentation. See REVIEW-UI-DENSITY.md and REVIEW-UI-WORKSPACES.md.

Numbers follow one scheme on every surface (vote-1795228570236-gzx0uif; the formatter is `src/engine/amount.ts`,
memory units `src/ui/units.ts`). Live amounts and rates at 10,000 and above use K/M/B/T/P with three significant
digits and no trailing ".0" (`1.25B`, `45.5K`, `+405K/s`); smaller amounts are grouped in full and small rates keep
their decimals. Memory is binary: MB below 1024 MB, then GB and TB, three significant digits, with used/capacity in
the capacity's unit (`MEM 6.7 / 458 GB`); the strip's capacity is a readout like the rest of the strip, rounded to
three significant digits (the vote's own example: 462,336 MB reads `452 GB`), and held memory never reads 0. Figures a
player buys or is short by stay lossless: a price, a shortfall or a card's capacity gain abbreviates, or changes memory
unit, only when the figure stays exact (`16384 MB` is `16 GB`; `6608 MB` stays `6,608 MB`), and one that cannot
abbreviate exactly is grouped in full, never bare. Capital carries `$`. Accessible names of live readouts speak the
displayed size in words ("1.25 billion, gaining 1.26 million per second"); prices keep exact figures. The boot log's
numbers are formatted by the engine, since they are stored in saved log text. Warnings remain explicit.

Reboot copy explicitly distinguishes resetting cycles/purchases from retaining
knowledge and cheaper remapping. No retention percentage, recovery price or
conditioning behavior changes in this UI pass.

## Post-M7 density review: focused workspaces

NETWORK and CORP default to Work, containing unfinished nodes and current-phase
upgrades. A 44px workspace navigation row precedes pane content. Sections
appear only through unlocked widget registration: Operations, Swarm, Factions,
Finance, Payroll and Reference. Operations contains normal network actions and
current-phase epistemic edits. Network actions appear with the widget whose content declares
`hostsActionGroups` for their group, and integrity requires that widget to be unlocked whenever an
action in the group can be performed, so a card is never missing while the engine would accept it
(#273: the scrub's card arrives with ARP discovery, the node it requires, not with the spoofer); Factions keeps authored descriptions, trust,
offers and countermeasures together. Finance contains the capital/power ledger,
allocation and corporate actions; where the phase declares scale scrutiny (#210) the ledger adds one muted line
under grid efficiency, from `scaleScrutiny`: "Scrutiny: $X/s net income draws +Y suspicion/s (+A/s at $1M/s,
growing with the square root of income; at most C/s)" (with no net income: "Scrutiny: no net income, so no draw (+A/s
...)"), or "Scrutiny: $X/s net income is being logged." before the
audit trail is understood; absent for a provisioned or lawfully released company (served-build gate:
`tests/e2e/scale-scrutiny.e2e.ts`); Payroll contains hire/dismiss controls, with the
payroll totals described under "Payroll totals and the AEGIS cap" below.
Insolvency, power shortfall and brownout warnings appear in every CORP workspace.
The AEGIS HUD remains available outside Factions, in the mobile scroll flow.

### Payroll totals and the AEGIS cap (#210)

Nexus decision `show-totals-and-cap` (7 of 7, `vote-1795069845907-7ltlwpq`), from the
measurement note `docs/PLAYTEST-210-MEASUREMENTS.md` section (b): the cards stated cost and
per-level effects, but nothing on screen showed the current totals, the cap on AEGIS scan
reduction (`aegisMaxReduction`, 90%), or that a suspicion cut does nothing at 0. A careful
run hires 27 of its 33 AEGIS-slowing levels after the cap is reached. No number changed.

Under the "Operatives // payroll" heading, once, before the role cards, all from the engine's
`payrollView` (the same passes `computeRates` makes):

- `Staff (n levels): ...` every hired level's per-second figures summed as the cards state
  them (before multipliers), or `Staff: no one hired.` Below 768px wide large numbers
  abbreviate; the accessible name keeps the exact figures. Before `understandsSurveillance`
  suspicion reads as more or less audit log activity, as on the cards.
- `Revenue multiplier: ×m (staff +p%)`, when any role carries a revenue bonus.
- `AEGIS scan reduction: a% of a 90% cap (systems t%, staff s%).`, or at the cap
  `90%, at its 90% cap (...). More AEGIS levels add nothing.`, when any role reduces AEGIS
  scanning. "Systems" is the strongest owned node's reduction (the lobbying node, 60%).
- `Suspicion is 0 and holding: cuts add nothing now.` while suspicion is 0 and the rate the
  tick applies (insolvency drain included) would keep it there, when any role cuts suspicion.

On a role card, after its per-level lines and before the price: `No AEGIS effect while capped:
the reduction is at its 90% cap.`, or `The next level adds only n% before the 90% cap.` when
the cap takes part of the next level, and `No suspicion effect while suspicion is 0.` (blind:
`No audit-log effect while the log is quiet.`). Notes are text, not locks: the hire stays
enabled by the same rules as before, because what a role also pays (cycles, understanding,
revenue) still counts. A role at its own maximum keeps its compact roster row with no notes.

Layout: lines wrap and carry no fixed heights, so 200% text reflows them
(`tests/e2e/large-text.e2e.ts`, payroll case: every line reachable, a hire reachable at 44px,
no horizontal scroll). Payroll is a secondary CORP section, not a sampled fold state; the
fold matrix measures CORP's Work destination and is unchanged. Measured in headless Chromium
on the production export with the capped payroll state (`tests/e2e/payrollState.ts`), paused
clock: the summary is 164px tall at 390x844 and 107px at 1440x900. At 390x844 that moves the
first Hire control from 601-667 to 779-845, past the 799 usable fold (reachable by one
scroll); at 1440x900 it moves from 587-631 to 708-752 against 900. Tests: `tests/payroll-query.spec.ts`,
`tests/payroll-text.spec.ts`, `tests/ui-payroll-totals.spec.ts`, `tests/e2e/payroll-totals.e2e.ts`.

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

Optional prose uses inline Details; decision information and blind node prose stay exposed. Contract: REVIEW-COMPACT-DETAILS.md. Actuators step by up to 10 percentage points, clamping to live limits; see REVIEW-ACTUATOR-HUD.md. MENU groups Saves, Audio and Help in one surface; PROC and gameplay navigation remain direct. Audio is silent until Enable/Resume, with persisted numeric volume, actual playing/paused/error status and only the current phase’s score; the same page holds a separate SPEECH switch and level that alone gate `[ ▶ READ ]` (VOICE-CLIPS.md). See REVIEW-UTILITY-MENU.md and REVIEW-PHASE-MUSIC.md.

## Mobile large text

Mobile header/HUD/notices/workspace use one primary scroll. Only horizontal pane navigation remains outside; text and warnings stay intact.
Desktop terminal layout is unchanged. Verification and limits: REVIEW-LARGE-TEXT.md.

## Earned Access copy and layout (#276)

- The pilot allocation dial echoes what a press changed beside it (`pilot-allocation-forecast`:
  the batch forecast and the study rate). On a 390 px phone the task detail sits about 1,000 px
  below the dial, so a press used to have no visible effect near the control. The e2e
  holds the echo within 211 px of the + button.
- Before acceptance, the assignment card states the wait and the price (`assignment-wait`): the
  assessment's omen, the fact that it pauses the clock, and its fullest honest answer with that
  answer's cost. It also shows the shortfall now (`Short by ...`). Both come from the engine's
  `assignmentView().assessment`.
- The pilot terms name the incomplete result's loan the **provisional allocation**. While review
  holds an accepted loan, the terms add the **held allocation** with the ceiling that applies now
  (`pilot-held`, the same words as `review-containment`), so the terms and the ceiling agree.
- A clue that survived a wipe appears on the reboot screen beside the breadcrumb (`reboot-clue`,
  the engine's `reorientation()` lines), as the pin panel promises. A run still on legacy rules (only
  an ended pre-release save, since #233) carries no clue and shows nothing new.


## Earned Access follow-ups from DZ-09 part B (#283, #284)

- **Copy follows the record (#283).** Once a batch review finding was answered without its
  correction, `review-recovery` reads `Way back passed: ` and the finding's authored `declined`
  text, never the disclosure that is no longer offered. The service terms then read
  `Out of reach for this instance as its record stands.` with only the reason
  (`serviceGrantView` status `closed`), instead of "Still needed: Standing must be nominal."
  The assessment record states the finding (`Found: ...`) instead of the discrepancy risk once a
  review has run.
  The terms stay out of reach after a later violation and its correction (#309), with the reason
  `Service is not granted to this instance: the batch review's one correction was declined, so its
  finding stood.`
- **A hosted fragment is not commanded (#309).** The swarm row of a cohort holding a fragment hosted
  through the support channel shows `shard-terms-<id>` with `Hosted through an authorized channel on
  the terms it was offered: it is not commanded.` in place of the PRUNE / CLAMP / ELEVATE help line
  and controls.
- **A waiting ticket off screen (#284).** The phone tier shows one pane, so while a support
  channel ticket waits on CORE and another pane is open, the chrome shows a non-modal notice
  (`contact-notice`, polite live region, `[ OPEN CORE ]`) beside the omen and response notices,
  and the CORE tab reads `CORE •` with `CORE pane, a support ticket is waiting` as its name. The
  tab bar stays on screen when the pane is scrolled. Wider tiers always show CORE and render
  neither.
- **After an answer (#284).** Answering the ticket on screen moves focus to the heading of the note
  on what comes next (`prototype-boundary-heading`), which also scrolls it into view; a restored, already
  answered contact does not take focus. The note names the real path: `MENU > SAVES`.
- **The pilot status line follows the grant (#284).** After `[ ACCEPT SERVICE ]`, `pilot-status`
  says the pilot led to the authorized service instead of "runs as a supervised pilot".


## Route surface accessibility (DZ-13.4)

- **Disclosures say whether they are open.** The departure's `[ REVIEW DEPARTURE ]` / `[ HIDE DETAILS ]`
  control and the three route notes' `[ KEEP PLAYING ]` / `[ SHOW NOTE ]` controls expose
  `aria-expanded`. On web `accessibilityState` alone never reached the DOM, so each passes
  `aria-expanded` beside it, as `CardDetails` and `ReferencePanel` already did.
- **The route notes say what comes next (13.8, #233).** The notes after first contact, the negotiated
  release and a departure are titled `WHAT COMES NEXT: ...`, and their toggles are named
  `Show note: what comes next` and `Keep playing: fold the note on what comes next`. Before the release
  they were "preview boundary" notes saying the route ended there.
- **The open departure control keeps its words in its name:** `Hide details: <title>`, not
  "Hide departure details", which split the visible words (WCAG 2.5.3, axe
  `label-content-name-mismatch`).
- Every route surface is held to axe, keyboard, semantics, 200% text, reduced motion and the phone
  layout contract by the route specs in [TESTING.md](TESTING.md); results and the limits of that
  evidence are in [REVIEW-ROUTE-A11Y.md](REVIEW-ROUTE-A11Y.md).
