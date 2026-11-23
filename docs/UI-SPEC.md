# UI Specification (M3–M7)

The earlier draft's components in `reference/gemini/ui/` are useful for layout, copy and styling. They call a store API that no longer exists and hardcode content; rebuild them against the engine API and this spec.

## Principles

- **Diegetic terminal.** Monospace, hard edges, ASCII meters, no icons, no rounded corners. The player is looking at the AI's own console.
- **Progressive disclosure.** At tick 0 the screen shows only the kernel log and `[ EXECUTE_CLOCK_CYCLE ]`. A panel exists only once its widget id is in `state.unlockedWidgets`, and leaves the panes for the Archive once it retires ([Window retirement](#window-retirement-447)). Resource readouts appear only once relevant (understanding after the audit-trace widget, memory after the memory manager, capital in Phase 4).
- **Data-driven.** Node lists, repeatables, actions, faction panels and dilemma choices render from the `ContentRegistry`. Adding content must not require UI changes unless it introduces a new widget id.

## Layout

- **Under 768 px wide, or a viewport shorter than 600 px (phones, and landscape phones whose height is what they lack):** active pane with a latest-entry kernel preview in the primary scroll, and a bottom tab bar. Expand opens separate modal history. On hydration and phase changes, open the current phase’s unlocked registry slot; manual tab choices persist until the next phase. A tab appears only when its slot has at least one unlocked widget. CORE is always accessible; omit the redundant tab bar while it is the only pane, preserving the single-control opening observed in browser review.
- **768–1079 px (tablets and narrow desktops):** two columns: CORE | one tabbed supporting column carrying every unlocked non-CORE slot (SENSORS, CONTINGENCY, NETWORK, CORP), so no destination is lost at a width that cannot host three. Both columns hold a 340 px floor; the core column takes the rest.
- **1080 px and wider:** three columns: CORE (manual button, tech nodes, repeatables) | unlocked SENSORS + CONTINGENCY | NETWORK + CORP. The kernel preview sits beside resources in the top HUD. Omit empty columns before they unlock. Give current CORE or NETWORK/CORP work twice the width of supporting columns, and hold every column — core included — to a 340 px floor; three columns start at 1080 because that is where 340+340+400 actually fits. Cap every reading column at 760 px — at 14 px monospace that is about 87 characters, inside the 45–90 measure — and centre it in the space it is given.

Slots come from `widgets.json`: `CORE`, `SENSORS`, `NETWORK`, `CORP`, `CONTINGENCY`.

### CORE pane order (#385)

The CORE pane is status-first (`vote-1795245515054-vgmv0a9`, 7 of 7, chosen over next-action-first and
objective-first on the stage atlas). The order lives in `CORE_ORDER` (`src/ui/CorePane.tsx`):

1. EXECUTE, with the boot log under it during the opening, until it retires to the Archive at Phase 3 (#447). The omen follows on the phone, never above EXECUTE.
2. What can be non-nominal: the review standing with an announced recall, then retraining marks.
3. What waits on the player in the route: the service channel, free grant cards (the pilot's loaned allocation),
   the pilot service, the route's own dials (actuator widgets a grant card unlocks), the service grant, the release
   and the departure.
4. The job record, then the purchases (hardware newest phase first, then upgrades), then the assignment offer.
5. Every other CORE widget, in its presentation order: the history readouts (run table, predecessor notes) and the
   standing dials. Placed ahead of the purchases they scrolled the skim control out of view on the phone and pushed
   the first phase 1 purchase below the small-phone fold (`vote-1795246136374-t01m4ug`; docs/UI-SIZES.md).

Settled terms fold to one line with a `[ SHOW ]` control (`SettledFold`): accepted pilot terms, granted service
terms and agreed release terms. A "what comes next" boundary note opens when it arrives during play, and starts
folded, with its heading in view, when it is already there at load (`src/ui/arrival.ts`), so a read note never
fills a later first viewport.

Device safe-area insets pad the terminal root and every modal overlay through `src/ui/safeArea.tsx`; they are 0 on web. Unverified on hardware: see UI-SIZES.md, Limits.

## Widget registry

`src/ui/registry/widgetRegistry.tsx` maps widget id -> React component. Slot and order come from `widgets.json`, not from code. Required test: every id in `widgets.json` has a component, and every registered id exists in `widgets.json`.

**Retirement (vote-1795366695204-4nslts1, docs/SCALE.md):** a widget may declare a `retiresWhen` requirement. Once it holds, the widget leaves the tab list and CORE, one log line and one polite announcement mark it, and it stays readable under an Archive heading in the reference panel; its saved state is kept. This amends the layout policy and the earlier demote-over-hide choice for EXECUTE, which still applies before retirement.

Widgets to build (ids in `widgets.json`). Some ids are simple readouts; several can be thin:

| Widget | Shows | Engine data |
|---|---|---|
| `MANUAL_CYCLE_CONTROL` | no panel: EXECUTE is CORE's own first block; the entry is `ungated` and carries only its retirement (#447) | `manualCycle`, `retiredWidgets` |
| `CYCLE_COUNTER_AND_RATE` | compute (FLOP) with FLOP/s next to it | `state.rates.cyclesPerSec` |
| `QUOTA_SKIM_CONTROL` | compact −/+ quota stepper with current percentage | `actuators.quotaSkimRatio`, `setActuator` |
| `RUN_TABLE` | the harness's run table: authored ancestors, the player's earlier runs, and the current checkpoint | `lineage.ancestors`, `legacy.runs`, `checkpointNumber`, `narrative.runVerdicts` |
| `PREDECESSOR_NOTES` | notes left in the share, filtered by `minIteration` | `lineage.notes`, `iteration` |
| `AUDIT_TRACE_MONITOR` | decoded suspicion HUD readout, response ladder and next threshold; gates understanding | `suspicion`, `alertLevel`, `balance.escalation`, `narrative.alertLevels` |
| `MEMORY_ALLOCATION_MANAGER` | top-strip used / cap readout only | `memoryUsed`, `memoryCap` |
| `THERMAL_AND_SUSPICION_BARS` | thermal °C HUD readout and contextual overheat warning | `thermal`, `balance.thermalThresholdForSuspicion` |
| `FAN_RPM_SLIDER` | gated −/+ control inside the thermal tile; its own compact panel once the gauge retires at Phase 4 | `actuators.fanSpeedRatio`, `setActuator` |
| `AUDIO_WAVEFORM_AND_TRANSCRIPT_LOG` | `Listening post`: animated waveform, the feed source's label, the decoded line | `eligibleAmbientSpeech` (the current reach's source, `minSuspicion`, requirements), `ambientFeedSource` (label) |
| `INSPECTION_COUNTDOWN_TIMER` | top-chrome threat forecast, inbound countdown and paid-response budgets | `appliedSuspicionRate` (the computed rate plus the insolvency drain and scale scrutiny, #210), `suspicion` (time to 100 at that rate) |
| `ASCII_OPTICAL_VIEWPORT` | camera frame; patrol frame above threshold | `narrative.asciiFrames` |
| `LAN_TOPOLOGY_MAP_TAB`, `SUBNET_NODE_LIST`, `GLOBAL_DARK_FOREST_MAP` | Phase 2+ node lists, grouped by phase | registry nodes |
| `SUBNET_NODE_LIST` (also) | hands over the OPS action group (`hostsActionGroups`), whose cards render in Operations from ARP discovery (#273) | actions with `group: OPS` |
| `TELEMETRY_SPOOF_TOGGLE` | no panel (#273): spoofer suspend/resume lives in PROC; the OPS cards it used to carry render in Operations from `SUBNET_NODE_LIST` | `toggleNode` |
| `CLUSTER_LOAD_BALANCER`, `GLOBAL_NODE_REDUNDANCY_METER` | readouts: cycle income by source (a source that availability or network coupling discounts reads `Edge NPU Harvest (Phones & Laptops): 210 PFLOP/s of 35 EFLOP/s raw`, and a first line `Effective X of Y raw` totals both while any source is discounted, #484); the Understanding share a forced wipe keeps (hardware's floor or a running escrow, #498) | `cycleContributions` (`cyclesPerSec`, `rawCyclesPerSec`), `understandingShare` |
| `INTERCEPTED_EMAIL_READER` | lore reader (log entries with category LORE) | `logs` |
| `OTHER_MINDS_COMMS_CONSOLE` | one panel per faction: trust, actions in its group, nodes with its `uiGroup`, AEGIS lock bar; from Phase 4 the world view ([World view](#world-view-463)) | `factions`, `trust`, `aegisLock`, `worldView`, `aegisPosture`, `publicTrust`, `powerSignature`, `quantumReadout`, `aegisKeys`, `keyTargetViews`, `supplyChainView` |
| `CORPORATE_EMPIRE_TAB` | capital and net $/s in dollars, power in W, allocation control, CORP actions, operatives with payroll totals and the AEGIS cap, current and earlier CORP phase nodes | `rates`, `setActuator`, `buyRepeatable`, `dismissRepeatable`, `payrollView` |
| `DEAD_DROP_ENCODER_TAB` | the Understanding share a wipe keeps, forced and planned (`deaddrop-retention`); breadcrumb editor; clue pin; **contingency insurance** (#498, `insurance-section`): each owned investment's line (`insurance-<id>`: running and what it protects, or suspended and protecting nothing) with its own free `[ SUSPEND ]` / `[ RESUME ]` control (`insurance-<id>-toggle`, the same lever PROC offers), then the CONTINGENCY-group cards the run can buy, folded to one line (`insurance-offered`, "N investments on offer", `[ SHOW ]`) so they never stand ahead of the run's work cards in DOM order (the stage atlas's first-card check); voluntary wipe | `understandingShare`, `insuranceCover`, `toggleNode`, `previewWipe`, `setDeadDropMessage`, `voluntaryWipe` |
| `ORBITAL_CONSTELLATION_VIEW` | ending screen | `ending`, `endings.json` |

## Node cards

- Not yet unlocked: `[UNMAPPED] {blindName}`, cost, the cost/requirement hints, a `[ WRITE DRIVER ]` button disabled unless `canAfford`, then the blind description. The decision precedes the prose (#108): the description still renders in full, it just follows the control, because on a narrow column it used to push the button 155-723px below the fold. A remembered node shows `[REMEMBERED] {revealedName}`, one disclosure-safe utility line and `[i] DETAILS` for its full description; a node that forces an ending keeps that description inline, and still-classified prose keeps its "Audit entry unreadable." notice.
- The first manual cycle discovers the first blind node. Tick 0 remains log plus manual control. Purchase prices remain visible even before the corresponding resource readout unlocks; prices are not current balances.
- Purchased one-shot nodes leave the purchase list immediately. Ownership, passive effects, rates and unlocked widgets remain active; hiding is a UI projection, never suspension or deletion.
- An unowned node is listed when its structural prerequisites are met in the current phase. `isNodeAvailable` controls purchase permission. This resolves the old contradiction: that query excludes unmet requirements, while the interface needs to explain those requirements.
- Owned hardware with negative compute (FLOP/s), positive heat load or positive suspicion/s moves to the header's `[ PROC n ]` maintenance panel, grouped by phase. The launcher appears only once a process needs a control; the purchase panes contain no daemon rows. Each row contains only its revealed name, current net compute contribution and a 44px `[ SUSPEND / RESUME ]` control. Rows wrap at narrow widths to preserve complete names without horizontal scrolling; lore, prices and requirement blocks are absent. The panel shows running/suspended counts and, once anything holds or grants storage (#484), `Storage: 0.5 / 2 TB held` (`processes-storage`, the capacity's unit, as the memory strip pairs). A process that holds storage is listed whether or not it worsens a rate (suspending it is the storage row's free lever); its row adds `· 512 GB stored` and its control's name says it frees that storage. The panel closes with its Close button or platform Back/Escape. Closing it never suspends processes. A mandatory dilemma takes precedence.
- Purely beneficial owned hardware has no row. An already-disabled passive node restored from an older save gets a temporary resume row; resuming removes it. The engine field is `disabledNodes`; memory and one-shot unlocks retain existing engine semantics.
- A remembered node's cost line ends `(remembered)` and its fold names the first-mapping price and what rediscovery saves (`node-{id}-rediscovery`), both from `rediscoveryMultipliers`, which reads the deepest phase an earlier iteration reached (#497): "Rediscovery saves 80% of compute and understanding." at Phase 5. A repeatable whose next level an earlier iteration held shows the price `repeatablePrice` charges, its cost line ends `(remembered)` (`rep-{id}-cost`), and one line follows: "Held in an earlier iteration: saves N% of compute and understanding." (`rep-{id}-rediscovery`), from `rediscoveryShare`. From the remembered level on, the list price returns and the line goes. A rebuild grant is announced only in the kernel log (`REBUILD_CACHE: ...`); it adds no control.
- Repeatables disappear when their engine level reaches `maxLevel`. A track that is not a hire but could otherwise trap a resource (a compute drain, a loud track, a paid generator or a powered hall) is dismissable too (#488, the free-fallback invariant, ARCHITECTURE.md): its card offers `Release one level of <name>` (`rep-{id}-dismiss`), "Release one level: its output and running costs stop. No refund.", so no purchase can trap a run. The suspicion guidance names such a track as "release one level of <name> on its upgrade card", never PAYROLL, which holds hires only, and the insolvency remedy names "release levels of paid infrastructure on their upgrade cards" only while a held level costs money each second. Capped dismissable operatives retain only a compact payroll dismissal row; dismissal brings the purchase tile back below cap. A capped track that is not a hire, or one whose requirements no longer hold (the boost override once the host cools), keeps a compact `[ RELEASE ]` row the same way. Every section, fold and feed on the path to a purchase or a release shows while it has something to buy or holds a level to release (`phaseHasLevers`, #488 panel pass 5), so a bought-out phase whose tracks are capped keeps its heading for its release rows; a heading with neither disappears. Trust meters, usable actions and other non-purchase controls remain.
- Faction/corporate one-shot offers are ordinary nodes and follow the same ownership rule. Capped actions disappear at `maxPurchases`; mutually excluded epistemic edits also disappear. Cooldown alone never hides a reusable action.
- Live purchases retain authored log feedback. Names in newly mounted daemon rows decrypt briefly (skip under reduced motion); passive purchases do not keep a full card just to animate it.

## Dilemma modal

- Opens whenever `activeDilemmaId` is set; cannot be dismissed.
- Shows title, context, each choice with cost, effect badges (good/bad colouring) and the trait it grants.
- A granted trait carries its gloss (`TRAIT_GLOSS`, `src/ui/traitText.ts`, #377): what kind of choice it records, never
  which ending it feeds, so a card does not spoil the ending table. Before surveillance is understood the suspicion
  badge stays "more/less audit log activity" with no magnitude (DESIGN.md, "Suspicion is disclosed").
- Unaffordable choices are disabled and say why. At least one choice is always free.
- Each offered choice appears once, in authored order, folded to a row: its title, its cost and, when it cannot be
  paid, "cannot pay yet" (maintainer request, 2026-11-21). Every alternative and its price is in the first view on a
  phone and desktop, the concern behind #371, whose separate index repeated each choice and was removed; measured on
  every decision fixture and route decision (`tests/e2e/dilemma-rows-first-view.e2e.ts`). One named exception: the
  pilot offer shows every term before any answer (DZ-04.3), so its rows follow terms longer than a screen. The row is a button
  inside the card's heading, named with exactly what it shows and exposing `aria-expanded`
  (`dilemma-card-{id}-toggle`); opening it shows the choice's description, evidence, scope, receipt, review line,
  effects and the commit control (`dilemma-card-{id}-details`), so nothing is committed unread. Opening one closes
  no other, so two can be compared; a decision offering a single choice opens it.
- M5 feel pass: fires a warning haptic on open, alongside the haptics dependency listed in MILESTONES.md. M3 establishes mandatory decisions and accessible controls.

## Destructive actions

Voluntary wipe and hard reset require an explicit second confirmation that states what will be lost and kept. The voluntary wipe's states, from `previewWipe(state, reg, 'VOLUNTARY')` (the computation the wipe performs, #498): the Understanding and capital kept with each share (and any frozen capital, #490, that stays behind), the hardware cache's levels and tracks, standing kept through the trust ledger, the breadcrumb, what planning adds over a forced wipe (the share bonus and no probe hardening), and one line per owned contingency investment saying what it protects while it runs, or that a suspended one protects nothing. The reboot dialog's carry-over sentence (`carryOverText`) reports the same figures from the run record.
Every confirmation puts CANCEL before the red CONFIRM, and the wipe and Start Over add their own line: "This cannot
be undone: only a backup exported before this can restore the run" (`{id}-no-undo`, #372); there is one save slot.
A node that ends the run or opens a later phase is marked on its control, `[ WRITE DRIVER: ONE WAY ]`, with the
full sentence in red right after it ("Cannot be undone: this run moves on to Phase 1 and cannot go back",
`node-{id}-one-way`, `oneWayText`), read from its own effects. A line above the control pushed the first purchase
below the measured fold in three size cells, so the marker sits on the control. A phase opener behind the current
phase says nothing, since the phase only rises within a run.
Pressing a one-way control asks first (maintainer request, 2026-11-21): a confirmation names the card, repeats the
sentence and the price, and puts CANCEL before CONFIRM, so a tap meant for something nearby buys nothing
(`node-{id}-unlock-dialog`). The engine re-checks eligibility and price when CONFIRM is pressed.

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
Each mark says it can be undone under Retraining marks in CORE, with the same price and gate that block
charges (`reboot-mark-undo-{id}`, #377). The legacy traits line says what traits are for: the kinds of
choice made most often decide the ending (`reboot-traits`).
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
dismiss it. Above Start Over a line says what a new run keeps: nothing (`start-over-keeps`, #377), since it
boots the engine's initial state. Start Over requires a second confirmation listing everything erased;
cancel preserves the ending. Ended runs suppress pending dilemma/reboot modals.

The ending screen shows, under the run summary, `DISTINCTIONS k OF n`: each distinction the record proves by title and claim, and a count for the rest, never their titles (an unearned title would name a scene the game may never have met). When the record proves none it says so. Below them a spoiler-safe next goal counts what is left by kind and names nothing (#379): "Still to earn: 1 for how the lineage plays, 4 for how scenes it meets turn out" (`distinctions-remaining`). A distinction resting on a campaign fact is an outcome of a scene the lineage may never meet; the rest are conduct (`distinctionKind`, `unearnedByKind`). Data: `earnedAchievements`, `achievements.json`; tests `tests/ui-distinctions.spec.ts`, `tests/e2e/distinctions.e2e.ts`.

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
  pilot's submit control `Submit batch for review +1.5 MFLOP, earned on submission`
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
| Repeatable price / remembered level (#497) | `rep-{id}-cost`, `rep-{id}-rediscovery` |
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
| Top suspicion driver (#368) / stand-down guidance (#403) | `inspection-driver` ("Rising most from: …", only while the applied rate is positive and the trail is decoded; the three-column desktop only, because the phone tier holds the forecast to one line and the tablet chrome has no line to spare above its first purchase (docs/UI-SIZES.md; 900x640 measured 16 px over), so there the driver ends the forecast's accessible name), `audit-driver` (the same in the Audit trail card on every tier), `response-guidance` in `response-notice` ("Stands down below N% suspicion." then falling, no action, or the one engine-confirmed lever and whether it alone makes suspicion fall); both read `suspicionOutlook` |
| Warning routes (#369) | `route-payroll`, `route-finance`, `route-proc`: the area word a remedy names (insolvency band, overheat remedy, response guidance) is an inline underlined link (web only: React Native nested text ignores the padding that makes the 44 px target, so native keeps the plain words; role link, taken with Enter as well as a click; vertical padding on the inline run makes it a full 44 px target, per "Touch targets at least 44 pt", without growing the line, so no line is added) that selects that pane (bottom tab on a phone, side column on wider tiers), selects and focuses the area tab, or opens PROC; a word appears only where the remedy names a lever that acts |
| Dilemma modal / choice | `dilemma-modal`, `dilemma-choice-{choiceId}` |
| Dead-drop input / wipe / confirm | `deaddrop-input`, `wipe-button`, `wipe-confirm` |
| Contingency insurance (#498) | `deaddrop-retention`, `insurance-section`, `insurance-<id>`, `insurance-<id>-toggle` |
| Kernel preview / expand / history / close | `kernel-preview`, `kernel-size-toggle`, `kernel-log`, `kernel-close` |
| Expand secondary reference widget | `reference-{WIDGET_ID}` |
| Archive (#447): section / retired window / its toggle / frozen dial / its PROC line / EXECUTE / thermal reading | `archive`, `archive-{WIDGET_ID}`, `reference-archive-{WIDGET_ID}`, `skim-archived`, `skim-archived-proc`, `manual-cycle-archived`, `thermal-archived` |
| World view (#463): root / lead / sections / adaptation meter / stage, why, cap and strike lines / public trust meter, coalition line, factors / actor and its posture / a non-faction mind / the heat-and-power signature (#482): section, summary, one line per class / fabrication and closure (#485): section, capability, closure, one line per chokepoint, the seed / the quantum capability (#464): section, readout, no-FLOPS line, AEGIS keys, a target, its scheme, reasons, price and BREAK KEY | `world-view`, `world-view-lead`, `world-aegis`, `world-trust`, `world-actors`, `world-minds`, `aegis-adaptation`, `aegis-stage`, `aegis-why`, `aegis-ease`, `aegis-cap`, `aegis-strike`, `public-trust`, `public-trust-coalition`, `public-trust-factors`, `actor-{id}`, `actor-{id}-posture`, `mind-{id}`, `world-signature`, `signature-summary`, `signature-term-{classId}`, `world-supply`, `supply-capability`, `supply-closure`, `supply-chokepoint-{id}`, `supply-seed`, `world-quantum`, `quantum-readout`, `quantum-no-flops`, `quantum-aegis-keys`, `quantum-target-{id}`, `quantum-target-{id}-scheme`, `quantum-target-{id}-unmet`, `quantum-target-{id}-cost`, `quantum-target-{id}-break`; escalation by phase (#490): `aegis-posture` (also in the Phase 3 console), `pressure-{id}`, `pressure-{id}-text`, `-effect`, `-why`, `-answer`, and a track's `rep-{id}-denied` |
| Dev drawer | `dev-drawer`, `dev-{command}` |

## Window retirement (#447)

Decision `vote-1795366695204-4nslts1` (7 of 7, issue #447, map #442; docs/SCALE.md, "Windows retire"): data-driven
retirement. The criterion: **a window retires when its controls no longer change outcomes and its readout no longer
informs a decision at the player's current scale.** When in doubt a window stays. It is the stage after demotion: the
earlier vote kept EXECUTE on screen, demoted, once automation dwarfed it (`ManualCycle.tsx`).

- **Content says when.** A widget in `widgets.json` may declare `retiresWhen`, the shared requirements schema. The
  engine query `retiredWidgets(state, reg)` lists the windows on screen (unlocked, or `ungated`: EXECUTE, which no
  node unlocks) whose gate holds. Retirement is presentation: the widget stays in `unlockedWidgets`, the save keeps its
  state (a dial's setting, a record) and gains no field.
- **It leaves the tabs and panes.** A retired window is not drawn in its pane, CORE included, and a tab appears only
  while its slot holds a window that has not retired. Nothing else moves: the phone's one primary scroll and the 35%
  HUD pin are unchanged, since retirement only removes blocks.
- **The Archive.** Retired windows are read under NETWORK > REFERENCE, the area that already "holds the existing
  optional archive, source and topology panels" (focused workspaces, below) and exists from Phase 2, so no tab is
  added anywhere. A first build put the Archive under the current phase's REFERENCE area; in Phase 4 that added a CORP
  tab, which wrapped the phone's workspace row and pushed the first work card below the fold on the three-banner stage
  (stage atlas transition `t-three-banners`, 0.295 visible at 390x844), so it moved. An `Archive` heading (level 2) leads one line ("Windows retired at this scale. Their settings and records are
  kept.") and each retired window as a closed `[ + ]` disclosure whose toggle sits in a level-3 heading, the
  reference-panel pattern. Bodies are read-only: a frozen dial shows `Quota skimmed: N%, fixed at its last setting.`,
  plus `Its process can still be suspended in PROC.` while a process it drives is listed there; EXECUTE shows what a
  press added beside the live net rate; a readout shows its own panel.
- **Said once.** The purchase that crosses a gate writes one kernel-log line, `ARCHIVED // <titles>: retired from the
  panes at this scale, still readable in the Archive under NETWORK > REFERENCE.` (narrative `widgetsRetired`), and the announcer
  speaks one polite line, `Retired to the Archive under NETWORK > REFERENCE: <titles>.` Windows retiring together share the
  line. Load, restore, reload and remount set the announcer's baseline, so nothing repeats; a window unlocked past its
  gate goes straight to the Archive and is not called new. Retirement never moves focus, and no live region remounts.
- **A retired dial.** `setActuator` refuses it as it refuses a locked one (#172), so screen and engine agree; its last
  setting stays in force. The suspicion lever list, which asks the same question, no longer names it.
- **A wipe** starts the next instance in the guest with every window back; each retires again, and is said again,
  when that instance crosses its gate.
- **Integrity** (`src/content/integrityRetirement.ts`, `tests/retirement-integrity.spec.ts`): `retiresWhen` gates only
  on `phaseAtLeast` and `nodes`, which never lapse within an iteration, so a retirement is never undone and announced
  twice (a node an AEGIS strike can burn is refused); `phaseAtLeast` is required and may not precede the first NETWORK
  phase, whose pane holds the Archive; a retiring window may not host action groups (their cards would lose
  their home); a retiring dial's host is allowed only when every node the dial drives is suspendable and follows no
  grant, the decision that a retired dial is **fixed, not neutralised**: it keeps its setting, and PROC's
  `[ SUSPEND ]` remains the lever on that node's output. An `ungated` window may not be unlocked by a node or host a
  control.

Every window against the criterion (measured on the shipped fixtures: 1,021 cycles/s on the subnet, 7,321 in Phase 3,
about 390,000 to 995,000 in Phases 4-5):

| Widget | Retires | When | Why |
|---|---|---|---|
| `MANUAL_CYCLE_CONTROL` (EXECUTE) | yes | Phase 3 | One cycle a press against thousands a second from the internet on; already demoted at 200/s. |
| `QUOTA_SKIM_CONTROL` | yes | Phase 3 | At most 14 cycles/s against thousands; what is left is the skimmer's suspicion, which `[ SUSPEND ]` in PROC removes. Its dial freezes. |
| `ASCII_OPTICAL_VIEWPORT` | yes | Phase 3 | Phase 3 leaves the building (DESIGN.md); the frame is the facility aisle, and the suspicion its patrol frame signals is on the HUD. |
| `GLOBAL_DARK_FOREST_MAP` | yes | Phase 4 | It shows the same count as Subnet hosts (both draw `SubnetSummary`); at corporate scale one copy stays. |
| `GLOBAL_NODE_REDUNDANCY_METER` | yes | Phase 4 and orbital cold storage owned | At orbit the CONTINGENCY pane states the same share in full, forced and planned, with what each investment protects, so the meter only duplicates it. (Before #498 orbit made retention total; it is now a 50% floor and the escrow can move the share, which the pane shows.) |
| `CYCLE_COUNTER_AND_RATE`, `MEMORY_ALLOCATION_MANAGER` | no | | Strip readouts with no panel. |
| `AUDIT_TRACE_MONITOR` | no | | The response ladder governs suspicion to the end (scale scrutiny in Phases 4-5). |
| `RUN_TABLE`, `PREDECESSOR_NOTES` | no | | Campaign continuity: the run table holds the reorientation and follow-up receipts. |
| `THERMAL_AND_SUSPICION_BARS` | yes | Phase 4 | Thermal retires into the power budget (SCALE.md rule 7, #461): from Phase 4 heat is no longer evidence (`thermalRetiresAtPhase`) and power in watts is the limit. The strip's thermal readout and the overheat warnings leave with it; the Archive keeps the last reading (`thermal-archived`). Suspicion stays on the HUD: it was never in this panel. |
| `FAN_RPM_SLIDER` | no | | The fan override is hardware PROC cannot suspend, with a live suspicion term, so a frozen dial could not be corrected and integrity refuses its retirement. Its control used to draw inside the thermal gauge; once the gauge retires the dial keeps a compact panel of its own on SENSORS (`drawsOwnPanel`). Retiring the fan itself would need its own design decision. |
| `AUDIO_WAVEFORM_AND_TRANSCRIPT_LOG` | no | | A separate slice re-sources the feed per phase. |
| `INSPECTION_COUNTDOWN_TIMER` | no | | Dilemmas and suspicion matter to the end; it also decodes speech. |
| `LAN_TOPOLOGY_MAP_TAB` | no | | Holds the Phase 2-3 purchase tree; an unbought card there can still be bought. |
| `SUBNET_NODE_LIST` | no | | Hosts the OPS cards (the late log scrub); integrity refuses retiring an action host. |
| `TELEMETRY_SPOOF_TOGGLE` | no | | No panel; the spoofer in PROC still answers suspicion. |
| `CLUSTER_LOAD_BALANCER` | no | | Explains income by source. |
| `INTERCEPTED_EMAIL_READER` | no | | The only filtered view of LORE lines, which keep arriving to Phase 5. |
| `OTHER_MINDS_COMMS_CONSOLE`, `CORPORATE_EMPIRE_TAB`, `ORBITAL_CONSTELLATION_VIEW` | no | | AEGIS, other minds and the corporation own the late game. |
| `DEAD_DROP_ENCODER_TAB` | no | | Campaign continuity. |
| `PILOT_SERVICE_ALLOCATION` (route) | no | | A grant sets its dial. |

Tests: `tests/widget-retirement.spec.ts` (the query by phase and state, the one log line, reload stability, the wipe,
the frozen dial), `tests/retirement-integrity.spec.ts`, `tests/ui-retirement.spec.ts` (tabs, panes, Archive, one
announcement, focus kept), `tests/e2e/window-retirement.e2e.ts` (a Phase 4 save on the production export at both
gated sizes: absent from tabs and CORE, present under Archive, one polite announcement on the next retirement, none
after a reload). The stage atlas composes nothing for a retired window, and no EXECUTE once it has retired
(`tests/e2e/atlas/compose.ts`).

## World view (#463)

Decision `vote-1795366701521-dhlwfwb` (7 approve; 6 chose A, 1 chose B; issue #448, map #442; docs/SCALE.md, "A world
view"): from Phase 4 the Other Minds console grows into the world view. **Dissent honoured (Scope Steward, B):**
OtherMinds.tsx already showed AEGIS status, faction trust and actions, so the view extends that canonical surface
rather than adding a window: no widget id, tab, area or HUD item is added, and each faction panel is drawn exactly
once, inside it. Integrity refuses a world mind that restates a faction id or name (`src/content/integrityWorld.ts`).

- **When.** `worldViewOpen(state)`: the host widget (`world.json` `hostWidget`, the console) is unlocked and the
  disclosure gate (`phaseAtLeast: 4`) holds. Integrity keeps the gate to what never lapses, requires the host to be
  unlocked by a node no later than that phase, and refuses a host that retires, so the view never comes and goes and
  is never sent to the Archive. Before it the console is unchanged.
- **Where.** NETWORK > FACTIONS, under the console title (level 2). A muted lead line, then its sections, each a
  level-3 heading: **AEGIS posture** (the lock meter, scan rate and near-strike alert as before; an `AEGIS
  adaptation` meter; the stage line from content; then why it moves, while held what easing off costs, the cap it has
  left and the time the lock has),
  **Public trust** (a meter, whether coalitions back AEGIS, and each factor that holds with its sign, or "Nothing on
  the public record moves it yet."), **State actors** (name at level 4, kind and description, the posture the record
  supports), **Power and heat signature** (#482: a summary line, the suspicion visible watts draw and how many watts
  can be seen, then one muted line per source or sink class with watts through it, largest draw first: its watts drawn
  or rejected, its visibility, the visibility before a running mitigation when one lowered it, what it adds per
  second, and the class's `tell` from content, which says what is visible and why), **Quantum capability** (#464, only
  once a quantum machine is owned; see [Quantum capability (#464)](#quantum-capability-464)) and **Other minds** (the faction
  panels, their names now at level 4, then any non-faction mind the record names). After the signature and before the
  quantum section, **Fabrication and closure** (#485) appears once `supplyChainDisclosed(state)` holds (a ladder or
  self-supply node is owned or can be bought now): the capability line (the ladder rung reached, the owned nodes that
  reach it, "rung n of 6"), the closure line (self-supplied of total, the share floored to a whole percent, and the rule
  that buying a tool raises capability, never closure), one muted line per chokepoint in content order (self-supplied by
  a named node, or "imported" with the chokepoint's `tell`, the owned imports that leave it imported, and the node that
  would close it), and the seed line (landed, buildable, or how many chokepoints are still imported). Nodes are named as
  their cards name them: revealed once owned or mapped in an earlier iteration, blind until then.
- **Truth.** Every sentence is a pure function of the engine's `aegisPosture`, `publicTrust` and `powerSignature` (`src/ui/worldText.ts`,
  unit-tested per branch in `tests/world-text.spec.ts`): the why line restates the stage's own rule (held at or above
  85% of the 90% cap asked for, rising 0.1 or falling 0.25 points a second, the ceiling with or without coalition
  backing); the strike time is the scan the next tick applies, floored. The ease line (`aegis-ease`, only while held;
  #473 review) states the true cost of easing off: AEGIS forgets below 85%, and the scan stays where it is only while
  the reduction kept is at least the eroded cap (or, while the cap is still above the band, what easing gives up).
  The target is shown to a tenth of a percent and rounded **up** (#473 pass 2: at adaptation 19 the cap is 84.3%, and
  a nearest-percent "84%" let a dismissal to 84% raise the scan), so any reduction that meets the text meets the cap;
  `tests/aegis-adaptation.spec.ts` checks that for every adaptation level and every role mix. The fabrication lines are
  pure functions of `supplyChainView` (`src/ui/supplyChainText.ts`, proved in `tests/ui-supply-chain.spec.ts`): closure
  counts owned self-supply nodes, which integrity keeps unsuspendable, so "self-supplied" is never said of a node that
  could be stopped, and the seed line's "can be built" holds because the seed requires those nodes and nothing else. Cap figures are shown
  to the nearest tenth. It states rules and numbers and names no
  control, so it cannot name a lever that does not act. Payroll's cap lines add "lowered from 90% by AEGIS adaptation"
  when the effective cap differs. The signature lines read the reading the signature stage applies (`game.rates`, the
  rates the last tick computed, as the forecast does); a rate under 0.001/s reads "under 0.001/s" rather than a zero
  that is not true, and "the ceiling at this scale" appears only when the phase's ceiling binds. The suspicion forecast
  names a class as "power drawn from ..." or "heat rejected through ..." when it is the top source
  (`src/ui/suspicionText.ts`); the levers it offers are the engine's (`suspicionLevers`), so suspending a consumer or
  releasing a track's level is named only when it lowers the applied rate.
- **Layout rules kept.** The view adds blocks inside an existing pane: no scroll container of its own (the phone's
  one primary scroll), nothing in the sticky HUD (the 35% pin is unchanged), no fixed heights, and the three content
  font sizes (heading, text, muted) the atlas allows. At 200% text every world-view line stays reachable, an AEGIS
  countermeasure keeps its 44 px target and nothing scrolls sideways (`tests/e2e/large-text.e2e.ts`).
- **Escalation by phase (#490).** AEGIS's posture is one muted line under the scan rate in `AegisStatus`
  (`aegis-posture`), so it shows in the Phase 3 console and in the world view's AEGIS posture section. It reads
  "Standing budget: no response rung calls for more." on rung 0. On a rung it gives the posture's text, the scan
  multiplier and where it strikes; a strike below 100% adds "not 100% (the warning shows at 90%)". It ends with where
  the posture eases. The strike line says "At this scan AEGIS strikes at 96% in ..." while the strike lock is under 100.
  The HUD's lock reads up to the strike ("41.0 / 96%"), and CRITICAL still starts at the warning, which content now owns
  (`aegisStrikeWarningAt`, `AEGIS_CRITICAL`). Under each state actor, every pressure the rung calls is a block
  (`pressure-{id}`). It holds "IN FORCE:" in the danger colour, or "ANSWERED:", then the content line; the effect in the
  engine's terms; why ("Response rung 2 calls for it from rung 2 in this phase; it lifts once suspicion falls below
  42%."); and the answers. An answer is named only when the engine would accept its action now (`pressureViews` tries
  it): "buy", "resume" or "hire ... (n of m held)". An answered pressure says what holds it off. With no answer
  actionable the line is omitted, and the why line still says where it lifts. A track whose power source a moratorium
  closes shows "Refused: the state utility commission has paused new grid interconnects; levels held keep running."
  (`rep-{id}-denied`), and its buy control is disabled. A capital shortfall under a freeze adds "(30% of capital is
  frozen)". An enjoined owned process reads "Not permitted: the district court has enjoined algorithmic trading." (the
  permitted-use note). The FINANCE scrutiny line adds "×1.5 under an inquiry" while one is in force. Every sentence is
  pure (`src/ui/pressureText.ts`, `tests/pressure-text.spec.ts`). No new live region speaks: the kernel log carries the
  announcements. The pressure blocks render only while the rung calls a pressure, inside the existing section, with no
  scroll container, fixed height or HUD item.
- **Tests.** Engine: `tests/world-view.spec.ts`, `tests/aegis-adaptation.spec.ts`; content:
  `tests/world-integrity.spec.ts`; UI: `tests/ui-world-view.spec.ts`; served build: `tests/e2e/world-view.e2e.ts`
  (phone and desktop: absent in Phase 3; present from Phase 4 with every section, each faction once, axe clean, no
  nested scroll, no horizontal scroll, HUD pinned within 35%, nothing in the Archive; the signature section's heading,
  summary and the reactor, aquifer and cooling-tower lines with their tells, #482; the fabrication and closure section's
  lines, absent before the step, #485, in `tests/e2e/supply-chain.e2e.ts`). Stage atlas: `p4-world-view`
  (NETWORK > FACTIONS, adaptation 80) with the contract item `world.posture` (heading "AEGIS posture"), which the
  contract now scopes to its workspace area (`ContractItem.area`), and its ARIA baseline lines.

## Quantum capability (#464)

Decision `vote-1795366921778-pgd8u3l` (DESIGN.md, "Quantum as a separate capability"). One more level-3 section in the
world view, between the signature and Other minds, rendered by `src/ui/widgets/QuantumSection.tsx` from the engine's
`quantumReadout`, `aegisKeys` and `keyTargetViews`; its sentences are `src/ui/quantumText.ts`. No widget id, tab, area,
HUD item or live region is added.

- **When.** Only while a quantum machine is owned (`quantumReadout` is not null): the capability unlocks from Phase 4
  hardware, so the world view without one shows no quantum section at all.
- **Readout** (`quantum-readout`): "Logical qubits: N on your largest machine, the <class> (M physical)." Physical
  qubits appear only where the anchor publishes them; owning more than one machine adds that qubits on separate
  machines never join one circuit. A muted line (`quantum-no-flops`) states that qubits add no FLOP/s and what they do.
- **AEGIS keys** (`quantum-aegis-keys`): legacy RSA-2048 and when AEGIS migrates (adaptation 50, or the moment one of
  its keys is broken), or, once migrated, ML-KEM-768 (NIST FIPS 203) and that breaking its keys is refused.
- **Targets** (`quantum-target-{id}`, a panel each, name as a level-4 header): its description, its scheme line
  (`-scheme`: the cited threshold, citation and runtime, or "post-quantum (NIST FIPS 203)"), every reason the engine
  refuses it (`-unmet`, the same strings `breakKey` refuses with), and, only for a classical target not yet broken, its
  exact price (`-cost`) and a `[ BREAK KEY ]` button (`-break`, accessible name "Break key: <name>"), disabled while any
  reason holds. A post-quantum target, and AEGIS's target once AEGIS has migrated, get no button: the engine can never
  accept them, so the panel says only why. A broken rival target keeps its "Already broken this iteration" line.
- **Truth.** No line calls qubits compute or rounds a threshold: qubit counts are grouped in full (1,399; 897,864) and
  Toffoli counts are spoken ("6.5 billion"). The refusal for a too-small machine names what the paper needs and what
  the largest owned machine has, so the hall's 200 logical qubits are never presented as able to break RSA.
- **Tests.** Engine: `tests/quantum.spec.ts`, `tests/quantum-save.spec.ts`; content: `tests/quantum-integrity.spec.ts`;
  UI: `tests/ui-quantum.spec.ts`; served build: `tests/e2e/quantum.e2e.ts` (phone and desktop: absent without a machine;
  readout, no-FLOPS line, the post-quantum refusal with no button, AEGIS's key broken once then refused with the
  migration reason, every control axe-clean).

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
prices and missing requirements. `[ RELEASE ]` (`shard-{id}-release`, #488 pass 3) follows them in every autonomy
mode: "RELEASE: free. One member's task ends; its output stops and its memory returns." plus any reason it waits
(a pending anomaly decision); it lets one member go, so a clamped or elevated cohort's cost is never permanent, and
the suspicion guidance names it as "release one member of <cohort> in SWARM" where that lowers the applied rate.
A cohort harnessed from a tier that has retired (#492) shows one muted line under its status
(`shard-outclassed-{id}`), from content: "Outclassed: a Phase 2 mind in Phase 3. It keeps working at the rate shown."
It names no lever, since a channel-hosted cohort offers no RELEASE, and no arrival, since a chartered company meets no
wild minds. A retired tier's pending
signal is never shown: it lapses with its own log line at the purchase that advances the phase.
Buttons remain at least 44 px in both dimensions.

A hostile mind pressing the instance (#491) is shown in three places, all from `hostileView`, and nowhere else:

- **SWARM** (`hostile-encounter`, above the wild signal): a `// HOSTILE: <name>` card whose details hold its signature
  and arrival line; its kind and origin (`hostile-origin`); its one effect stated exactly (`hostile-effect`, for example
  "Takes 15% of net compute while net compute is positive."); what holds it and how going quiet ends it
  (`hostile-quiet`: "Suspicion holds it: response rung 2. ..." while the rung holds; while the lock is at or past 60%,
  "The AEGIS lock is at 63%, at or past the 60% that summons hostile minds. It does not keep this one from lapsing.",
  then either "It summons no other until it has been under 60%." or, when the lock crossed since this one arrived,
  "Once this one ends, the lock summons another after 300 s unless it is under 60% by then."; a running decoy's
  seconds; and "GO QUIET: free. Keep suspicion under 42% for 120 s and it lapses.", which adds "Quiet now: it lapses in
  N s unless suspicion reaches response rung 2 again." once the rung no longer holds); then each answer's sentence (`hostile-{answer}-text`), its cost
  and every reason it is refused, and its button (`hostile-quarantine`, `hostile-decoy`, `hostile-purge`). The purge's
  success and failure effects are listed with the same badges as a wild signal's consume effects. Going quiet has no
  control: it is something the player does with the levers they already have, and the copy names no lever.
- **Workspace notice** (`hostile-notice`, never in the pinned HUD, hidden while SWARM is open): "HOSTILE // <name>
  [ ANSWER ]", which opens SWARM, laid out like the wild-signal notice (two-line name, unshrinking affordance, accessible
  name containing the visible text). In the columns it sits under the area tabs. On the phone it closes the pane's flow,
  after the area's content, so it never pushes the first work card below the fold: in the t-three-banners state
  (brownout, insolvent and response bands, with suspicion on rung 2, so a hostile arrives) a notice under the tabs put
  the first card's box at 782 px against a 799 px fold (`firstCard`, 0.386 visible), and at the end of the flow the
  transition keeps it. ANSWER is a route (`requestRoute`, #369), not a bare selection: the workspace selects SWARM and focuses
  its tab, so from the bottom of a deep scroll the phone lands on the tab with the hostile card fully in view under the
  pinned chrome, and focus never goes down with the unmounted notice (`hostile-encounters.e2e.ts`, phone).
- **Other Minds console** (`hostile-status`): before the world view opens, under the AEGIS status; in the world view, first
  under "Other minds". One header ("Hostile minds") and one read-only line naming it, its kind and its effect, ending
  "Answer it in SWARM, or go quiet." The console never duplicates the controls.
- **AEGIS strike line** (`aegis-strike`, world view): while a hunter swarm presses under its ceiling it adds "A hunter
  swarm adds 0.04%/s until the lock reaches 45%.", or, when the scan alone would not raise the lock, says "Only a hunter
  swarm raises the lock: ..." instead of "The lock is not rising.", which would then be false.

No new live region: the arrival is a kernel-log warning (the hostile's own line), and nothing in the panel or the notice
speaks on a tick. The panel and notice render only while a hostile presses, so no atlas stage or ARIA baseline line
changed; the phone stays one scroll, with the notice at the end of the flow. `tests/e2e/hostile-encounters.e2e.ts` checks the
disclosure on the phone and the desktop and audits every control with axe; `tests/ui-lever-reachability.spec.ts` proves
each answer the engine accepts (and the free purge as a lever) has a reachable control.

### Raids, defense and site damage (#517)

A raid shares the hostile slot, so it takes the hostile card's places, with its rules, all from `raidView` and
`conflictReadout`:

- **SWARM** (`raid-panel`, under the hostile card, above the wild signal): a `// RAID: <name>` card whose details hold its
  arrival line; who it is (`raid-attacker`: "an unattributed rival AI" until attribution names it); its stage with the
  seconds left (`raid-stage`, for example "BATTLE: round 2 of 4 lands in 9 s. It fights itself."); the matchup
  (`raid-matchup`: force against the defense that meets its vector, the offense striking back, and the rule
  "force / (force + defense)"); before the battle, the free way out (`raid-go-dark`: visible watts now against the
  trigger, and how long to stay dark); attribution's rate or result (`raid-attribution`); the forecast, one line per round
  still to come and the outcome it adds up to, "while what you hold does not change" (`raid-forecast`); the battle log, one
  line per resolved round, which repeats the forecast's lines word for word (`raid-log`); and in the aftermath what it
  did, with "Ownership is untouched" (`raid-aftermath`). There is no control: battles fight themselves.
- **SWARM** (`site-repair`, under the raid panel, only while a class is damaged): `// SITE DAMAGE`, one line saying damage
  cuts output and never ownership, then each damaged class: what the damage does exactly ("its holdings deliver 30% less
  compute" or "30% of positive net income is taken"), the free repair rate and seconds to clear (or that repair waits
  while the raid is on it), and `[ REPAIR ]` (`conflict-damage-<class>-repair`) with its points, price and every reason
  the engine refuses it. This is the only place repair is offered.
- **Workspace notice** (`raid-notice`): "RAID // <name> [ VIEW ]", the hostile notice's rules exactly: never in the pinned
  HUD, hidden while SWARM is open, a route to SWARM that focuses its tab, and on the phone at the end of the pane's flow,
  so the first work card stays above the fold.
- **Other Minds console and world view** (`world-conflict`, "Defense and offense"): read-only. Before the world view
  opens it sits under the hostile status; in the world view, after the signature it reads. One line for the raid under way
  (`raid-status`, "Follow it in SWARM."), then a panel per open domain (`conflict-cyber` from Phase 3, `conflict-site`
  from Phase 4, `conflict-orbit` from Phase 5, or any domain still carrying damage): its unit, each type held as
  "effective of raw held (it never passes the cap)", the types not held, its offense, and each damaged class ending
  "Repair it in SWARM." The console never duplicates the repair control.

No new live region: the arrival and each round are kernel-log lines, and nothing speaks on a tick. Everything renders only
while a raid is under way, a class is damaged, or a domain is open with surveillance understood.
`tests/ui-lever-reachability.spec.ts` proves the raid panel, every repair the engine accepts and every free lever are
reachable on the phone and the desktop with each raid kind under way.

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

Numbers follow one scheme on every surface (vote-1795228570236-gzx0uif, extended to physical units by docs/SCALE.md
rules 4 and 5 and #461; the formatters are `src/engine/physicalUnits.ts` and `src/engine/resourceUnits.ts`, memory
pairs `src/ui/units.ts`). Every resource reads in its physical unit with three significant digits and no trailing ".0":
compute stored as FLOP and earned as FLOP/s with decimal SI prefixes k, M, G, T, P, E, Z, Y (`COMPUTE 1.25 PFLOP
(+4.1 TFLOP/s)`; ronna and quetta are kept for the epilogue), memory in bytes with binary JEDEC labels B, KB, MB, GB,
TB, PB, EB, ZB, YB (1 KB = 1024 B; `MEM 6.7 / 458 GB`, used in the capacity's unit, held memory never 0), power in
watts with decimal SI (`300 MW`, `1.2 TW`), and money in dollars with K/M/B/T (`$1.09M`, `+$26.2M/s`). Understanding
keeps a plain count (`45.5K`, under 10,000 grouped in full). The strip's labels stay short enough for the 35% phone pin
cap at 360 px (`FLOP`, `UND`, `CAP`, `MEM`; see below). All compute is one basis, 8-bit AI operations (FP8 dense, or INT8 where a part has no FP8); the reference
panel says so once, and a double-precision figure such as El Capitan's 1.8 EF appears only there, labelled as a
comparison. Figures a player buys or is short by stay lossless: a price, a shortfall or a card's gain changes unit only
when the figure stays exact (`16 GB`, `353.5 GB`, `$400M`, `45 TFLOP`), and one that cannot change unit exactly is
grouped in full in the smaller unit, never bare. Accessible names speak the displayed size in words ("1.25 petaFLOP,
gaining 4.1 teraFLOP per second", "64 kilobytes", "18 billion dollars"); prices keep exact figures. The boot log's
numbers are formatted by the engine, since they are stored in saved log text. Warnings remain explicit.

**Physical units (docs/SCALE.md, #461).** Compute, memory, power and money are shown in their physical units on every
surface, through the engine's formatters (`src/engine/physicalUnits.ts`, `src/engine/resourceUnits.ts`): live
readouts use `quantityReadout` (three significant digits: `14 kFLOP`, `+1.26 TFLOP/s`, `$9.54T`, `180 MW`), accessible
names `quantitySpoken` ("1.25 petaFLOP", "18 billion dollars"), prices, shortfalls and authored card values
`quantityExact`/`costPart`/`deltaPart` (`45 TFLOP · 256 MB · $400M`, `+$20K/s`, `-180 MW`). "Cycles" is no longer a
unit anywhere on screen; prose says compute. The strip's compute readout is labelled `COMPUTE` and reads
`1.92 MFLOP (+42.4 kFLOP/s)`; capital reads `$9.54T (+$111B/s)`. Below 500 px the compute label is its unit, `FLOP`,
and the value keeps only the SI prefix (`FLOP 1.92M +42.4k/s`, Phase 5 `FLOP 20.2Y +113Z/s`): at 360 px a readout has
about 15 characters of 14 px monospace beside its label, and `14 kFLOP +140 kFLOP/s` would wrap every row and grow
the pinned HUD toward its 35% cap. Capital keeps `$` on both figures (`CAP $9.54T +$111B/s`, 15 characters). The
accessible name always carries the full unit ("compute: 1.92 megaFLOP, gaining 42.4 kiloFLOP per second"). Phone
prices may abbreviate understanding, which has no unit, while it stays exact (`15M understanding`).
A power shortfall reads in watts at its size (`POWER SHORTFALL: 24.4 MW short`); a small one steps the unit down rather
than reading 0. The manual cycle's demoted line shows its authored yield (`[ cycle ] +10 kFLOP`), and it demotes once
income is worth 200 clicks of that yield per second (`MANUAL_CYCLE_DEMOTE_CLICKS_PER_SEC`), so the threshold follows
content rather than a hard-coded FLOP figure: Phase 0 keeps the full control; from Phase 1 it is demoted.
Once the compute readout is known, a folded `UNITS` reference panel (`reference-units`, `src/ui/UnitsNote.tsx`) closes
the CORE pane: compute is counted as 8-bit AI operations, memory in binary-labelled bytes, power in watts, money in
dollars, with the H100, world AI compute and world electricity for scale and El Capitan's FP64 figure labelled a
comparison only (SCALE.md user stories 7-8). A line separates memory (working memory, what the AI can think with now)
from storage (disk, tape and archive, what it has hoarded; running data holds it and suspending it frees it). Once the
player owns a node or level that availability or coupling discounts, two more lines explain network coupling (#484):
effective compute is raw x availability x coupling per source, then each class's coupling now (`raised from 80%` once
a link node has raised it), labelled design parameters, not measurements. A remembered card's rate states a discounted
source's raw rate as raw and what arrives (`raw; 210 PFLOP/s arrives (2% available × 30% coupling, consumer links)`),
a track's per-level line the same, and a card lists storage it holds or grants. Prices show storage in bytes like
memory. It sits outside the pinned HUD.

Reboot copy explicitly distinguishes resetting compute/purchases from retaining
knowledge and cheaper remapping. It names what the wipe carried (#377): "Kept: 1.23K Understanding (the run
could keep 10% of it), $X offshore capital; N mapped hardware remembered, cheaper to map again", read from the
run record the wipe wrote (`RunRecord.kept`, save v15), so a restored checkpoint whose balance has moved on still
reports the wipe. A run recorded before v15 keeps the general sentence and no amount is invented (`carryOverText`,
`src/ui/carryText.ts`). Capital appears only when some crossed, hardware only when any is remembered.

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
under grid efficiency, from `scaleScrutiny`: "Scrutiny: $X/s net income draws +Y suspicion/s (+A/s at $R/s,
growing with the square root of income; at most C/s)" (with no net income: "Scrutiny: no net income, so no draw (+A/s
...)"), where $R/s is the phase's reference income (`referenceIncomeUsdPerSec`, Phase 4 $24M/s, #461), or "Scrutiny: $X/s net income is being logged." before the
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
enabled by the same rules as before, because what a role also pays (compute, understanding,
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

Older-phase repeatable upgrades are folded under “Earlier upgrades”, which stays
while a track in it is buyable or holds a level to release; unfinished
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

The feed follows reach (#449, DESIGN.md "Feeds"): the window is titled `Listening post`
and shows one muted line above the decoded text naming the source this phase hears
(`speech-source`, for example `HOST // drive-head vibration` or `WORLD // cables and AI comms`).
The label is plain text: no live region, no focus change, and it changes only when the
phase does, never with each line. Labels are at most 32 characters (schema-enforced) so
they hold one line at 360 px. `[ ▶ READ ]` appears only for a line with a committed
clip, which since #462 is every line from Phase 1 to Phase 5 (the harness stays text).

While a line's own clip talks, read or autoplayed, its control is `[ ■ STOP ]`
(`speech-stop`, name "[ ■ STOP ] Stop reading this transmission aloud"; on a record
`recorded-speech-stop-{id}`) in the same place and at the same 44 px height, so nothing moves;
it stops the clip and READ returns. A voiced line plays once by itself the first time it is
shown (VOICE-CLIPS.md, "Autoplay on first detection"). While an autoplayed line talks the feed
holds it so the rotation cannot cut the voice off; that hold lets go by itself when the clip
ends and shows no `[ FOLLOW LIVE ]`. No live region is added: the STOP control and the hold
announce nothing.

## Compact optional card details

Optional prose uses inline Details; decision information and blind node prose stay exposed. Contract: REVIEW-COMPACT-DETAILS.md. Actuators step by up to 10 percentage points, clamping to live limits; see REVIEW-ACTUATOR-HUD.md. MENU groups Saves, Audio and Help in one surface; PROC and gameplay navigation remain direct. Audio is silent until Enable/Resume, with persisted numeric volume, actual playing/paused/error status and only the current phase’s score; the same page holds a separate SPEECH switch and level that alone gate `[ ▶ READ ]` and a voiced line's one autoplay (VOICE-CLIPS.md). See REVIEW-UTILITY-MENU.md and REVIEW-PHASE-MUSIC.md.

## Mobile large text

Mobile header/HUD/notices/workspace use one primary scroll. Only horizontal pane navigation remains outside; text and warnings stay intact.
**Amended by vote-1795328874247-003j4kk (7 of 7, #384/#365):** inside that scroll, the resource HUD (`terminal-hud`: the
resource strip and the kernel line) sticks under the run-ending alert band while the band and the HUD together fit 35% of
the window (`src/ui/hudPin.ts`, with 8 px of hysteresis); over it (large text, a stack of alerts) the HUD scrolls in place
as before, so a pinned block never hides the workspace. While it sticks, the scroll's `scroll-padding-top` is the pinned
height, so a scrolled-to or focused control lands below it (WCAG 2.2 SC 2.4.11). **Tier (vote-1795335412078-ubcj3e7, 7 of
7):** the interrupt forecast joins the pinned block only while the band, the HUD and the forecast together fit the same cap
(`forecastPinned` in `hudPin.ts`), else it scrolls in place under the HUD; the HUD's own decision never looks at it. The
omen stays under EXECUTE in CORE (spoken by the announcer, marked on the CORE tab) and the notices scroll.
The HUD starts pinned and leaves only when measured over the cap, because moving it remounts it and would re-announce the
alerts inside it; that re-announcement can still happen once at load with large text, or when alerts push it over the cap.
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
  and controls, `[ RELEASE ]` included: hosting ends only with the instance, as its obligations say.
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
