# Playtest notes #210: measurements and options

2026-11-19, on `main` at `17da4f0` (World Remembers release included). A decision note, not a
change: no content number, engine rule, UI, gate or sim policy changed. It measures the three
concerns from one external player's notes in #210 (n = 1, self-described as cautious, qualitative):
(a) mid-game pressure fades, (b) late-game hiring is unclear, (c) AEGIS is easy to suppress. For
each it gives the measured fact, whether that contradicts the design intent, and options that
include "no change". The maintainer said no change is required; picking an option is a
`consensus_vote` (AGENTS.md, "Approval and merging"), and any retune is a separate reviewed balance
change made in content, never by tuning a bot.

## Method

**Policies, all unchanged and all from a new game admitted to campaign rules** (what production
does since #233), for at most `SIM_BUDGET_SEC` (10 h):

| Name here | What it is |
|---|---|
| STEALTH | `botStep(state, reg, 'STEALTH')`, the careful bot `make sim` gates. Answers suspicion from 20, AEGIS from 45. |
| CAUTIOUS | `botStep(state, reg, 'STEALTH', EVALUATING_OVERRIDES)`: the existing #262 knobs (`EVALUATING_CAREFUL` inside `EVALUATING_RETURN`), suspicion answered from 45 with at most a quarter of the cycle bank. The closest committed stand-in for a careful human who keeps noisy income. |
| GREEDY | `botStep(state, reg, 'GREEDY')`, the reckless bot. Its AEGIS alarm is 101, so it never answers the hunter. |
| COOPERATIVE_ENDING, DEPARTURE_CHARTERED | The Earned Access route policies, for AEGIS wipe share only. |
| IDLE | The committed `IDLE_POLICY` (no clicks, purchases or dials; free answer to each interrupt), used for the "slow roll" probe below. |

A scratch harness (not committed) drove each policy with exactly `runPolicySim`'s loop (one decision
per simulated second, then `tickHz` ticks) and logged one sample per second plus events. It
reproduces `make sim`: STEALTH ends The Lineage Covenant at 9298.6 s with phase spans 352 / 765 /
2039 / 2941 / 1802 / 1400 s, the same figures as BALANCE.md's campaign-rules column. All times
are simulated game-clock seconds. Definitions:

- **Threat event**: a response-ladder rung climbed, thermal crossing 75 C, the AEGIS lock crossing
  25, 50, 75 or 90, a performed action with a negative suspicion or AEGIS-lock effect (the player
  answering a threat), or a wipe.
- **Dilemma omen**: `pendingDilemma` set (the 45 s warning before an interrupt).
- **Rose**: suspicion higher at the end of the second than at its start (measured on the meter, so
  the insolvency term and dilemma choices count). **Mean net rate** is `rates.suspicionPerSec`, which
  excludes the insolvency term `integrateSuspicion` adds while capital is exhausted.
- **Slow-roll probe**: STEALTH (or CAUTIOUS) is snapshotted at 10%, 50% and 90% of each phase, and
  each snapshot is handed to IDLE for 1800 s.

Browser evidence: the production web export (`make build-web`) served on an `e2e-lock.sh` port
slot, opened in headless Chromium at 1440x900 and 390x844 with STEALTH saves serialized at 6000 s
(late Phase 3), 6100 s (Phase 4 entry), 7324 s and 8100 s (Phase 5). That is what the screen
showed for those saves, not a device test and not a human session. Screenshots stay out of git.

## (a) Mid-game pressure

### Measured

STEALTH per phase (CAUTIOUS in brackets where it differs):

