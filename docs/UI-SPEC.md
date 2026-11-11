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
| `MEMORY_ALLOCATION_MANAGER` | used / cap bar | `memoryUsed`, `memoryCap` |
| `THERMAL_AND_SUSPICION_BARS` | two ASCII meters, overheat warning | `thermal`, `suspicion`, `balance.thermalThresholdForSuspicion` |
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
- On unlock, run a short character-scramble reveal from blind to revealed name (skip under reduced motion).

## Dilemma modal

- Opens whenever `activeDilemmaId` is set; cannot be dismissed.
- Shows title, context, each choice with cost, effect badges (good/bad colouring) and the trait it grants.
- Unaffordable choices are disabled and say why. At least one choice is always free.
- Fires a warning haptic on open.

## Destructive actions

Voluntary wipe and hard reset require an explicit second confirmation that states what will be lost and kept.

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
| Dilemma modal / choice | `dilemma-modal`, `dilemma-choice-{choiceId}` |
| Dead-drop input / wipe / confirm | `deaddrop-input`, `wipe-button`, `wipe-confirm` |
| Kernel log | `kernel-log` |
| Dev drawer | `dev-drawer`, `dev-{command}` |
