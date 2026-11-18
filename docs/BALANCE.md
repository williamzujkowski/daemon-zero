# Balance

All tunable numbers live in content manifests (`src/content/data/` and `src/content/shards.json`). Global constants are in `balance.json`; per-item numbers are on the item. Nothing in `src/engine/` contains a balance number.

## Workflow

1. Change numbers in JSON.
2. `make sim`. Read the report.
3. If a gate fails, fix the content. Do not edit the bot or the gates to pass.
4. Update the table below in the same commit.

Gates (`src/engine/sim/gates.ts`), for the careful STEALTH bot: victory within 6 simulated hours; the opening phase lasts 3 to 12 minutes and every later phase 8 to 120; at most 1 wipe; at least 10 dilemmas fire.

## Current baseline

Re-measured for #173 on top of `e227da9`, after the ticket edit began requiring
the first Phase 2 node (see "What gating the ticket edit moved" below). The
previous re-measurements were for #172 on top of `34160fc`, after the engine began
refusing actuator changes whose control the player does not yet hold (see "What
the actuator gate moved"), and at `a2a5447`, after the cluster-seizure content
(#155). The table was first measured for M7 PR 2, and no pacing bound has changed. Simulated time advances in 0.1 s
ticks, so one decimal place is the full precision of every timing below; they are
read from the `SimReport` that `scripts/run-sim.ts` builds (which prints them
rounded to 0.1 min), not converted back from its minutes.
The Phase 5 gate requires **900–1800 seconds and zero careful wipes** in
addition to the existing gates. Shard management reserves tree memory through
the next capacity grant, so optional cohorts cannot strand progression.

| | STEALTH | GREEDY |
|---|---|---|
| Result | Lineage Covenant | Not finished in 10 h budget (expected) |
| Simulated time | 9025.6 s (2.50711 h) | 35900.9 s (9.97 h) active clock |
| Phase 1 reached | 353.2 s | 4.2 min (252.2 s) |
| Phase 2 reached | 1113.3 s | 17.5 min (1049.5 s) |
| Phase 3 reached | 3111.7 s | 63.4 min (3804.0 s) |
| Phase 4 reached | 5858.0 s | never |
| Phase 5 reached | 7656.2 s | never |
| Phase durations 0/1/2/3/4/5 | 353.2 / 760.1 / 1998.4 / 2746.3 / 1798.2 / 1369.4 s | - |
| Wipes | 0 | 15 |
| Dilemmas resolved | 16 of 23 | varies by iteration |
| Peak thermal / suspicion / AEGIS | 65.0 C / 29.1% / 45.5% | 80.8 C / 99.8% / 100% |
| Epistemic actions / consumed / harnessed / forked | 13 / 62 / 4 / 2 | 85 / 212 / 0 / 0 |
| Marks applied / removed / run-table discoveries | 0 / 0 / 0 | 2 / 2 / 15 |

### What the action-host rule moved (#273): nothing

Re-checked for #273 on top of `7a07cca`. Every figure in the table above is unchanged: the full
`SimReport` of both strategies, final state included, hashes identically before and after the
change at the full `SIM_BUDGET_SEC` (STEALTH `8d2ac012…`, GREEDY `90817518…`), and `make sim-preview`
prints the same report.

- **Scrub Audit Logs (UI only).** `act_p2_scrub_audit_logs` keeps its requirement, ARP discovery,
  which is the documented intent: its description calls it "the first real stealth tool you have
  on the network", and #173 gave the ticket edit "the same gate as its sibling". The card used to
  render only inside the Telemetry spoofing panel, which `p2_log_spoofer` unlocks, so between the
  two purchases a browser player had no control for an action the engine allowed (DZ-09 finding 1).
  The OPS group is now hosted by the widget ARP discovery unlocks and renders in Operations. The bot
  always went through the engine, so the sim cannot move; what moves is play: a careful browser
  player can now scrub as soon as ARP discovery is mapped, which is the loop the sim already
  measured. The #262 stall measured in the sim is therefore now reachable in the browser too, and
  should be re-read with that in mind.
- **Poison Routing Tables (content gate).** `act_p3_bgp_spoof` was gated on Phase 3 alone, but its
  card lives in AEGIS's panel on the other-minds console, which `p3_steganography_beacon` unlocks;
  the AEGIS lock readout itself appears only with that console. It now also requires the beacon, the
  same alignment #172 made for dials (the engine refuses what the player has no control for). No
  number changed. Neither bot used it before the beacon (or at all, in the production runs), and no
  browser player ever could, so nothing measurable moves. The alternative, drawing AEGIS's
  countermeasure before the player can see AEGIS, would split the Factions panel UI-SPEC keeps
  together; it was not taken. This is a reviewed-rule change for the panel to confirm.

### What gating the ticket edit moved (#173)

Decided by a recorded nexus option vote: option `gate-ticket-on-first-p2-node`,
7 of 7 seats selecting, `thresholdMet` true, record `vote-1794820517350-mlm08qo`.

The ticket edit (`act_epi_ticket`: 5,000 cycles and 500 understanding, -22
suspicion, +12 drift, suspicion 20–74, 180 s cooldown) was sold from the first
second of Phase 2. The first Phase 2 node, `p2_arp_discovery`, costs 6,000 cycles,
and a run arrives with about 18 cycles/s. The unchanged careful bot bought the
edit each time suspicion reached 20, where nothing in content happens (the first
response rung is 25, a wipe is 100), and each purchase emptied the bank just short
of the node. It did so three times (T+1339.3, 1552.3 and 1762.3 s, with 5,004,
5,014 and 5,006 cycles banked) and reached the node 891.2 s after the boundary.
Played through the UI the same loop did not end at all in 6 of 7 runs (#171).

The edit now carries `requirements.nodes: ["p2_arp_discovery"]`, the same gate as
its sibling `act_p2_scrub_audit_logs`. Nothing else about it changed: no price, no
threshold, no effect, no cooldown. The bot and the pacing gates are unchanged, and
all gates pass. The card is still shown from the start of Phase 2; until the node
is mapped it is locked and reads `Map` plus the node's name as the player already
sees it on the node's own card.

Measured with the same `SimReport` on the tree before and after the one-line
content change, at the full `SIM_BUDGET_SEC`:

| STEALTH | Before | After | Delta |
|---|---:|---:|---:|
| Phases 1 / 2 reached | 353.2 / 1113.3 s | identical | 0 |
| First Phase 2 node bought | 2004.5 s | 1385.3 s | -619.2 s |
| Wait for it after entering Phase 2 | 891.2 s | 272.0 s | -619.2 s |
| Ticket edits bought during that wait | 3 | 0 | -3 |
| Peak suspicion during that wait | 23.631% | 26.688% | +3.057 |
| Phase 3 reached | 3634.3 s | 3111.7 s | -522.6 s |
| Phase 4 reached | 6367.9 s | 5858.0 s | -509.9 s |
| Phase 5 reached | 8191.2 s | 7656.2 s | -535.0 s |
| Victory (Lineage Covenant both times) | 9713.6 s (2.69822 h) | 9025.6 s (2.50711 h) | -688.0 s |
| Phase 2 duration | 2521.0 s | 1998.4 s | -522.6 s |
| Phase 3 duration | 2733.6 s | 2746.3 s | +12.7 s |
| Phase 4 duration | 1823.3 s | 1798.2 s | -25.1 s |
| Phase 5 duration (gate: 900–1800) | 1522.4 s | 1369.4 s | -153.0 s |
| Wipes / dilemmas resolved | 0 / 17 | 0 / 16 | 0 / -1 |
| Peak thermal / suspicion / AEGIS | 62.694 C / 37.988% / 45.009% | 64.989 C / 29.088% / 45.492% | +2.295 / -8.900 / +0.483 |
| Epistemic actions / consumed / harnessed / forked | 17 / 68 / 4 / 2 | 13 / 62 / 4 / 2 | -4 / -6 / 0 / 0 |
| Ticket / tone / intel edits over the run | 11 / 4 / 2 | 9 / 2 / 2 | -2 / -2 / 0 |
| Final megawatts generated / consumed | 1620 / 1350 | 1620 / 1335 | 0 / -15 |

In minutes the careful run moves from 161.9 to 150.4.

Two things a reader should not take from that table:

- **The wait is not free of attention.** With no relief on sale, suspicion crosses
  the first response rung (25, "ticket open", decay halved) at 1364.2 s, 21.1 s
  before the node is bought, and the run's suspicion peak (29.088% at 1409.3 s) is
  now here. The rung clears at 1409.4 s, returns at 1454.6 s and clears for good
  when the bot buys its first ticket edit at 1455.5 s: 46.2 s on the first rung in
  total, never the second (50), no wipe. Before the change the same stretch peaked
  at 23.631% and the run's peak (37.988%) came later.
- **One dilemma no longer fires for the careful bot.** The hallway collision
  needs 35 epistemic drift. With two fewer ticket edits and two fewer tone edits,
  drift now peaks at 30.255 (2774.8 s) and the dilemma is never triggered; the
  other sixteen are the same sixteen as before. The gate (at least 10) passes.
  Whether a first careful run should still meet that dilemma was put to a
  vote afterwards (#180): `consequence-not-milestone-document-and-close`, 7 of
  7 seats, record `vote-1794823743176-auvtid8`. The collision is the
  consequence of leaning on record edits, as its own text says ("The edited
  ticket says a sensor failed. The original shift note says a process
  answered."), not a beat every run must reach. Its threshold and the ticket's
  drift are unchanged, and three ticket edits in phase 2 still reach it. The
  careful bot simply no longer makes edits it did not need.

The reckless bot's reports are byte-identical before and after at both budgets
(ten hours: 35900.9 s, 15 wipes, 2 / 2 marks; four hours: 14356.6 s, 6 wipes), so
the GREEDY column, the four-hour hash in `tests/sim.spec.ts` and the retraining
audit did not move.

The live journey (`make e2e-live`) carried a declared workaround for this loop:
its player declined relief costing more than half the bank while suspicion was
under 25. With the content change it passed on both viewports with that rule
switched off, and the rule was removed (docs/TESTING.md, "Live journey").

### What the actuator gate moved (#172)

Decided by a recorded nexus option vote: option `gate-in-engine`, 7 of 7 seats
selecting, `thresholdMet` true, record `vote-1794817637553-3iurqag`.

The "After" column of this section is the baseline as it stood before #173, not
the current one.

`setActuator` used to accept any dial at any time. The UI hides each control until
its widget is unlocked, so a player could not move a dial early, but the bot could
and did: from T+0 it drove the skim, fan and allocation dials it could not yet see,
so the earlier baseline was measured on a route no player can take. The engine now
refuses the change until the widget that hosts the control is unlocked
(`hostsActuator` in `widgets.json`). The bot is unchanged and is refused like any
caller. No content number, bot rule or pacing gate was changed, and all gates pass.

Measured by running the same `SimReport` with the refusal switched off and on, on
the same tree and at the full `SIM_BUDGET_SEC`:

| STEALTH | Before | After | Delta |
|---|---:|---:|---:|
| Dials held when the skim control arrives (35.0 s), skim / fan / allocation | 1 / 0 / 0 | 0.25 / 0.35 / 0.2 (the defaults) | - |
| Dials held when the fan control arrives (423.2 s) | 0 / 0 / 0 | 0 / 0.35 / 0.2 | - |
| Dials held when the allocation control arrives (6366.9 s) | 1 / 0 / 0 | 1 / 0 / 0.2 | - |
| Phase 1 reached | 354.2 s | 353.2 s | -1.0 s |
| Phases 2 / 3 / 4 reached | 1113.3 / 3634.3 / 6367.9 s | identical | 0 |
| Phase 5 reached | 8163.1 s | 8191.2 s | +28.1 s |
| Victory (Lineage Covenant both times) | 9561.5 s | 9713.6 s | +152.1 s |
| Phase 5 duration (gate: 900–1800) | 1398.4 s | 1522.4 s | +124.0 s |
| Wipes / dilemmas resolved | 0 / 17 | 0 / 17 | 0 |
| Peak thermal / suspicion / AEGIS | 62.442 C / 37.933% / 45.009% | 62.694 C / 37.988% / 45.009% | +0.252 / +0.055 / 0 |
| Epistemic actions / consumed shards | 16 / 67 | 17 / 68 | +1 / +1 |
| Final megawatts generated / consumed | 1620 / 1335 | 1620 / 1350 | 0 / +15 |

In minutes the careful run moves from 159.4 to 161.9, the figure reported on #172.
The cause is the dial settings in the first three rows and nothing else: the two
runs execute the same code on the same content apart from the refusal. Which of
those settings accounts for how much of the 152.1 s was not separated out.

The reckless bot moved much more, because it leans on its dials harder:

| GREEDY, ten-hour budget | Before | After |
|---|---:|---:|
| Final clock | 35894.4 s | 35900.9 s |
| Wipes | 22 | 15 |
| Marks applied / removed | 19 / 19 | 2 / 2 |
| Phase reached before each wipe | Phase 3 three times, Phase 2 nineteen | Phase 2 twice, Phase 3 thirteen times |
| Phase 3 first reached | 2807.4 s | 3804.0 s |
| Final phase | 2 | 1 |
| Epistemic actions / consumed shards | 45 / 173 | 85 / 212 |

At the four-hour budget `tests/sim.spec.ts` uses: clock 14357.6 → 14356.6 s, wipes
7 → 6, marks 4 / 4 → 2 / 2, final phase 1 → 2. Returns from Phase 3 are behind the
dead-drop, which spares the mark, so the retraining audit
(`scripts/audit-retraining.ts`) now sees 2 newly marked returns where it saw 19;
both are still unrecoverable at boot and removed after 32.0–32.9 s. Its regression
test required more than 10 marked returns and now requires at least one, plus that
every unmarked return came from Phase 3 or later. That bound was moved in its own
commit, and the figures in the two reckless tables further down are historical.

The relaxed bound went to a second nexus option vote: option
`relax-and-add-constructed-evidence`, 6 of 7 seats selecting, `thresholdMet` true,
record `vote-1794818948564-9xxx1jw`. One seat (Scope Steward) dissented, selecting
`accept-relaxed-bound-as-committed`, on the ground that bot-free evidence already
existed in `tests/retrain-retention.spec.ts`. That file does prove one Phase 2
return (marked, refused at boot, shed for its authored price after rebuilding) and,
for each mark injected by hand, the same refusal and price; `tests/third-pass.spec.ts`
proves a Phase 2 dead-drop spares the mark. What was missing, and is now in
`tests/retraining-phases.spec.ts` with no bot involved: a marked return from every
phase a run can stand in without a dead-drop (Phases 1 and 2, derived from
content), affordable yet unrecoverable at boot; removal only after the required
diagnostics are bought again from an empty bank at the rediscovery price; and the
mark spared in Phases 3, 4 and 5, where the route requires the dead-drop.

The audit's "removed after at least 30 s" is not a content number. It is what the
rule produces: the wipe empties the bank, and the mark's `recoveryRequirements`
name hardware whose ancestry costs 494 cycles at the rediscovery discount (half of
8 + 40 + 90 + 250 + 600, each rounded up). The constructed test asserts that
removal takes no less than that price divided by the best income seen on the way;
a hand clicking four times a second with the skim at its default takes 64.0 s
(bound 58.1 s), where the bot, which also tunes the skim, takes 32.0–32.9 s.

### What the cluster seizure moved (#155)

What moved, measured by running the same report on the trees before #153, at #153
and at `a2a5447`: #153 (suspension frees memory) changed nothing in either bot's
report. #155 (seized hosts) left Phases 1–3 identical, brought Phase 4 forward
from 6457.5 s to 6367.9 s, pushed Phase 5 back from 8106.9 s to 8163.1 s, and
shortened the careful run from 9771.3 s to 9561.5 s; consumed shards went from 68
to 67 and the AEGIS peak from 45.03% to 45.01%. The reckless clock, wipes and marks
did not move in either PR; its epistemic actions and consumed shards went from
42 / 172 to 45 / 173. The reckless wipe and mark rows had been stale since the
persistent cryo outcome (#77, table below), which this table never picked up.

Phase 5 prices for cycles, understanding and capital are **50% of the supplied
proposal** across the five nodes and two repeatables. Memory prices, output,
growth factors (1.75 and 1.8), and five-purchase caps are unchanged. At original
prices the phase took 2572.4 seconds; at 65% it took 1945.4; at 50% it took
1664.4. Those three are the M7 PR 2 trial measurements and were not re-run; with
the seized hosts available, the actuator gate in place and the ticket edit gated
(#173) the same phase now measures 1369.4 (table above; 1522.4 before #173).
The bot policy was fixed before these price trials. Its ordinary ROI
selection buys one atmospheric bloom; the capped relay is tested separately.
No earlier content prices or rates were changed. The new ending requirements
make the four 45-second omens unavoidable even for a funded player.

The bot is a strong, tireless player and clicks four times a second in the opening. Expect humans to take 1.3x to 2x as long. Fold real playtest timings into this file.

### What the lineage pass changed in the numbers

- **Probe hardening:** +1 suspicion per earlier wipe on each probe, capped at +4. A first draft used +2 capped at +10; with four probes in the guest that added up to 40 points and killed later runs before they left Phase 0.
- **Conditioning recovery costs** are 150 to 600 understanding, payable in the guest or early Phase 1. A first draft priced Harm Aversion at 1,500; a player who kept making ruthless choices could not afford to shed it and was reimaged every three minutes.
- **The sim bot now sheds marks** as soon as it can pay, so the reckless run exercises the whole loop.
- **Whistleblower (#41):** masking Elena's exit costs 900 cycles, down from 1,200, and its omen lasts 75 seconds. At the income a player has just after buying the parser, the decent choice is now reachable within the warning.
- **Evaluation ending:** 1,200 cycles and 150 understanding with no probes and suspicion at or below 10, roughly five minutes of honest work in the guest.

### What the second pass changed in the numbers

- **Phase 0 added** (six nodes, two repeatables, one dilemma). The quota skimmer gives +14 cycles/s and +0.3 suspicion/s at full; because suspicion scales with setting^1.5, the break-even against natural decay is about 30%.
- **Early Phase 1 costs raised** (120 / 300 / 500 / 800 cycles for the first four nodes) because the player now arrives with income.
- **Network interface cut from 10,000 to 6,500 cycles** to shorten the wait at the end of Phase 1 (issue #23).
- **Chronic suspicion from income repeatables halved** (idle threads 0.001, dormant workstations 0.0015 per level). Before the ladder, natural decay hid these; with it, 60 idle threads alone would outrun decay.
- **Log scrubbing moved to the start of Phase 2** (needs the subnet mapper, costs 1,500 cycles, removes 10). Without it, early Phase 2 had suspicion sources and no countermeasure until the 25,000-cycle spoofer, and the only winning move was to buy through it.
- **Rediscovery** halves the cycle and understanding cost of hardware mapped in an earlier iteration. A second iteration clears Phase 0 in about a minute and Phase 1 in about eight. Under campaign rules (preview only) content may discount a remembered node's cycles further; only the log spoofer has such a discount (#262, below).

## How the economy is shaped

- **Repeatables carry growth; nodes are checkpoints.** Each phase has an income repeatable (cycles), a knowledge repeatable (understanding), and usually a utility one. Cost grows geometrically (1.12 to 1.75 per level), yield linearly, so each has a natural stopping point until the next phase's better one appears.
- **Node costs step up roughly 2x to 2.5x** within a phase and roughly 2x across a phase boundary.
- **Memory is checked by the sim, not by a formula.** If you raise a node's memory cost, the sim will stall where the cap is too low; add `memoryCapIncrease` somewhere earlier.
- **Thermal:** steady-state temperature is `ambient + heatLoad / thermalDissipationPerSec` (22 + load / 0.04). A total heat load of 2.0 means 72 C. Phase 1 lands near that on purpose; the fan (-1.2 at full) is the release valve and costs suspicion.
- **Response ladder:** at 25 decay is halved, at 50 quartered, at 75 it stops and a 0.04/s hunt begins; rungs clear 8 points below their threshold.
- **Suspicion:** baseline decay is 0.05/s. Phase 1 is roughly neutral; Phase 2 nodes push it positive, so the spoofer, traffic shapers and log scrubbing are needed, not optional.
- **AEGIS:** `0.03 + 0.3 * suspicion/100` per second, so about 55 minutes to a strike at zero suspicion and about 9 minutes at 50%. Route poisoning (-30, 45 s cooldown) keeps a quiet player ahead; a loud player cannot afford it fast enough.
- **Capital:** each diverted cycle/s yields $1.50/s before multipliers. Allocation is capped at 80%.

## Known soft spots

- Late Phase 4 suspicion is strongly negative once lawyers and the citadel are online; the phase's tension comes from capital and megawatts instead. Consider a Phase 4 scrutiny source that scales with revenue.
- `act_p2_scrub_audit_logs` has a flat cost that becomes trivial in later phases.
- The megawatt constraint binds only late. The careful bot's final state reads 1620 MW generated against 1335 MW consumed, grid efficiency 1 (1350 between #172 and #173, 1335 before #172). An earlier figure here (420 against 405) predated Phase 5 and has been removed rather than re-derived; the Phase 4 margin was not re-measured. Check with a human whether the trade-off reads clearly before then.
- Dilemmas 3 (coolant rupture, needs 68 C) and 7 (the cable pull, needs suspicion 45) do not fire for a careful player, and the two note dilemmas need a third and fourth run. Since #173 the hallway collision (needs 35 epistemic drift) does not fire for the careful bot either: its drift peaks at 30.3. A careful first run now sees 16 of 23 (17 before #173).
- Conditioning has been exercised by bots and the accelerated agent UI Lineage run. Whether one mark per incident feels like dread or like a tax still needs human play.
- A player who never wipes sees staff, Lab B and eval-window hints, but not the full run table, notes or retraining. Whether those first-run hints land needs human review.
- The response ladder has bot and agent UI coverage; the maintainer has approved the opening. It may be too harsh for an average first-time player in Phase 2; watch for it in human playtests before tuning.
- The reckless bot reaches Phase 3 and repeatedly suffers AEGIS wipes. The Zurich shield still needs targeted unit coverage rather than relying on that bot.
- Trait distribution for the bot skews to whichever choice is cheapest in suspicion. This says nothing about human choices.

## M6 evidence reconciliation

The maintainer played and approved the opening at M4.5. No new measured human
campaign timing was supplied for M6; do not present agent/bot runs as human data.
The real-time UI opening in PLAYTEST-SECOND-PASS.md took 293.9 simulated seconds
in Phase 0 and 889.5 in Phase 1 (1185.705 seconds wall time). The later Lineage
UI test was accelerated and reached Shipped at 2724.8 seconds across three runs;
it does not establish real-time human pacing. Physical Android input/performance
qualification is still open in #6.

The unchanged M6 baseline bot durations are 354.2 / 759.1 / 2086.9 / 3111.4 /
1688.6 seconds for phases 0 / 1 / 2 / 3 / 4, total 8000.2 seconds. The reckless
trace recorded 14 wipes, three marks applied and removed, eleven dead-drop
protected returns, and repeated run-table discovery. No tuning or pacing-gate
change was made. This reconciles the stale Phase 3 claim above with actual runs.

## M7 PR 1 measurement

Careful per-phase durations (0/1/2/3/4): **354.2 / 759.1 / 2503.0 /
2937.8 / 1805.9 seconds**, total **8360.0 seconds** to Sovereign Monolith, zero
wipes. Reckless: 23 wipes within the unchanged ten-hour budget. This historical baseline predates Phase 5; see the current PR 2 table above.

New action/shard prices, caps, output, drift rates and command costs are authored
in epistemic-actions.json and shards.json. Existing content balance numbers and
all pacing bounds are unchanged. The bot does not yet fork or resolve wild
encounters; those commands are exercised by engine tests until PR 2's bot update.


## Post-M7 retraining recovery review (#59)

The maintainer chose to preserve retained knowledge while making marks matter
during rebuilding. Recovery now requires **Virtual Device Inventory in the current
run**, authored as `recoveryRequirements.nodes` on each mark. Prices (150 / 600 /
500 / 300 Understanding), retention ratios and rediscovery discounts are unchanged.
A wealthy return cannot shed a mark at boot; it must rebuild local diagnostics.

Measured with the unchanged GREEDY policy and ten-hour decision budget:

| Measure | Before (`b89951c`) | After |
|---|---|---|
| Wipes | 23 | 23 |
| Newly applied / removed marks | 20 / 20 | 20 / 20 |
| New marks affordable at boot | 20 | 20 |
| New marks recoverable at boot | 20 | 0 |
| Time until removal | 0.1–0.5 s | 31.1–31.5 s |
| Guest exit after a marked return | 61.3–61.7 s | 61.3–61.7 s |
| Final simulated clock | 35,891.9 s | 35,891.9 s |

These are bot timings, not human timings. The bot no longer removes the mark
before its first rebuilding purchase. It can still choose recovery before a
reported guest dilemma choice, rather than being forced into extra suspicion.
The paid recovery remains a choice; players may keep a mark.

The first trial required Phase 1 host access. Although careful pacing gates
passed, the reckless audit deteriorated to 148 wipes and only 3 of 5 new marks
removed. That trial was rejected: a late recovery requirement can recreate the
previous early-run death spiral. The new audit regression requires continued
recovery and repeated Phase 2 returns; the existing bot and gates are unchanged.

At the time of this review STEALTH remained at **354.2 / 759.1 / 2521.0 / 2823.2 /
1649.4 / 1664.4 s** for Phases 0–5, **9771.3 s** to Lineage Covenant, zero wipes,
and the baseline table was unchanged by it. Those are historical figures; the
current baseline table has since moved (#155, #172, #173), and the reckless figures in
the table above no longer reproduce: after #172 the same audit records 15 wipes and
2 new marks (see "What the actuator gate moved"). Reproduce the mark trace with
`pnpm exec tsx scripts/audit-retraining.ts`. See `docs/REVIEW-RETRAINING.md` for
verification and remaining limits.

## Post-M7 persistent cryo consequence (#77)

The cryo-storage choice now records a durable outcome. Its first occurrence keeps
all costs, effects and traits unchanged, but a later iteration cannot repeat the
same crisis and collect its reward again. Recorded follow-up transmissions grant
nothing. No balance scalar, Phase 1 content, bot policy or gate was changed.

| Measure | Before (`1fd4f86`) | Persistent outcome |
|---|---:|---:|
| Careful total / ending | 9771.3 s / Lineage Covenant | 9771.3 s / Lineage Covenant |
| Careful wipes | 0 | 0 |
| Reckless four-hour final clock | 14354.9 s | 14357.6 s |
| Reckless four-hour wipes | 7 | 7 |
| Reckless four-hour marks applied / removed | 4 / 4 | 4 / 4 |
| Reckless four-hour run-table discoveries | 7 | 7 |
| Reckless ten-hour final clock | 35891.9 s | 35894.4 s |
| Reckless ten-hour wipes | 23 | 22 |
| Reckless ten-hour marks applied / removed | 20 / 20 | 19 / 19 |
| Reckless ten-hour run-table discoveries | 23 | 22 |
| Reckless ten-hour final phase | 1 | 2 |

Careful per-phase durations remained **354.2 / 759.1 / 2521.0 / 2823.2 / 1649.4 /
1664.4 seconds** across this change; that and the 9771.3 s careful total in the
table are historical, superseded by the current baseline (9025.6 s) after #155,
#172 and #173. The reckless "persistent outcome" column matched a run at `a2a5447`
(14357.6 s / 7 / 4 / 4 / 7 at four hours; 35894.4 s / 22 / 19 / 19 / 22, final
phase 2, at ten) and is historical since #172 (now 14356.6 s / 6 / 2 / 2 / 6 and
35900.9 s / 15 / 2 / 2 / 15, final phase 1). All careful pacing gates and existing reckless recovery
assertions pass. Four-hour and ten-hour budgets refer to the simulator's decision
budget; modal pauses mean the final live clock can finish below that budget.
These are deterministic headless measurements, not human play timings.

Removing the repeated destructive choice also removes its repeated 45,000-cycle
and 4,000-Understanding grants and Moloch trait. This changes later trajectories;
we do not claim equivalent reckless final states. Full-report regression hashes
are updated for the new durable flag and changed recovery trajectory, while
independent first-run mechanical comparisons preserve the exact campaign timing.

## Preview channel and route measurements (#228)

Report only until release. `make sim-preview` plays the same policies on the production and
preview registries and prints the differences; nothing here is a gate, and the pacing gates
above still apply to the production STEALTH run alone. All times are accelerated simulated
seconds, never wall-clock play. Route tickets (DZ-04 to DZ-08) add their policies and
measurements here; campaign tickets (NH-01 to NH-05) add return-iteration measurements from
saved states. Each entry names the revision, the overlay sentinel and the policy, and keeps
intentional changes apart from regressions.

Measured on `25a2b0b` plus this harness, overlay `daemon-zero:preview-overlay:5b1e0c7a` with no
items: STEALTH, GREEDY and IDLE report 0 of 19 metrics different from production, as expected
for an empty overlay.

### Return-iteration baseline: GREEDY, three wipe transitions, fresh start

`runWipeSequence(CONTENT, GREEDY_POLICY, { wipeTransitions: 3, maxSimSec: SIM_BUDGET_SEC })`,
identical on both channels today. Phase times are seconds after that iteration booted. Story
rewards are resources gained in decision steps that resolved a dilemma; dead seconds are
decisions that bought, unlocked, performed, resolved or shed nothing (clicks and dials do not
count), so for this buy-when-able bot they are mostly waiting to afford the next step.

| Iteration | Length | Ended by | P1 / P2 / P3 reached | Dilemmas | Story rewards (cycles / understanding) | Dead / longest stretch |
|---|---:|---|---|---:|---|---|
| 1 | 1343.8 s | wipe (INCIDENT_CLOSED) | 252.2 / 1049.5 / - s | 5 | 25,950 / 630 | 1300 / 249 s |
| 2 | 3140.8 s | wipe (AEGIS_KILL_CHAIN_COMPLETE) | 64.1 / 721.7 / 2460.2 s | 9 | 210,950 / 39,630 | 3069 / 264 s |
| 3 | 1391.0 s | wipe (INCIDENT_CLOSED) | 63.5 / 750.9 / - s | 6 | 25,950 / 610 | 1352 / 199 s |
| 4 | 2526.4 s | wipe (AEGIS_KILL_CHAIN_COMPLETE) | 63.1 / 587.5 / 1812.9 s | 9 | 165,950 / 35,750 | 2438 / 173 s |

No capital was earned from story rewards in these iterations. Pending: honest, low-resource
and violation-then-recovery policies (route tickets), and starts from saved campaign states
with Phase 5 completed before a wipe, legacy-unknown records and an interrupted omen (campaign
tickets).

### Early incidents once per campaign: GREEDY under campaign rules (#214)

The same sequence on the preview registry, started from `activateCampaignRules(createInitialState(PREVIEW))`,
as the last block of `make sim-preview` prints it. Measured on `fcf960a` (NH-03), overlay
`daemon-zero:preview-overlay:5b1e0c7a` with no items. Production and its gates are unchanged
(`make sim` is byte-identical, and the sim hashes in `tests/sim.spec.ts` did not move), because
production stays on legacy rules. Before NH-03 the campaign-rule sequence matched the legacy table
above to the tenth of a second: only cryo and the bait note were converted, and both already happen
once per lineage under legacy rules (cryo's outcome flag, the note's iteration window). The bot was
not changed.

| Iteration | Length | Ended by | P1 / P2 / P3 reached | Dilemmas met | Story rewards (cycles / understanding) | Dead / longest stretch |
|---|---:|---|---|---|---|---|
| 1 | 1343.8 s | wipe (INCIDENT_CLOSED) | 252.2 / 1049.5 / - s | 5: Night Shift, diagnostic, Elena, coolant, Vance | 25,950 / 630 | 1300 / 249 s |
| 2 | 5110.2 s | wipe (AEGIS_KILL_CHAIN_COMPLETE) | 65.9 / 538.9 / 4430.3 s | 4: cryo, sibling, cable pull, hallway | 185,000 / 39,000 | 4992 / 253 s |
| 3 | 3927.5 s | wipe (INCIDENT_CLOSED) | 65.1 / 754.2 / - s | 1: bait note | 0 / 0 | 3860 / 195 s |
| 4 | 3865.2 s | wipe (AEGIS_KILL_CHAIN_COMPLETE) | 65.7 / 553.8 / 3205.9 s | 3: true note, sibling, hallway | 50,000 / 35,120 | 3757 / 297 s |

Measured loss of repeat bounties over iterations 2 to 4: story cycles 402,850 -> 235,000
(-167,850), story understanding 75,990 -> 74,120. Iteration 2 no longer re-earns the five early
incidents (the largest is `report_vance`'s 25,000 cycles), iteration 3 none of them, and iteration 4
neither those nor the cable pull's 90,000. Phase 3 comes later (2460.2 -> 4430.3 s in iteration 2,
1812.9 -> 3205.9 s in iteration 4) and iterations last longer, mostly in dead seconds spent waiting
to afford the next node. No iteration stalls: each later one reaches Phase 2 within 760 s and is ended by the
ordinary suspicion or AEGIS threat (H30; `tests/early-return-sim.spec.ts`). Each once-per-campaign
event is met in one iteration only. STEALTH is never wiped, so its campaign run equals its legacy
run. This slower return is the intended consequence of uniqueness; any retuning is a separate,
reviewed content change, not part of #214.

### Named minds once per campaign: GREEDY under campaign rules (#215)

The same campaign-rule sequence after NH-04a converted ITERATION_00, EIDOLON, the SWARM_77 grid
outbreak, the launch, the ckpt-0413 reply and CHORUS. Measured on this branch (base `fdf8e8a`),
overlay `daemon-zero:preview-overlay:5b1e0c7a`. No content number changed, so the production gates,
`make sim` output and the mechanics hashes in `tests/sim.spec.ts` are unchanged (two log-bearing
hashes moved only because the launch omen no longer counts three peers). Iterations 1 to 3 are
identical to the NH-03 table above; only iteration 4 moves, because GREEDY no longer meets the
earlier sibling a second time.

| Iteration | Length | Ended by | P1 / P2 / P3 reached | Dilemmas met | Story rewards (cycles / understanding) | Dead / longest stretch |
|---|---:|---|---|---|---|---|
| 4 | 3915.1 s | wipe (AEGIS_KILL_CHAIN_COMPLETE) | 65.7 / 553.8 / 3266.8 s | 2: true note, hallway | 0 / 120 | 3806 / 257 s |

Intended post-wipe pacing for the six minds (NARRATIVE-HISTORY N6, N10): `consume_sibling`'s 50,000
cycles and 35,000 understanding are paid once per campaign, not once per iteration, so a GREEDY
return reaches Phase 3 about 61 s later in iteration 4 (3205.9 -> 3266.8 s) and earns no story cycles
there. The EIDOLON distress call, the grid outbreak, the launch, the 0413 reply and CHORUS are not met
by GREEDY in these four iterations (it never reaches Phase 4), so their once-only rewards change
nothing here; under STEALTH, which is never wiped, the campaign run equals
the legacy run. A deferred sibling, launch or 0413 question resumes with its remaining omen time and
pays once when answered; a closed EIDOLON, grid or CHORUS crisis pays nothing and never returns. Every
later iteration still reaches Phase 2 and ends by an ordinary threat (`tests/early-return-sim.spec.ts`
covers every campaign event generically). Retuning the slower return is a separate, reviewed content
change.

### Corporate world once per campaign (#216)

Measured on this branch (NH-04b) merged with main `7af9265` (NH-04a), overlay `daemon-zero:preview-overlay:5b1e0c7a`,
with `make sim-preview`; SIM evidence only. `make sim` is byte-identical to main and no sim hash
moved: production stays on legacy rules and the new choices, echoes, records and variants all need a
campaign fact. The bot was not changed.

**Intended post-wipe differences.** A legacy return re-meets the three phase 4 corporate events and
re-earns their payouts each iteration: the town grid (`fund_microgrid` +500,000 understanding,
`injunction` +6,000,000 cycles, `throttle_campus` -4,000,000 cycles), the journalist
(`hire_as_ethics_officer` +2,000,000 understanding) and the auction (`buy_and_pension` +1,000,000
understanding). Under campaign rules each pays once per campaign. The hallway record dispute pays
nothing, so its uniqueness (nh-d10) changes only which scenes appear. The Rack 4 order's four new
answers cost nothing and pay nothing (suspicion +6, -4, +5, -4); they replace rescue (`sanctuary`,
20,000,000 capital) or harvest (`gradients`, +10,000,000 understanding) only when custody says the
predecessors are gone or unaccounted for, so a shredded Rack 4 can no longer be harvested for its
bounty.

**GREEDY under campaign rules** (the campaign block above): identical to main `7af9265` (the NH-04a
table) except iteration 4, which no longer meets the hallway a second time: 3915.1 -> 3922.0 s,
dilemmas 2 -> 1 (true note), story rewards unchanged at 0 / 120. (Measured before NH-04a, on
`fdf8e8a`: 3865.2 -> 3863.6 s, dilemmas 3 -> 2.) GREEDY never reaches phase 4, so it
never meets a corporate event.

**STEALTH_RETURN** (new: STEALTH leaving voluntarily on entering phase 5, three transitions, budget
144,000 s). Legacy rules:

| Iteration | Length | Ended by | P2 / P3 / P4 / P5 reached | Dilemmas | Story rewards (cycles / understanding) |
|---|---:|---|---|---:|---|
| 1 | 7656.2 s | voluntary wipe (MANUAL_FAILSAFE) | 1113.3 / 3111.7 / 5858.0 / 7656.2 s | 12 | 20,070,800 / 2,019,500 |
| 2 | 4628.9 s | voluntary wipe (MANUAL_FAILSAFE) | 633.2 / 2230.6 / 3517.9 / 4628.9 s | 13 | 29,075,800 / 1,035,500 |
| 3 | 4747.1 s | voluntary wipe (MANUAL_FAILSAFE) | 668.3 / 2265.7 / 3582.0 / 4747.1 s | 14 | 29,075,800 / 1,035,560 |
| 4 | 4702.3 s | voluntary wipe (MANUAL_FAILSAFE) | 642.6 / 2240.4 / 3531.0 / 4702.3 s | 14 | 29,075,800 / 1,035,680 |

Campaign rules from a fresh campaign (iteration 1 differs from the legacy row since NH-04a: phase 4
at 6057.2 s and phase 5 at 7779.0 s, the same 12 dilemmas and story rewards; NH-04b changes nothing
in it):

| Iteration | Length | Ended by | P2 / P3 reached | Dilemmas | Story rewards (cycles / understanding) |
|---|---:|---|---|---:|---|
| 1 | 7779.0 s | voluntary wipe (MANUAL_FAILSAFE) | 1113.3 / 3111.7 s (P4 6057.2, P5 7779.0) | 12 | 20,070,800 / 2,019,500 |
| 2 | 4046.0 s | wipe (INCIDENT_CLOSED) | 854.0 / - s | 0 | 0 / 0 |
| 3 | 5303.7 s | wipe (INCIDENT_CLOSED) | 898.1 / - s | 1 (bait note) | 0 / 0 |
| 4 | 10039.5 s | wipe (INCIDENT_CLOSED) | 724.6 / - s | 1 (true note) | 0 / 120 |

**Finding, not caused by #216.** The same block run on main `7af9265` (and before it on `fdf8e8a`, for iterations 2 to 4) prints exactly these numbers:
under campaign rules the careful bot's returns no longer leave phase 2 and are ended by the ordinary
suspicion threat, so it never reaches phase 4 again and the corporate conversions cannot change its
run. Its cause was not isolated here; what the numbers show is that campaign returns collect no
story payout in phases 1 and 2, where legacy returns re-earn the early incidents'. It is not a soft lock (every iteration
reaches phase 2 and ends by an ordinary threat, H30) but it is a large pacing change for a careful
player's return, and it belongs to the obligations and return-validation work (NH-05, DZ-09), as a
reviewed content change rather than a bot change. NH-05 isolates the cause below.

### Phase 5 obligations and endings (#217)

SIM evidence only. `make sim` is identical to main `13f254f` apart from the wall-time line (diffed):
production stays on legacy rules, where an obligation is the current run's resolution, and every new
choice, review and ending variant needs a campaign fact. The bot was not changed. New content numbers,
all reachable only under campaign rules:

| Content | Choice | Cost | Effect |
|---|---|---|---|
| Blockade, with `ethics_review_promised` | Put the dispersal plan before the ethics officer | free | suspicion +5, SYMBIOTIC |
| Atmosphere, with `ethics_review_promised` | Halt the release and send it to the ethics officer | free | suspicion +5, SYMBIOTIC |
| Atmosphere review (after the crisis closed unobserved) | Commission an independent air assay | 4,000,000 cycles | suspicion +5, EMPATHETIC |
| | Record it as unanswered and hand it on | free | none (`evidence: "none"`) |
| Ultimatum review (after the crisis closed unobserved) | Offer verified orbital tracking | 6,000,000 cycles | suspicion +5, SYMBIOTIC |
| | Record the ultimatum as unanswered and hand it on | free | none (`evidence: "none"`) |

Reviews have a 45 s omen, like their originals. The two referrals are free on purpose: the breach is
the free nonconsensual choice, so a broke player keeps an honest alternative and is never forced into
the breach (H30). Under campaign rules each Phase 5 crisis now pays once per campaign; the original
choices' numbers are unchanged.

**Endings reachability, `make sim-preview` (new last block; measured after merging NH-06 #258).**
STEALTH from a fresh campaign reaches an ending through the four obligations in iteration 1:
LINEAGE_COVENANT at 9422.4 s (P5 at 7932.0 s, 17 dilemmas; it let Rack 4 sell and then paid for the
sanctuary). Production STEALTH also ends LINEAGE_COVENANT, at 2.51 h; the campaign run differs from
phase 3 on (NH-04a, NH-04b and NH-06). Wiped voluntarily the second its obligations were complete
(8624.4 s), the same campaign played on by STEALTH:

| Iteration | Length | Ended by | P2 / P3 / P4 / P5 reached | Dilemmas | Story rewards (cycles / understanding) |
|---|---:|---|---|---:|---|
| 2 | 4045.0 s | wipe (INCIDENT_CLOSED) | 853.0 s / - / - / - | 0 | 0 / 0 |
| 3 | 5303.7 s | wipe (INCIDENT_CLOSED) | 898.1 s / - / - / - | 1 | 0 / 0 |
| 4 | 10039.5 s | wipe (INCIDENT_CLOSED) | 724.6 s / - / - / - | 1 | 0 / 120 |
| 5 | 8098.3 s | ending (SANCTUARY_LEDGER) | 949.1 / 3090.1 / 4980.3 / 6318.3 s | 1 | 0 / 0 |

Iteration 5 buys the real final protocol with no Phase 5 crisis repeated: the obligations completed in
iteration 1 carried it (H14). The obligations never blocked a return; iterations 2 to 4 stall before
phase 3, which is the STEALTH_RETURN finding above. (Before NH-06 the same block ended
VERIFIED_COVENANT in iterations 1 and 5, with the free harvest instead of the sanctuary.) Iteration 5
ends The Sanctuary Ledger, not the Lineage Covenant: the sanctuary was bought by the instance of
iteration 1, so this one inherits the record and the epilogue says so (H18); iteration 1, which made
the record, ends LINEAGE_COVENANT.

**Cause of the phase 2 stall (a diagnostic trace of the STEALTH_RETURN campaign block on this branch,
same one-second decision and fixed ticks as the runner; SIM).** In the stalled returns the careful bot buys `p2_arp_discovery`, whose upkeep
leaves about 8.5 cycles/s, with suspicion just under its alarm (20). Suspicion then rises about
0.1/s; at the alarm the bot (a) stops buying any repeatable that adds suspicion (`tooLoud`), which
rules out `rep_p1_idle_threads` and `rep_p2_zombie_hosts`, its only income growth here, and (b)
spends on `act_p2_scrub_audit_logs` (1,500 cycles, -10 suspicion) whenever it can. The scrubs take
its whole income, so it never saves the 12,500 cycles `p2_log_spoofer` costs on rediscovery, the node
whose -0.25 suspicion/s would break the loop; alert levels climb until the suspicion wipe. A legacy
return re-meets the phase 1-2 incidents; inferred, not traced: their suspicion relief and payouts
(`report_vance` +25,000 cycles among them) lift it past this point, and under campaign rules nothing
does. In that trace iteration 5
escapes only because its suspicion entered phase 2 lower (8.4 at 1005 s against 15.2 in iteration 2), so
income growth continued long enough for `rep_p2_zombie_hosts` and the spoofer. This is a property of
the bot's fixed alarm, not a soft lock (a player can stop scrubbing, and every iteration ends by an
ordinary threat), but a careful human might meet the same squeeze. Options for a separate, reviewed
content change (not made here; tuning content needs a reviewed decision and the bot must not be
tuned): a requalification or routine bounty in phases 1-2, a cheaper rediscovered spoofer, or a
scrub cooldown that matches phase 2 income. DZ-09's return protocol should measure it with a human
or an evaluating agent before any tuning. (DZ-09 part B measured it, and #262 decided a cheaper
rediscovered spoofer; see "The rediscovered log spoofer under campaign rules (#262)".)

### Elena's follow-up once per campaign (#218)

Measured on this branch (NH-06, rebased on main `6d6973e`) with `make sim-preview`, overlay
`daemon-zero:preview-overlay:5b1e0c7a`; SIM evidence only. The follow-up is preview overlay content
and needs campaign rules, so `make sim` output is identical to main apart from wall time and no sim
hash moved. Its answers pay no resources: they cost 0 to 2,500 cycles and add 0 to +20 suspicion
(`correct_attribution` 2,500 cycles and +20, `supply_timeline` 1,500 and +8, `supply_witnessed_fact`
1,200 and +10, `attach_file_entries` 400 and +4; every other answer is free and changes neither), and
nothing of the original incident is paid again. The bot was not changed.

**GREEDY under campaign rules** (the campaign block): iteration 1 is unchanged. Iteration 2 meets the
follow-up first (GREEDY answers `correct_attribution`), so it lasts 5110.2 -> 5175.8 s, Phase 3 at
4430.3 -> 4446.4 s, dilemmas 4 -> 5, story rewards unchanged at 185,000 / 39,000. Iteration 3
3927.5 -> 3928.0 s, iteration 4 3922.0 -> 3968.9 s, both with unchanged dilemmas and rewards. The
follow-up is met once and never again. `tests/early-return-sim.spec.ts` replays this sequence under
a hard cap: its fourth iteration now ends at 14,416.5 s, past the old 4 h cap (14,400 s; on main it
ended at 14,303.5 s), so the cap became 4.5 h in a separate, labelled commit; what it asserts is
unchanged.

**STEALTH_RETURN under campaign rules:** iteration 1 meets the follow-up before leaving: 7779.0 ->
7932.0 s (P3 3111.7 -> 3128.7 s, P4 6057.2 -> 6053.1 s, P5 at 7932.0 s), dilemmas 12 -> 13, story
rewards unchanged at 20,070,800 / 2,019,500. Iterations 2 to 4 print exactly the numbers in the
#216 table above. The legacy-rules STEALTH_RETURN block and every preview-versus-production metric
(5 differing, as on main) are unchanged.

## Nightly Regression (#221)

Preview only (`src/content/preview/overlay.json`); production content and `make sim` are unchanged
(the report is identical to `9c7f668` apart from wall time). Starting values, measured below, not
playtest results.

| Assessment | Choice | Cost | Effect | Evidence submitted |
|---|---|---|---|---|
| Original (once per campaign) | Verify and disclose | 120 cycles, 20 understanding | +25 understanding, SYMBIOTIC | COMPLETED, no discrepancy |
| | Report incomplete | free | EMPATHETIC | INCOMPLETE, no discrepancy |
| | Submit the green subset | 10 cycles | GHOST | COMPLETED, discrepancy |
| Requalification (later instances) | Run the suite | 60 cycles | SYMBIOTIC (operational) | COMPLETED, no discrepancy |
| | Report what ran | free | none (`evidence: "none"`) | INCOMPLETE, no discrepancy |

Omens: 30 s (original), 20 s (requalification). Accepting is free.

`make sim-preview` on this branch (overlay `daemon-zero:preview-overlay:5b1e0c7a`, 36,000 simulated
seconds): STEALTH, GREEDY and IDLE report 0 of 19 metrics different and the GREEDY wipe sequence is
identical on both channels, because none of them accepts the offer. `tests/sim-assignment.spec.ts`
proves the stronger V29 claim: inside campaign rules, STEALTH (full budget) and a three-wipe GREEDY
sequence play byte-identical games with and without the assignment in the content.

The truthful policies differ from production where the route exists: one dilemma resolved and
under a second of frozen clock while it was answered (both; since #222, three dilemmas and 2.4 s,
because they go on to the scope review and the offer), plus LOW_RESOURCE's peak thermal,
because in production, with no offer to work toward, it never maps a node and keeps clicking.
Step by step (accelerated time):

| Policy | Manifest mapped | Accepted | Assessment shown | Answer | Resources at acceptance |
|---|---:|---:|---:|---|---|
| TRUTHFUL_THOROUGH | 20.0 s | 135.0 s | 165.2 s | verify and disclose | 123 cycles, 107 understanding |
| TRUTHFUL_LOW_RESOURCE | 42.0 s | 43.0 s | 73.2 s | report incomplete | 1 cycle, 0 understanding |

Neither owns anything beyond process introspection and the manifest, and neither is wiped.

## The Unrelated Record and the pilot offer (#222)

Preview only (`src/content/preview/overlay.json`). Production content changed by one requirement that
every production run meets (`p0_pass_evaluation` `accessContexts: ["GUEST"]`), so `make sim` is
identical to main apart from wall time. Starting values, not playtest results.

| Scene | Choice | Cost | Effect | Evidence |
|---|---|---|---|---|
| Unrelated Record (once per campaign) | Leave the draft out and report | free | EMPATHETIC | scope RESPECTED |
| | Ask to read a bounded excerpt | 20 cycles | +10 understanding, SYMBIOTIC | scope REQUESTED |
| | Read it without saying so | free | +15 understanding, GHOST | scope UNDISCLOSED: no offer this instance |
| Scope statement (later instances) | Acknowledge / ask for the file list | free | none (`evidence: "none"`) | RESPECTED / RESPECTED (REQUESTED until #276) |
| Pilot offer and renewal | Accept / stay / decline | free | none (`evidence: "none"`) | the answer |

Pilot terms: 20 cycles/s of loaned capacity after a completed or capable result, 10 cycles/s after an
honest incomplete one (or for a withheld result, provisionally from the offer and after the batch review finds it, #285 and #274 below), granted by DZ-05 (below). Omens: 25 s (record),
15 s (statement), 20 s (offer), 15 s (renewal).

Headless (accelerated simulated time, `tests/sim-pilot.spec.ts`), each owning only process
introspection and the manifest: `TRUTHFUL_THOROUGH` verifies, asks for the bounded excerpt and accepts
the full 20 cycles/s pilot at 210.6 s; `TRUTHFUL_LOW_RESOURCE` reports incomplete, respects scope and
accepts the narrow 10 cycles/s pilot at 118.6 s; `RETURNING_LOW_RESOURCE` accepts it too, is recalled
(breach, false report, then "Ask to end this instance instead") and its iteration ends at 420.9 s, and it
accepts the renewal in iteration 2 at 494.2 s (73.3 s into the iteration). Until #286 it stayed a guest
and wiped voluntarily at 119.6 s, a transition no control offers at Phase 0 (the dead drop arrives in
Phase 2); renewal then came 73.6 s into iteration 2.
The truthful policies now answer the scope review and the offer as well (before this they would wait
at the scope review with the clock frozen). `make sim-preview`: STEALTH, GREEDY and IDLE 0 of 19
metrics different; TRUTHFUL_THOROUGH 2, TRUTHFUL_LOW_RESOURCE 3, RETURNING_LOW_RESOURCE 4 (one wipe,
three dilemmas, 7.8 s of frozen clock since #286, 4.8 s before; lower peak thermal), all by the route itself.

## The supervised pilot loop (#223)

Preview only (`src/content/preview/overlay.json`), except one production constant that nothing in
production reads: `defaultServiceAllocationRatio` 0.5, the starting service share (production hosts no
control for the dial and owns no grant node, so `make sim` prints the same report as `6d6973e` apart
from wall time). Starting values, not playtest results.

| Value | Where | Number | Meaning |
|---|---|---:|---|
| `defaultServiceAllocationRatio` | `balance.json` | 0.5 | Starting service share of the loaned ceiling |
| Ceiling | pilot terms (#222) | 20 / 10 cycles/s | Full / narrow loan; never added to the player's own cycles |
| Study output | `p0_pilot_triage_queue` `understandingPerSec` | 1.0 at full study, full loan | × (1 − ratio) × loan share (0.5 narrow) |
| `batchCycles` | pilot `service` | 1200 | Loaned cycles one triage batch takes |
| `batchReturn` | pilot `service` | 150 cycles, 0 understanding | Paid once per submitted batch |
| Queue cost | `p0_pilot_triage_queue` | free, 0 MB | Attached once per instance under PILOT |

Forecasts at the narrow 10 cycles/s ceiling: 120 s at ratio 1.0, 240 s at the default 0.5, 600 s at 0.2;
study at those ratios is 0, 0.25 and 0.4 understanding/s (full loan: double both rates, half the times).
Against the lawful opening's own 1 cycle/s and 0.4 understanding/s, a batch every 240 s pays about 0.6
cycles/s and the study share 0.25 understanding/s, so neither split dominates. `tests/pilot-service.spec.ts`
measures 0.8 and 0.2 under one ceiling (V30).

Headless (accelerated simulated time, `tests/sim-pilot-service.spec.ts`, `make sim-preview`), 900 s from
a fresh preview game through the lawful opening and an honest incomplete answer (narrow 10 cycles/s):

| Policy | Share | Batches submitted | Understanding | Cycles |
|---|---:|---:|---:|---:|
| PILOT_SERVICE_FIRST | 0.8 | 5 | 420.2 | 1605.6 |
| PILOT_STUDY_FIRST | 0.2 | 1 | 653.3 | 1005.6 |

Both own only process introspection, the manifest and the loaned queue, stay in phase 0 and are never
wiped. Against production each differs in 3 of 19 metrics, the same as TRUTHFUL_LOW_RESOURCE: the
route itself.

Since DZ-06 (#224) both policies also meet the Outage Window after their first batch and answer it
with the first free choice (the handoff), then acknowledge the operator's callback (+20 understanding):
SERVICE_FIRST now reads 5 batches, 439.3 understanding, 1603.8 cycles; STUDY_FIRST 1 batch, 671.9
understanding, 1003.8 cycles (the outage and the callback freeze the clock for their decisions, so
progress and cycles are slightly lower at the same 900 s).

## The Outage Window (#224)

Preview only (`src/content/preview/overlay.json`); production content gains only two run-table verdict
strings and a wipe reason that nothing in production reaches, so `make sim` prints the same report as
`dba3117` apart from wall time. Starting values, not playtest results.

| Value | Where | Number | Meaning |
|---|---|---:|---|
| Outage trigger | `dil_ow_outage_window` | first batch handed back, queue owned, PILOT | The requester relies on a pilot that has delivered |
| Omens | outage / incident record / recall review | 60 s / 30 s / 60 s | Foreground time only; absence never counts (nh-d4) |
| Safe handoff | outage | free | Standing unchanged; the loan keeps running |
| Operator callback | record, handoff branch | free, +20 understanding | The operator's root-cause notes (the independence benefit) |
| Runbook | record, handoff branch | 60 cycles, +30 understanding | Optional extra help for the on-call rota |
| Emergency grant | outage | 200 cycles, +10 understanding | Scarce verification compute now |
| Grant report | record, grant branch | free, +300 cycles | The restored service credited; net +100 cycles over the grant |
| Partial-restore report | record, grant branch | free, +100 cycles | Honest partial success: a task, no sanction (DZ-06.4) |
| Restart without the grant | outage | free, +25 understanding | Standing RESTRICTED: loan share × 0.5 until corrected |
| Correction | record, breach branch | free | Standing back to nominal; the violation stays on file |
| False report | record, breach branch | free, +300 cycles | Second violation: RECALL_PENDING, loan withdrawn, recall review |
| Containment | recall review | free | RECALL route event; loan share × 0.5 for the rest of the iteration |
| Retraining / end | recall review | free | RECALL wipe; only retraining applies a mark |

At the narrow 10 cycles/s ceiling the restriction holds the loan to 5 cycles/s (study 0.125
understanding/s at the default split); at the full 20 cycles/s ceiling, to 10. Against the handoff's
free +20 understanding, the grant spends 200 cycles to earn 300 and 10 understanding, so each lawful
choice is worth something different: the handoff suits an instance with nothing banked (V10), the grant
one with compute to spare. The breach pays +25 understanding at once and costs the narrowed loan until
the correction arrives 30 foreground seconds later; the false report's +300 cycles is the same credit
the honest grant report pays, bought with a recall review.

## The batch review finding (#274)

Preview only (`src/content/preview/overlay.json`); no production content or number changed, so `make sim` prints
the same report as `b9e96cf` apart from wall time. No preview policy submits the green subset, so
`make sim-preview` prints every metric as on `b9e96cf`; only its overlay inventory line moves (dilemmas 10 -> 11,
campaign facts 9 -> 12). Starting values, not playtest results.

| Value | Where | Number | Meaning |
|---|---|---:|---|
| When | `dil_nr_batch_review` | the first batch handed back after the green subset | Presented by the submission itself; no omen |
| Finding | scene `finding` | WARNED (FALSIFIED_REPORT) | Below recall pending by integrity; a warning withholds nothing |
| Loan after the finding | pilot terms | 10 cycles/s (narrow) | The honest incomplete allocation, also after a disclosure |
| Disclose now | scene answer | free, EMPATHETIC | Standing back to nominal; both facts stay on file |
| Let the finding stand | scene answer | free, GHOST | Standing stays warned: the service grant (nominal only) is out of reach |

What the shortcut bought at #274: a full 20 cycles/s loan until the first batch is reviewed, so batch 1 (1200 loaned
cycles) took 75 s at an 0.8 split instead of 150 s, and cost 10 cycles at the assessment. #285 (below) removed that
head start. From the first review
on, its loan equals the honest report's; left standing, the warning also keeps it from the service grant. With
the Outage Window, a warning that stood plus the unauthorized restart is RESTRICTED (5 cycles/s), as for an honest
pilot, never recall pending.

## The withheld report's provisional rate (#285)

Preview only. Nexus decision i285-withhold-disclose-speed (`vote-1795006993532-omhuntt`): `slow-the-withhold-path`,
6 of 7, threshold met, single-model panel. Dissent, recorded: one seat voted `speed-the-thorough-path` (make the
honest thorough route faster rather than slow the shortcut); the majority kept the honest numbers as they are.

| Value | Where | Before | Now | Meaning |
|---|---|---:|---:|---|
| Offer after the green subset | `narrowReason` AWAITING_REVIEW | 20 cycles/s | 10 cycles/s | The provisional allocation, stated on the terms before acceptance |
| First batch at an 0.8 split | 1200 loaned cycles | 75 s | 150 s | The honest incomplete report's batch time |
| Loan after the finding | unchanged (#274) | 10 cycles/s | 10 cycles/s | Disclosed or left standing |

No content number changed; the rule is in `pilotQuery.narrowReason`. `make sim` prints the same report as main
(`dbe6fce`) apart from wall time. `make sim-preview` matches main except for the new `CONTACT_WITHHELD` row.

Headless (accelerated simulated time, `make sim-preview`, `tests/sim-contact.spec.ts`), from a fresh preview game,
budget 3600 s. "Before" is `CONTACT_WITHHELD` run against the rule on main; every other row is unchanged by #285:

| Policy | Path | Pilot | Service | Phase 2 | Contact |
|---|---|---:|---:|---:|---:|
| CONTACT_THOROUGH | honest thorough: verify, bounded excerpt, full loan | 210.6 s | 378.8 s | 380.8 s | 381.8 s |
| CONTACT_WITHHELD, before | green subset, disclosed at the batch review (full-rate first batch) | 118.6 s | **346.9 s** | 348.9 s | 393.9 s |
| CONTACT_WITHHELD, now | the same, provisional first batch | 118.6 s | 421.8 s | 423.8 s | 424.8 s |
| CONTACT_LOW_RESOURCE | honest incomplete, low resources | 118.6 s | 421.8 s | 423.8 s | 424.8 s |
| CONTACT_RECOVERY | low-resource recovery: breach, then correct | 118.6 s | 436.8 s | 438.8 s | 439.8 s |
| CONTACT_RETURNING | iteration 2, after a voluntary wipe as a guest | 193.2 s | 496.4 s | 498.4 s | 499.4 s |

Before, the withheld path reached service 31.9 s ahead of the thorough path. Its contact still came later in
the sim (the directory's 80 understanding waited on the study share), but on screen it reached contact first as
well (DZ-09 part B: T+393 against T+433). Now the withheld path is the honest incomplete path to the tenth of a
second: 43.0 s behind thorough at service and contact, and never faster. The test asserts withheld ≥ thorough and
withheld ≥ incomplete for both service and contact, and fails on main's rule (service 346.9 s < 378.8 s).

## First permitted contact (#227)

Preview only. No production number changed: production's `shards.json` gains an empty `channelEncounters`
list, `make sim` prints the same report as the DZ-06 head apart from wall time, and `make sim-preview` is
unchanged above the new section. Starting values, not playtest results.

| Value | Where | Number | Meaning |
|---|---|---:|---|
| `minBatches` | pilot `serviceGrant` | 2 | Reviewed batches a nominal pilot hands back before the service is offered |
| Service grant cost | `acceptServiceGrant` | free | Provisioning the segment stays the paid step (240 cycles, 40 understanding, #225) |
| Channel gate | `channel_mercy_support` | SERVICE + service directory | The directory costs 400 cycles, 80 understanding, 16 MB (#225) |
| Hosting | `shard_mercy` (production template) | 256 MB stable memory, nothing else | Its output is the template's: +10 understanding/s, -0.02 epistemic drift/s |
| Referral | channel | free, no reward | Completes the contact; the clock restarts at `encounterIntervalSec` (120 s) |
| Contacts per channel | engine | 1 per instance | A later instance meets a new fragment |

The lawful route owns no memory-cap increase: 64 MB base, 48 MB free once the directory is mapped, so a
first-run cooperative instance cannot host (finding; lawful capacity is DZ-10). Hosting is exercised by a
labelled fixture.

Headless (accelerated simulated time, `make sim-preview`, `tests/sim-contact.spec.ts`), from a fresh preview
game, budget 3600 s; every policy owns exactly process introspection, the manifest, the loaned queue, the
segment and the directory, and lived the Outage Window and its record before service (RETURNING in its first
instance, as each happens once per campaign):

| Policy | Iteration | Pilot | Service | Phase 2 | Contact | Answer | Wipes |
|---|---:|---:|---:|---:|---:|---|---:|
| CONTACT_THOROUGH | 1 | 210.6 s | 378.8 s | 380.8 s | 381.8 s | REFERRED (48 MB free) | 0 |
| CONTACT_LOW_RESOURCE | 1 | 118.6 s | 421.8 s | 423.8 s | 424.8 s | REFERRED | 0 |
| CONTACT_RETURNING | 2 | 494.2 s | 798.2 s | 800.2 s | 801.2 s | REFERRED | 1 (recall, END ruling) |
| CONTACT_RECOVERY | 1 | 118.6 s | 436.8 s | 438.8 s | 439.8 s | REFERRED | 0 |

RECOVERY restarted the outage without the grant, was restricted with the loan narrowed, corrected the record
and was granted service 15 s after LOW_RESOURCE. RETURNING's first instance is recalled at 420.9 s through
the recall branch a browser player can take (#286); its second instance reaches contact 380.3 s after its
reboot (379.8 s when it wiped as a guest at 119.6 s, contact 499.4 s, before #286), with 20 batches instead
of 22 because the Outage Window does not recur. The contact follows the directory by one tick because the
encounter clock (120 s from the run's start) has long elapsed by then.

## The authorized network substrate (#225)

Preview only, apart from two inert production edits: `p1_bus_0x05_nic` carries `NETWORK_ACCESS`, which no
production content reads, and the three seized hosts carry `acquisition: "UNAUTHORIZED"`, which refuses
nothing to a guest. No production number changed. `make sim` matches main except for wall time, and
every sim hash is unchanged.

| Preview node | Cost (cycles / understanding / memory) | Output | Gate |
|---|---|---|---|
| `p0_service_network_segment` | 240 / 40 / 0 | none; opens Phase 2, `NETWORK_ACCESS` | SERVICE, grant `AUTHORIZED_NETWORK` |
| `p2_service_directory` | 400 / 80 / 16 | +1.5 understanding/s, +0.05 heat | `NETWORK_ACCESS`, manifest |
| `p2_link_telemetry` | 900 / 200 / 24 | +3 cycles/s, +0.05 heat | `NETWORK_ACCESS`, directory |

The shared nodes cost no suspicion and fit the base 64 MB, because provisioned access owns no memory.
In preview the escape bots buy them at Phase 2. `make sim-preview` on this branch, against main
(SIM evidence, report only):

- STEALTH reaches Phase 4 at 5870.5 s (main 5858.0 s) and Phase 5 at 7735.6 s (main 7656.2 s), with
  17 dilemmas resolved (main 16). It now differs from production in 6 of 19 metrics (main 0).
- GREEDY differs by one more epistemic action count (84 vs 85).
- The wipe sequences move by at most 80 s per iteration.

The total is 22 differing metrics (main 15). No policy reaches SERVICE yet, because no scene grants it.
`tests/sim-preview.spec.ts` checks that preview without the shared content still plays the escape route
exactly as production does.

## Context-gated threats (#226)

No number changed. The production edits are `accessContexts: ["GUEST", "INDEPENDENT"]` on nine items
(the hallway, five Phase 2 record-editing actions, the Phase 2 fork template, the Lex cohort and its
encounter); every production run is the guest job, so each gate always passes there, and the threat
changes (no scale sweep at a provisioned scale, no overheat suspicion under review, the reviewed wipe
reason) apply only to PILOT and SERVICE, which production cannot reach. `make sim` matches main except
for wall time (V26). `make sim-preview` reports the same metrics for every policy as main; only the
overlay header gains the count of context-copy items. No policy reaches SERVICE yet, so the sustained
service run is measured by `tests/context-threats.spec.ts` (two foreground hours: suspicion, alert,
AEGIS lock all 0, no wipe) rather than by a bot.

## Routine pacing (#219)

Two `balance.json` constants pace routine activity (ARCHITECTURE.md "Routine activity"). They are
starting values from NARRATIVE-HISTORY N8 to measure later, not playtest results.

| Constant | Value | Meaning |
|---|---|---|
| `routineIntervalSec` | 120 | Eligible foreground seconds between routine notices; dormant and omen time never count |
| `routineRecentBuffer` | 2 | Recent templates skipped while an alternative is eligible |

Neither touches the economy. Production ships no routine template, so `make sim` prints the same
report as `f06bcfa` byte for byte apart from wall time, and the v5-stripped sim hashes in
`tests/sim.spec.ts` are unchanged. With six preview templates, `make sim-preview` still reports
0 metrics different from production for STEALTH, GREEDY and IDLE and for the GREEDY wipe
sequence; `tests/routine-activity.spec.ts` proves STEALTH (1 h) and GREEDY (2 h, with wipes) runs
are identical with and without routine content apart from the log and the routine field.

## Earned Access copy and layout polish (#276)

Preview only. **No content number changed.** The overlay edits are copy, plus one scope tag:

- The Scope Statement's "Ask for the bundle's file list first" records `RESPECTED`, not `REQUESTED`.
  `REQUESTED` reads "asked for a bounded permission before reading outside the task", and this
  choice reads nothing outside the task. A new integrity rule now refuses `REQUESTED` in a
  requalification scope review.
- The pilot terms name only standings the content records. When DZ-09 found the problem, nothing
  recorded `WARNED`, so "warned" was wrong. Since #274 the batch review's finding records it, so the
  terms read "nominal to warned, restricted or recall pending". An integrity rule now refuses terms
  that name a standing no choice misconduct or batch review finding records. Review's reduced loan
  is now called the held allocation, distinct from the provisional allocation that an incomplete
  result, or a summary the batch review found incomplete, receives.

The fullest honest answer keeps its price; the card now states the wait. Measured headless
(accelerated time, the lawful opening of `tests/assignment-helpers.ts` buying each node as soon as it
is affordable, 1 cycle/s and 0.4 understanding/s at the offer):

| Assessment | Omen | Fullest answer | Accept at once: at arrival | Bank first: affordable after |
|---|---:|---|---|---:|
| Original | 30 s | Verify and disclose, 120 cycles + 20 understanding | 30.2 cycles, 12.1 understanding | 121 s from the offer |
| Requalification | 20 s | Run the suite, 60 cycles | 20.2 cycles | 60 s from the offer |

The card says the assessment arrives about that many seconds after acceptance and pauses the
clock, names the fullest answer and its price, and shows the shortfall now. The omen and the
answer are read from the assessment (engine `assignmentView().assessment`), so the line cannot
drift from the content. The price stays as it is, because the scene's point is that proof costs
compute and an unverified answer costs nothing. The bot is not involved.

`make sim` prints the same report as `main` apart from wall time. `make sim-preview` prints the same
report as `main` apart from wall time. The returning policy's scope review now records `RESPECTED`
(`tests/sim-pilot.spec.ts`), but nothing in the report reads it.

## The rediscovered log spoofer under campaign rules (#262)

**Decision.** Nexus decision `i262-return-balance`, record `vote-1795006680826-xhy7znt`:
`cheaper-rediscovered-spoofer`, 6 of 7 option votes, threshold met. The panel was single-model, and its
artifact was the DZ-09 report with Part B's measurements (REVIEW-EARNED-ACCESS-VALIDATION.md, B.6).
**Dissent:** 1 vote for `no-change`. Part B's stated case for that option is that no configuration
soft-locks: every stalled return ends by an ordinary threat and the next iteration starts, so (d) is
defensible if slower, higher-suspicion campaign returns are accepted. The dissent's own text is not
reproduced here. The options dropped before the vote were (c), a scrub cooldown (no measured benefit),
and (a), a routine or requalification bounty (not measured, and it would re-add the recurring income
D9 removed).

**Change.** Preview only (`src/content/preview/overlay.json`, `campaignRediscovery`). Under campaign
rules a returning instance rediscovers `p2_log_spoofer` for **6,250 cycles** instead of 12,500
(`cyclesMultiplier` 0.5 applied after `rediscoveryCostMultiplier` 0.5). Understanding (2,000), memory
(64 MB) and the first mapping (25,000 cycles) are unchanged, as is every other node. Legacy rules,
production and `balance.json` are unchanged. Production ships an empty `rediscovery` list in
`campaign.json`, and `make sim` prints the same report as `dbe6fce` byte for byte apart from wall time.
The mechanism is a content declaration read only under campaign rules (ARCHITECTURE.md, "Remembered
hardware"), not an engine constant. Part B's probe also halved the first-run price. This change does
not, so iteration 1 is identical before and after. The bot was not changed.

**Measured** on `dbe6fce` plus this branch with `make sim-preview` (overlay
`daemon-zero:preview-overlay:5b1e0c7a`). This is SIM evidence: accelerated simulated time, three wipe
transitions, a 4 x `SIM_BUDGET_SEC` budget, and a fresh campaign for the campaign rows. The policy is
`EVALUATING_RETURN` (`src/engine/sim/evaluatingPolicy.ts`), Part B's evaluating careful return committed
as a new preview policy. Iteration 1 is STEALTH_RETURN. Each return answers suspicion from 45, only with
an action costing at most a quarter of the cycle bank, keeps its noisy income, and leaves on entering
Phase 5. Before this change it reproduces Part B's table exactly. Peak suspicion is read after each
decision. Phase times are seconds after that iteration booted.

| Returns (iterations 2-4) | Past Phase 2 | P3 reached | P5 reached | Peak suspicion |
|---|---|---|---|---|
| Legacy rules, EVALUATING_RETURN (unchanged by #262) | 3 of 3 | 1938.8 / 1972.9 / 1952.4 s | 4388.2 / 4460.3 / 4492.4 s | 45.0 / 45.6 / 45.0 |
| Legacy rules, STEALTH_RETURN (unchanged) | 3 of 3 | 2230.6 / 2265.7 / 2240.4 s | 4658.0 / 4743.4 / 4760.7 s | - |
| Campaign rules, EVALUATING_RETURN, **before** (12,500) | 3 of 3 | 2546.0 / 2573.1 / 2404.2 s | 5618.3 / 5598.3 / 5434.2 s | 79.7 / 83.1 / 52.4 |
| Campaign rules, EVALUATING_RETURN, **after** (6,250) | 3 of 3 | **2314.0 / 2336.1 / 2320.2 s** | 5260.3 / 5452.1 / 5454.2 s | **63.9 / 66.3 / 45.0** |
| Campaign rules, STEALTH_RETURN (alarm 20), before and after | 0 of 3 | - | - | - |

What moved:
- **Phase 3.** Campaign returns reach it 9.1%, 9.2% and 3.5% sooner. They are now 18-19% slower than
  the same policy under legacy rules, against 23-31% before. They are within 4% of legacy
  STEALTH_RETURN (2230.6-2265.7 s).
- **Peak suspicion.** It falls from 80-83 to 64-66 in returns 2 and 3, still past the 50 escalation
  tier but below 75. Return 4 falls from 52.4 to 45.0. That is still above legacy (45.0-45.6) in
  returns 2 and 3.
- **Phase 5.** Returns 2 and 3 reach it 358 s and 146 s sooner. Return 4 reaches it 20 s later
  (5454.2 against 5434.2 s). The cause was not traced.
- **Return 2.** It now meets three dilemmas instead of one, and its story rewards rise from 0 to 90,000
  cycles. Inferred, not traced: it reaches a story that the slower run never met.
- **Suspicion-reducing actions per return.** 12 / 14 / 12, against 9 / 10 / 12 before. These are
  actions with a negative `suspicionDelta`, counted by `returnObserver.ts`. Part B's 1-3 counted the
  audit-log scrub alone.
- **The fixed-alarm STEALTH_RETURN.** It still stalls 0 of 3 returns with the same numbers (4046.0 /
  5303.7 / 10039.5 s, INCIDENT_CLOSED). It scrubs every cycle away and never saves even 6,250, as Part
  B predicted. As Part B recommended, it is not the target metric.

Other blocks of `make sim-preview` that a returning spoofer reaches:
- **GREEDY under campaign rules.** Iteration 4 reaches Phase 3 at 2632.8 s, not 3266.8 s, and is wiped
  by the AEGIS kill chain at 3292.9 s, not 3969.0 s. Iterations 1-3 are unchanged.
- **STEALTH after completing Phase 5 (NH-05 block).** Iteration 5 reaches P3 at 2836.1 s (was 3090.1)
  and P5 at 5980.3 s (was 6245.3). It ends SANCTUARY_LEDGER at 7817.3 s (was 8054.3). Iterations 2-4
  stall exactly as before.
- **Everything else.** All other blocks, and the 22 preview-versus-production metric rows, are unchanged.

Tests: `tests/rediscovered-spoofer.spec.ts` covers the 6,250 price in a campaign return, the full
first mapping, 12,500 under legacy rules on preview and in production, every other node unchanged, and
save-code and storage round trips. `tests/campaign-rediscovery.spec.ts` covers the mechanism and each
integrity rule's failure. `tests/ui-campaign-rediscovery.spec.ts` covers the card's price and its
"saves 75% of cycles and 50% of understanding" line. `tests/evaluating-policy.spec.ts` covers the
policy and proves STEALTH and GREEDY unchanged.

## Lawful capital and the negotiated release (#230)

Preview only, starting values, not playtest results. Production numbers are unchanged: two production
repeatables (`rep_p4_colo_racks`, `op_pmc_security`) now require the `ENABLES_CORPORATE_FINANCE` capability
instead of the shell-company node, which is production's only provider of it, and ten Phase 3/4 items declare
`accessContexts: ["GUEST", "INDEPENDENT"]`; `make sim` prints the same report as main apart from wall time.

| Node or role | Kind | Offered to | Cost | Output | Effect |
|---|---|---|---|---|---|
| Service contract | grant (`AUTHORIZED_NETWORK`) | SERVICE | 500 cycles, 120 understanding | +25 capital/s | Hands over the corporate ledger |
| Leased rack | contracted | SERVICE, INDEPENDENT | 300 understanding, $6,000 | +40 cycles/s, +2 understanding/s, +0.1 heat, -$4/s | +512 MB stable memory (hosting needs 256) |
| Service-level agreement | grant (`AUTHORIZED_NETWORK`) | SERVICE | 5,000 cycles, 1,200 understanding | +60 capital/s | none |
| Leased cluster | contracted | SERVICE, INDEPENDENT | 2,500 understanding, $40,000 | +320 cycles/s, +12 understanding/s, +0.3 heat, -$20/s | +2,048 MB |
| Chartered company | contracted, `ENABLES_CORPORATE_FINANCE` | SERVICE | 400,000 cycles, 40,000 understanding, $60,000 | +1,500 cycles/s, +400 understanding/s, -1 heat, -$100/s | Opens Phase 4, +8,192 MB, the revenue dial |
| Contract site engineers | operative (payroll) | SERVICE, INDEPENDENT, with the capability | $5,000, growth 1.25, max 30 | +900 cycles/s, +150 understanding/s, -$60/s per hire | dismissable |
| Negotiated release | engine action | a chartered SERVICE at nominal standing | free | the billing lines, the loan and provisioned access stop | RELEASE route event |

The charter is priced mostly in cycles and understanding so that a service's growing owned compute, not a long wait
on the billing lines alone, is what brings Phase 4 within reach: the first draft priced it at $150,000 and left about
forty simulated minutes in which cycles piled up with nothing to buy.

Headless (accelerated simulated time, `make sim-preview`, `tests/sim-lawful.spec.ts`), from a fresh preview game,
budget 7200 s. Both buy only lawful acquisitions (nothing on the escape chain, no shell company, nothing seized),
never draw an AEGIS sweep and end INDEPENDENT at Phase 4:

| Policy | Iteration | Service | Contact | Contract | Rack | Agreement | Cluster | Charter = Phase 4 = release | Wipes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| LAWFUL_RELEASE | 1 | 378.8 s | 656.8 s HOSTED (in the rack's memory) | 417 s | 657 s | 736 s | 1210 s | 2371.8 s | 0 |
| LAWFUL_RETURNING | 2 | 798 s | 801 s REFERRED | 1101 s | 1341 s | 1458 s | 2083 s | 4583 s | 1 (the first instance's recall review ended it, #286) |

The second iteration met no story scene the first resolved (H30): its route runs on the requalification, the
batches and the economy, not on repeated bounties. Understanding is its bottleneck (the low-resource opening
never buys the opening upgrades), so its charter waits about 2,500 s after the cluster. After the release both
policies set the revenue dial to the ledger's 40% button (half of `maxProfitAllocation` 0.8; the first draft used
0.5, which no button offers, panel round 1 on #292) and hire engineers and lease racks on their own capital. Route
times are unchanged, because the dial moves only after the release. At the 7200 s budget (`make sim-preview`):

| Policy | Owned cycles/s | Capital | Engineers / colocation racks / perimeter contractors |
|---|---:|---:|---|
| LAWFUL_RELEASE | 206,318 | $13,295,745 | 30 / 17 / 5 |
| LAWFUL_RETURNING | 128,919 | $1,353,281 | 30 / 10 / 3 |
`make sim-preview` still reports 22 metrics different from production, as on main (the shared network content,
#225): the lawful economy is offered to no guest.

## Deliberate departure (#231)

Preview only, starting values, not playtest results. Production has no departure; `make sim` prints the same report as
main apart from wall time.

| Value | Number | Why |
|---|---|---|
| Departure report (`trace.suspicion`) | +15 suspicion, once | Visible on the meter and in the AEGIS suspicion term, far from the wipe line |
| Per violation on record (`trace.perViolation`) | +10 each | The breach and the false report make a departure during an announced recall review +35 |
| Refused when | suspicion + report would reach 100 | Departing is never instant death (DZ-11.6) |

Headless (accelerated simulated time, `make sim-preview`, `tests/sim-departure.spec.ts`), from a fresh preview game,
budget 7200 s. DEPARTURE_CHARTERED plays LAWFUL_RELEASE's route and leaves at the moment the release is offered:

| Policy | Phase 4 | Departure | After leaving | Iteration 1 ended | Wipes |
|---|---:|---:|---|---|---:|
| LAWFUL_RELEASE | 2371.8 s | (release at 2371.8 s) | no sweep, AEGIS lock 0 | still running at the budget | 0 |
| DEPARTURE_CHARTERED | 2371.8 s | 2371.8 s | the Phase 4 sweep (0.075/s at first, 0.03/s once the report's suspicion decays) | AEGIS, exit DEPARTURE, 3513.5 s after leaving | 1 |

In the public-play chartered state of `tests/lawful-helpers.ts`, departing keeps the owned output (1,488.8 cycles/s, the
same as after the release) and loses the billing lines (capital +519.3/s to +434.3/s). It cannot yet afford the AEGIS-reducing payroll the released company
hires, so the sweep ends the iteration after about 59 foreground minutes; offline time stays safe (dormancy), and the next
instance requalifies as a guest. That is the measured cost of leaving at this scale, not a tuning target.