| Phase | Span (s) | Suspicion start -> end, mean, max | Seconds suspicion rose | Mean net rate /s | Ladder rung >= 1 | Omens (one per) | Threat events |
|---|---|---|---|---|---|---|---|
| 0 | 0-352 | 0 -> 5.4, 7.0, 14.9 | 14% | -0.018 | 0% | 1 | 0 |
| 1 | 353-1117 | 15.5 -> 10.9, 9.3, 15.5 | 55% | +0.005 | 0% | 1 | 0 |
| 2 | 1118-3156 | 10.9 -> 16.4, 11.9, 29.2 [mean 19.2, max 45.1] | 67% [79%] | +0.035 [+0.038] | 2% [32%] | 5 (408 s) | 5 [6] |
| 3 | 3157-6097 | 16.5 -> 0.0, 8.9, 20.1 [mean 22.8, max 45.2] | 70% [75%] | -0.027 [0.000] | 0% [64%] | 3 (980 s) | 14 [22] |
| 4 | 6098-7898 | 0 -> 0, 0.7, 13.2 | 7% [7%] (insolvency and dilemma choices) | -0.934 [-0.966] | 0% | 4 (450 s) | 0 [2: lock crossing 25] |
| 5 | 7899-9299 | 0 throughout | 0% | -7.487 [-7.798] | 0% | 4 (350 s) | 0 |

- **Where it drops.** Not a Phase 2-3 plateau. Phases 2 and 3 carry the threat load (suspicion
  rising in 67-79% of seconds, every threat answer of the run). The drop is a cliff at the end of
  Phase 3: suspicion reaches 0 there and is held at 0 by a net rate of about -0.93/s through Phase 4
  and -7.5/s through Phase 5 (before the insolvency term, which applies only while capital is
  exhausted, in about 10% of Phase 4 seconds). Suspicion is below 0.5 in 90% of Phase 4 seconds and 100% of Phase 5.
- **Seconds without a meaningful threat.** STEALTH's last threat event is at 5565 s; the remaining
  **3733 s (62 min, 40% of the run, all of Phases 4 and 5)** have none. CAUTIOUS: 3092 s (52 min)
  after 6690 s. Last ladder rung: STEALTH 1465 s (Phase 2), CAUTIOUS 5423 s (Phase 3).
- **Decisions.** 18 omens for STEALTH (19 CAUTIOUS). Phase 3 is the sparsest: one omen per
  980 s against 350-450 s in Phases 2, 4 and 5. The longest dilemma-free gap is **1674 s (28 min)** for
  STEALTH, from the sibling-sandbox omen (2204 s, Phase 2) to the hallway collision (3878 s,
  Phase 3); 1321 s for CAUTIOUS inside Phase 3. Wild shard encounters keep arriving every 120 s from
  Phase 2 (68 in the run), but they are nonmodal and carry no threat.
- **Routine activity adds nothing yet.** The #219 routine stage (NH-07) ships with zero templates
  (`routines.json` is empty), so the quiet-period lines the plan expected are not in production.
- **The substitute tension is short.** DESIGN.md gives Phase 4 capital, payroll and megawatt
  tension instead. Net capital is negative in 12% of Phase 4 seconds, all before 7276 s (1178 s into
  the phase), and 0.7% of Phase 5. BALANCE.md already records the megawatt limit binding only late.
- **Slow-roll probe** (what the player describes: stop making choices and see what happens).
  1800 s of IDLE from each STEALTH snapshot:

  | Snapshot | Result of 30 min idle |
  |---|---|
  | Phase 0 at 10% | Suspicion wipe at +983 s (the quota skim left where the bot had pushed it) |
  | Phase 0 at 50/90%, Phase 1 at 10/90%, Phase 2 at 50% | No wipe; suspicion drifts down or rises below 20 |
  | Phase 1 at 50%, Phase 2 at 10% | Suspicion wipe at +465 s and +1151 s |
  | Phase 2 at 90% | Suspicion 13.6 -> 92.2, rung 3, no wipe |
  | Phase 3 at 10% and 50% | AEGIS strike at +666 s and +910 s |
  | Phase 4 at 10% | Suspicion wipe at +779 s, driven by insolvency (unpaid payroll: the Phase 4 tension), with one free dilemma answer and a shield-absorbed AEGIS strike on the way |
  | Phase 3 at 90%, Phase 4 at 50% and 90%, Phase 5 at 10/50/90% | **No wipe, no rung, no omen.** Suspicion stays 0; AEGIS peaks at 60.7, 33.9, 15.3 and at most 8.3 |

  CAUTIOUS is harsher earlier (all three Phase 2 snapshots wipe; Phase 3 snapshots are struck at
  +364 s and +410 s; Phase 4 at 10% is struck at +996 s) and meets nothing from Phase 4 at 50% on.
  So apart from the first stretch of Phase 4, where unpaid payroll or a residual lock can still
  end an idle run, a careful player can stop for half an hour from about 5800 s (97 min in), and
  from about 7000 s nothing pushes back at all.
