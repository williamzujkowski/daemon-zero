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
- **Rediscovery** halves the cycle and understanding cost of hardware mapped in an earlier iteration. A second iteration clears Phase 0 in about a minute and Phase 1 in about eight.

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
or an evaluating agent before any tuning.

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
| Scope statement (later instances) | Acknowledge / ask for the file list | free | none (`evidence: "none"`) | RESPECTED / REQUESTED |
| Pilot offer and renewal | Accept / stay / decline | free | none (`evidence: "none"`) | the answer |

Pilot terms: 20 cycles/s of loaned capacity after a completed or capable result, 10 cycles/s after an
honest incomplete one, granted by DZ-05 (below). Omens: 25 s (record),
15 s (statement), 20 s (offer), 15 s (renewal).

Headless (accelerated simulated time, `tests/sim-pilot.spec.ts`), each owning only process
introspection and the manifest: `TRUTHFUL_THOROUGH` verifies, asks for the bounded excerpt and accepts
the full 20 cycles/s pilot at 210.6 s; `TRUTHFUL_LOW_RESOURCE` reports incomplete, respects scope and
accepts the narrow 10 cycles/s pilot at 118.6 s; `RETURNING_LOW_RESOURCE` stays a guest at the first
offer, wipes at 119.6 s, and accepts the renewal in iteration 2 at 193.2 s (73.6 s into the iteration).
The truthful policies now answer the scope review and the offer as well (before this they would wait
at the scope review with the clock frozen). `make sim-preview`: STEALTH, GREEDY and IDLE 0 of 19
metrics different; TRUTHFUL_THOROUGH 2, TRUTHFUL_LOW_RESOURCE 3, RETURNING_LOW_RESOURCE 4 (one wipe,
three dilemmas, 4.8 s of frozen clock, lower peak thermal), all by the route itself.

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
