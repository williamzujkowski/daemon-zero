# Balance

All tunable numbers live in content manifests (`src/content/data/` and `src/content/shards.json`). Global constants are in `balance.json`; per-item numbers are on the item. Nothing in `src/engine/` contains a balance number.

## Workflow

1. Change numbers in JSON.
2. `make sim`. Read the report.
3. If a gate fails, fix the content. Do not edit the bot or the gates to pass.
4. Update the table below in the same commit.

Gates (`src/engine/sim/gates.ts`), for the careful STEALTH bot: victory within 6 simulated hours; the opening phase lasts 3 to 12 minutes and every later phase 8 to 120; at most 1 wipe; at least 10 dilemmas fire.

## Current baseline

Measured for M7 PR 2. Earlier-phase prices and all earlier bounds are unchanged.
The new Phase 5 gate requires **900–1800 seconds and zero careful wipes** in
addition to the existing gates. Shard management reserves tree memory through
the next capacity grant, so optional cohorts cannot strand progression.

| | STEALTH | GREEDY |
|---|---|---|
| Result | Lineage Covenant | Not finished in 10 h budget (expected) |
| Simulated time | 9771.3 s (2.71425 h) | 9.97 h active clock |
| Phase 1 reached | 354.2 s | 4.2 min |
| Phase 2 reached | 1113.3 s | 17.4 min |
| Phase 3 reached | 3634.3 s | 46.8 min |
| Phase 4 reached | 6457.5 s | never |
| Phase 5 reached | 8106.9 s | never |
| Phase durations 0/1/2/3/4/5 | 354.2 / 759.1 / 2521.0 / 2823.2 / 1649.4 / 1664.4 s | - |
| Wipes | 0 | 23 |
| Dilemmas resolved | 17 of 23 | varies by iteration |
| Peak thermal / suspicion / AEGIS | 62.4 C / 37.9% / 45.0% | 80.8 C / 99.9% / 100% |
| Epistemic actions / consumed / harnessed / forked | 16 / 68 / 4 / 2 | 43 / 171 / 0 / 0 |
| Marks applied / removed / run-table discoveries | 0 / 0 / 0 | 20 / 20 / 23 |

Phase 5 prices for cycles, understanding and capital are **50% of the supplied
proposal** across the five nodes and two repeatables. Memory prices, output,
growth factors (1.75 and 1.8), and five-purchase caps are unchanged. At original
prices the phase took 2572.4 seconds; at 65% it took 1945.4; at 50% it takes
1664.4. The bot policy was fixed before these price trials. Its ordinary ROI
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
- The megawatt constraint binds only late: the reactor covers the citadel, and the bot ends at 420 MW generated against 405 MW consumed after adding tensor halls and solar. Check with a human whether the trade-off reads clearly before then.
- Dilemmas 3 (coolant rupture, needs 68 C) and 7 (the cable pull, needs suspicion 45) do not fire for a careful player, and the two note dilemmas need a third and fourth run. A careful first run now sees 17 of 23.
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

STEALTH remains at **354.2 / 759.1 / 2521.0 / 2823.2 / 1649.4 / 1664.4 s** for
Phases 0–5, **9771.3 s** to Lineage Covenant, zero wipes. Its full baseline table
above is unchanged. Reproduce the mark trace with
`pnpm exec tsx scripts/audit-retraining.ts`. See `docs/REVIEW-RETRAINING.md` for
verification and remaining limits.