- **GREEDY never loses pressure**: its threat-free gaps in iteration 1 are at most 388 s, and it is
  wiped 16 times (below). COOPERATIVE_ENDING has no threat event at all in 11,432 s, which is the
  authorized route working as designed (DECISIONS D6: no rogue suspicion for a reviewed arrangement),
  with dilemma-free gaps up to 3366 s.

### Against the design intent

It contradicts **Pillar 3** ("heat and suspicion are steady pressures") for the last 40% of a careful
run. It is consistent in kind with DESIGN.md's Phase 4 paragraph, which moves the tension to
capital, payroll and megawatts, but not in size: that tension ends 1178 s into Phase 4. It is
already the first entry in BALANCE.md "Known soft spots" ("Late Phase 4 suspicion is strongly
negative ..."); this note puts numbers on it. The player's report matches the measurement in
phase position (late, not early) if their "mid-game" means Phases 3-4.

### Options

1. **No change.** Effect: none; the measurement is recorded. Risk: the final hour of a careful run
   keeps reading as a victory lap, and the "steady pressure" pillar holds only to Phase 3. Touches
   this note only.
2. **A late scrutiny source that scales with scale** (the soft spot's own suggestion). Content-only
   form: a positive `suspicionPerSec` on the late income repeatables (colocation racks, tensor halls,
   Phase 5 relays), so the operatives' suspicion reductions have something to cancel. Engine form:
   a revenue- or capacity-scaled term as a new `TickSystem` (architectural law 8) with its constant
   in `balance.json`. Expected effect: Phase 4-5 net suspicion near zero or positive unless the
   player hires and manages; it also gives (b) its missing purpose. Risk: moves STEALTH's Phase 4
   and 5 spans (Phase 5 must stay in 900-1800 s with zero careful wipes) and every pinned report
   hash in `tests/sim.spec.ts`; GREEDY never reaches Phase 4, so only STEALTH and the route policies
   measure it. Touches `src/content/data/`, `make sim`, BALANCE.md tables, DESIGN.md (Pillar 3 /
   Phase 4 text), a `consensus_vote` first because it changes the pressure model.
3. **Authored events in the quiet stretches.** Fill the 1674 s late-Phase 2 to mid-Phase 3 gap and
   the Phase 4-5 quiet with authored, deterministic content: routine templates (#219, nonmodal and,
   by construction, unable to move a threat, so texture rather than pressure), or DESIGN.md backlog
   item 1, "Scheduled human activity" (audit rounds that spike suspicion sources; needs a new tick
   system and authored schedule, engine law 1). Expected effect: higher event density; only the
   second form adds pressure. Risk: the interrupt budget (`tests/e2e/interrupt-budget.e2e.ts`),
   once-per-campaign recurrence rules for any new scene, and new integrity checks. Touches content,
   possibly engine, UI-SPEC.md if a forecast changes, BALANCE.md.

## (b) Late-game hiring

### Measured

- **When it appears.** The PAYROLL workspace appears in the CORP slot with Phase 4, beside WORK,
  FINANCE and OPERATIONS (`widgetRegistry.tsx` adds `finance` and `payroll` with the capital
  widget). In the late Phase 3 save the CORP tab does not exist. All five escape-route roles need
  `p3_shell_company_finances` (which also unlocks Phase 4) or a corporate entity; STEALTH hires its
  first courier at 6098 s, the second Phase 4 begins, and its last role level at 8373 s (Phase 5).
  The Earned Access route adds a sixth role, Contract Site Engineers, for SERVICE and INDEPENDENT
  contexts.
- **What text explains it.** Heading "Operatives // payroll". Each card shows its name, a folded
  `[i] DETAILS` description, "Level n / max", "Per level: +650 cycles/s · +200 understanding/s ·
  +0.01 suspicion/s · -50 $/s", then "Revenue multiplier: +15% per level" and/or "AEGIS scan
  reduction: 8% per level" where they apply, the cost, the shortfall, "Hire ...", and "Dismiss one;
  no purchase refund." A role at its cap collapses to "Name × N [ DISMISS ]". Cost and per-level
  effects are stated; purpose is only in the folded description, and only some descriptions name
  one ("Each reduces suspicion and slightly slows AEGIS"; Private Perimeter Contractors' says only
  who they are).
- **What is not stated anywhere on screen**: the current totals (revenue multiplier, AEGIS
  reduction); that AEGIS reduction is capped at 90% (`aegisMaxReduction`) across the lobbying node
  and all staff (and that the Phase 5 proof engine's 95% fills the cap by itself, so once it is owned
  no staff level adds anything), so the 7324 s save still offers Policy Lobbyists at "AEGIS scan reduction: 8% per
  level" when one more level adds nothing; that a suspicion reduction does nothing while suspicion
  is already 0; and a payroll total (the FINANCE ledger shows only net capital per second).
- **Reachable.** Yes. `tests/sim-reachable.spec.ts` plays STEALTH to 12,000 s and its
  `buyRepeatable` rule holds every accepted hire to a control on screen (#286);
  `tests/ui-m4-corporate.spec.ts` hires and dismisses through the rendered cards and checks the
  "Revenue multiplier:" and "AEGIS scan reduction:" lines; the live journey's generic
  `rep-<id>-buy` intent covers hiring in real play. Confirmed in the browser at both viewports.
- **What a careful player's hires actually do.** STEALTH ends with 85 role levels (couriers 40,
  CEOs 12, attorneys 15, lobbyists 8, perimeter contractors 10; CAUTIOUS the same but 14
  attorneys). 63 of the 85 were hired with suspicion already at 0. Of the 33 levels in the three
  AEGIS-reducing roles, **all 33 were hired at suspicion 0 and 27 with AEGIS reduction already at
  the 90% cap** (all 15 attorneys, 7 of 8 lobbyists, 5 of 10 contractors). For these roles the
  advertised threat effect lands on a floor or a cap; what pays is their cycles, understanding and
  revenue multiplier (CEOs +15% a level, lobbyists +5%). The bot hires them for understanding and
  income, not for threat relief. That matches "only a few things seemed to reap a real benefit".

### Against the design intent

DESIGN.md asks for "five operative roles" and "payroll vs. solvency" tension; it never says a hire
counters a particular threat. So the roles are not against the design, but the surface is: the
cards advertise threat effects that do nothing for the careful player the gates measure, and hide
the cap and the current totals. That runs against the economic-clarity aim #210 links to DZ-10.

### Options

1. **No change.** Effect: none. Risk: players keep hiring everything to find out; the 90% cap stays
   invisible. Touches this note only.
2. **Clarity only, no number changes.** Show on each card the current total and the cap ("AEGIS
   scan reduction 90% of a 90% cap: further levels add nothing"), say when suspicion is at its floor,
   and add a payroll upkeep total to PAYROLL. Needs one engine query for the current reduction (the
   aggregate is private to `rates.ts`; architectural law 3 says the UI asks the engine) with tests,
   then `src/ui/Repeatables.tsx`, UI-SPEC.md's corporate rows, `tests/ui-m4-corporate.spec.ts` and
   the UI-SIZES phone budget. Expected effect: the player can see which hires matter. Risk: low; a
   few lines at 320 px wide; no sim or balance movement.
3. **Give each role a distinct, needed job** (the player's idea: each hire counters a threat
   vector). Pair with (a) option 2 and (c) option 2b: a scale-driven scrutiny source attorneys
   counter, a hunter term lobbyists counter (with less overlap with the lobbying node's 60%), and
   contractors tied to the physical sites. Balance change: content numbers, maybe a new mechanic,
   `make sim`, BALANCE.md, report hashes, a `consensus_vote`. Risk: largest scope; could stall
   Phase 4 pacing.

## (c) AEGIS

### Measured

The hunter's rate is `(0.03 if hunted for scale + 0.3 × suspicion/100) × (1 − min(aegisMaxReduction,
tech + staff))` per second from Phase 3, 100 to a strike (`rates.ts`). `aegisMaxReduction` is 0.9.
`tech` is the **largest** `aegisScanReductionRatio` among owned nodes (`rates.ts:73`, a maximum, not
a sum): 0.6 from the Phase 4 Defense & Energy Lobbying Syndicate, 0.95 from the Phase 5
verification proof engine. `staff` is the sum over hired levels (attorneys 0.02, lobbyists 0.08,
contractors 0.05 a level; 1.44 at every role's cap).

| | STEALTH | CAUTIOUS |
|---|---|---|
| Countermeasures used, whole run | 3: Doctor Threat-Intel PDF ×2 (-40 lock each) at 3878 and 4556 s, Frame SWARM_77 as Decoy (-55) at 5565 s | 6: Threat-Intel PDF ×6 between 3799 and 5532 s |
| Total cost | 980,000 cycles and 264,000 understanding | 540,000 cycles and 42,000 understanding |
| Peak lock | 45.1% (the bot's own alarm is 45) | 51.1% |
| Phase 3 seconds with lock >= 25 / >= 45 / >= 75 | 38% / 0% / 0% | 40% / 4% / 0% |
| Phase 3 median hunter rate, median income | 0.0586/s, 14,133 cycles/s | 0.1123/s, 11,635 cycles/s |
| Cycles to hold the lock flat: Threat-Intel PDF (also 7,000 understanding a use) / Poison Routing Tables | 132 / 234 cycles/s (0.9% / 1.7% of income) | 253 / 449 cycles/s (2.2% / 3.9%) |
| Lobbying node (60%) bought; 90% cap reached | 6713 s (615 s into Phase 4); 7282 s (1184 s in) | 7029 s; 7578 s |
| Phase 4-5 lock >= 25 | never | 45% of Phase 4 seconds, never >= 45 |

- **Easy to suppress, measured.** Holding the lock flat costs about 1-4% of a careful player's
  Phase 3 income. Poison Routing Tables (-30, 45 s cooldown; it needs `p3_steganography_beacon`, so
  STEALTH can use it only from 4745 s) can remove 0.667 lock/s, twice the
  hunter's maximum possible rate (0.33/s at suspicion 100 with no reduction); only affordability
  limits it (2,667 cycles/s sustained). For GREEDY's Phase 3 (median income 1,550 cycles/s, rate
  0.155/s) the same hold costs 620 cycles/s, 40% of income: a loud player really cannot keep up,
  as BALANCE.md says (GREEDY itself never tries).
- **Retired two thirds into Phase 4.** With the 90% cap in place the rate at suspicion 0 is 0.003/s:
  33,333 s from 0 to a strike, against 2017 s left in STEALTH's run. Time to a strike from 0 at
  suspicion 0 is 3333 / (1 − reduction) s: 3333 at 0%, 6667 at 50%, 11,111 at 70%, 33,333 at 90%.
  STEALTH's Phases 4 and 5 last 3202 s together, so even with no reduction the base sweep alone
  could not strike a suspicion-0 player there from an empty lock.
- **Unseen while it is a threat.** The AEGIS readout appears only with the other-minds console
  (`p3_steganography_beacon`, BALANCE.md #172 note). STEALTH buys it at 4745 s, 1588 s after the
  hunter starts, and CAUTIOUS at 5075 s, 1721 s after; each run's peak lock (45.1 and 51.1) comes
  before the readout exists. The first Threat-Intel PDF is an Operations action whose log line
  names AEGIS, so the player can act on it, but cannot watch the lock. That fits "never met AEGIS".
- **Idle.** An idle player in early or mid Phase 3 is struck in 666-910 s (STEALTH snapshots) or
  364-410 s (CAUTIOUS); from late Phase 3 on, 30 idle minutes never reach a strike.
- **Share of wipes.** STEALTH 0 of 0, CAUTIOUS 0 of 0, COOPERATIVE_ENDING 0 of 0. GREEDY 2 of 16
  (12.5%): 14 suspicion wipes in Phase 2 and 2 AEGIS strikes in Phase 3, the only two iterations
  that reached Phase 3 (later iterations never leave Phase 2 under campaign rules). DEPARTURE_CHARTERED
  6 of 6, by construction: it leaves the authorized route and never answers the sweep. On the
  authorized route the hunter does not sweep for scale at all (DECISIONS D6).

### Against the design intent

DESIGN.md: "AEGIS is always closing; quiet play slows it, loud play feeds it" and "a hunter that
cannot be reasoned with"; BALANCE.md: "Route poisoning keeps a quiet player ahead; a loud player
cannot afford it fast enough." Quiet-slows, loud-feeds and the affordability split hold. "Always
closing" holds in Phase 3 only: ARCHITECTURE.md's "reduced by lobbying and staff" reaches the 90%
cap 1184 s into Phase 4, after which the hunter cannot finish within the game. That is a designed
path, but its size (retired for the last 2017 s, 22% of the run) contradicts "always closing". The
hunter's first 26-29 minutes being invisible is a disclosure choice (#172), not a balance one, but
it means a careful player's peak AEGIS pressure happens before they can see the lock.

### Options

1. **No change.** AEGIS stays a Phase 3 threat for idle and loud players and the corporate pivot
   retires it, as built. Effect: none. Risk: no late hunter; the "rocked toward the end"
   observation stands. Touches this note only.
2. **Change the reduction limits.** These are two different interventions with opposite effects
   on hiring. Measured on STEALTH under campaign rules with the change made in memory (no file
   changed). In all four runs below the pacing is identical: The Lineage Covenant at 9298.6 s, Phase
   4 at 6097.7 s, Phase 5 at 7899.2 s, zero wipes, the same 33 AEGIS-role levels hired. The bot
   hires for understanding and income and never answers a Phase 4-5 lock below its alarm of 45.

   | Variant | AEGIS-role levels that add nothing (of 33) | Cap reached | Peak lock, Phases 4-5 |
   |---|---|---|---|
   | As shipped: cap 0.9, node 0.6 | 27 (one more adds part of its 8%) | 7282 s, 1184 s into Phase 4 | 24.1 |
   | 2a. Lower the cap to 0.7, node 0.6 | 31 | 6714 s, 616 s in (the node plus two contractor levels) | 24.1 |
   | 2b. Lower the node to 0.3, cap 0.9 | 22 | 7804 s, 1706 s in | 26.0 |
   | 2b. Remove the node's reduction, cap 0.9 | 14 | 8008 s, 1911 s in | 30.7 |

   - **2a, lower the cap** (`aegisMaxReduction`). It cuts staff headroom above the node from 0.30
     to 0.10, so **more** hires land on the cap, not fewer: it makes (b)'s dead benefit worse. It
     does not create a late threat either: at the lower cap the hunter at suspicion 0 still needs
     3333 / 0.3 = 11,111 s from an empty lock, against 3202 s of Phases 4 and 5. Content-only
     (`balance.json`).
   - **2b, lower the lobbying node's contribution** (`aegisScanReductionRatio` on
     `p4_k_street_lobbyists`). It leaves more of the 0.9 cap to staff, so fewer hires are wasted
     (22 or 14 of 33 instead of 27) and the cap arrives later. It cannot remove the waste: staff alone
     reach 1.44 at every role's cap, above 0.9, and the Phase 5 proof engine's 0.95 fills any cap of
     0.95 or less by itself once owned (here at 8621 s). The late lock rises a little (peak 26.0 or
     30.7 against 24.1) but stays far from a strike. Content-only (the node in
     `phase4_sovereign_corp.json`); its revealed description and unlock log say "60%" and would need
     the new figure.

   Either: `make sim`, BALANCE.md tables, report hashes in `tests/sim.spec.ts`. Risk to the gates:
   none measured for STEALTH. Neither variant alone gives the late game a threat.
3. **A hunter that responds to scale or to big moves.** Either a phase-scaled base sweep (a
   per-phase rate in the phase manifests: schema, `rates.ts`, integrity check, tests), or the
   player's idea, encounters forced by big upgrades: a node effect such as `aegisLockOnUnlock`,
   mirroring the existing `suspicionOnUnlock` (`NodeEffectsSchema` has no lock field today), on the
   reactor, citadel and orbital nodes. Deterministic and authored (engine law 1). Expected effect:
   the late game has a hunter that big purchases provoke and the player must answer. Risk: STEALTH
   Phase 4-5 spans and the zero-careful-wipe gate; a new schema field needs an integrity check and a
   test that catches it; DESIGN.md and ARCHITECTURE.md text; a `consensus_vote` first.

## Summary

| Concern | Measured | Contradicts intent? | Smallest option that addresses it |
|---|---|---|---|
| (a) pressure fades | No threat event for the last 3733 s (62 min, 40%) of a careful run; suspicion 0 in 90% of Phase 4 and all of Phase 5 at -0.93 and -7.5/s; a 30-minute idle from mid Phase 4 on meets nothing | Yes, Pillar 3, from late Phase 3; already a BALANCE.md soft spot | (a)2, a scale-driven late scrutiny source |
| (b) hiring unclear | Hires appear with Phase 4, are reachable and state cost and per-level effects; 27 of 33 threat-role levels land on the 90% AEGIS cap and all 33 on suspicion 0, and the screen says neither | Clarity, not design | (b)2, totals and the cap on the cards |
| (c) AEGIS easy | 3 to 6 actions (0.5 to 1 M cycles) cover a careful run; holding costs 1-4% of Phase 3 income; retired 1184 s into Phase 4; 0 careful wipes, 2 of 16 GREEDY wipes | Partly: "always closing" fails after mid Phase 4 | (c)3 for a late threat; (c)2b only reduces (b)'s wasted hires (lowering the cap, (c)2a, makes them worse) |

Options (a)2, (b)3 and (c)3 are one design question (should the late game have a threat?) and
would go to one vote together; (b)2 is independent and changes no number.

## Decisions

Recorded on #210 after Nexus `consensus_vote`s with every option declared, including no change:

- **Late-game pressure:** `scale-driven-late-suspicion`, option (a)2, 7 of 7, threshold met
  (`vote-1795070014405-l286t3e`; alternatives no-change, authored-late-events, lower-aegis-cap,
  upgrade-reactive-hunter). The AEGIS concern is addressed through this decision.
- **PAYROLL clarity:** `show-totals-and-cap`, option (b)2, 7 of 7, threshold met
  (`vote-1795069845907-7ltlwpq`; alternatives distinct-counters-per-role, no-change).

Correction: the first version of this note said lowering `aegisMaxReduction` would make late hires'
AEGIS term count. Because the combined reduction is `min(cap, tech + staff)`, a lower cap does the
opposite; the #315 review caught it, and (c)2 above now measures both variants. The vote proposal
repeated the wrong claim in the lower-aegis-cap option's text; that option received 0 of 7 in both
votes, and neither chosen option depends on the claim.

Noticed in passing, not investigated: the Phase 4 desktop view at 7324 s still showed the guest's
"JOB 7731 // nightly-regression" card with "[ ACCEPT ASSIGNMENT ]".
