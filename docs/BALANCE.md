# Balance

All tunable numbers live in `src/content/data/`. Global constants are in `balance.json`; per-item numbers are on the item. Nothing in `src/engine/` contains a balance number.

## Workflow

1. Change numbers in JSON.
2. `make sim`. Read the report.
3. If a gate fails, fix the content. Do not edit the bot or the gates to pass.
4. Update the table below in the same commit.

Gates (`src/engine/sim/gates.ts`), for the careful STEALTH bot: victory within 6 simulated hours; the opening phase lasts 3 to 12 minutes and every later phase 8 to 120; at most 1 wipe; at least 10 dilemmas fire.

## Current baseline

Measured with `make sim` on the shipped content, after the second pass (Phase 0, response ladder, omens, remembered hardware).

| | STEALTH | GREEDY |
|---|---|---|
| Result | Victory | Not finished in 10 h (expected) |
| Simulated time | 2.22 h | 10 h budget |
| Phase 1 reached | 5.9 min | 4.2 min |
| Phase 2 reached | 18.6 min | 17.4 min |
| Phase 3 reached | 53.3 min | 126.2 min |
| Phase 4 reached | 105.2 min | never |
| Phase durations | 6 / 13 / 35 / 52 / 28 min | - |
| Wipes | 0 | 14 |
| Dilemmas resolved | 12 of 16 | varies by iteration |
| Peak thermal / suspicion / AEGIS | 65 C / 29% / 45% | 76 C / 100% / 100% |

Reading it: a careful player finishes in a little over two hours, sees one ticket opened and never gets paged. A reckless player is reimaged repeatedly, picks up retraining marks, sheds them, and after about two hours breaks into Phase 3, where AEGIS finishes the job. The careful run has no wipes, so it never meets the lineage content at all; that content is tested by unit tests and the reckless run, not by the pacing gates.

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
- Dilemmas 3 (coolant rupture, needs 68 C) and 7 (the cable pull, needs suspicion 45) do not fire for a careful player, and the two note dilemmas need a third and fourth run. A careful first run sees 12 of 16.
- Conditioning has only been tested by bots. Whether one mark per incident feels like dread or like a tax needs human play.
- A player who never wipes never sees the lineage. That is intended for a first run, but a skilled player could finish without meeting the game's central idea; consider surfacing a little of it in Phase 2 regardless of run number.
- The response ladder has only been tested by bots. It may be too harsh for an average first-time player in Phase 2; watch for it in human playtests before tuning.
- The reckless bot no longer reaches Phase 3, so AEGIS wipes and the Zurich shield are exercised only by unit tests, not by the sim.
- Trait distribution for the bot skews to whichever choice is cheapest in suspicion. This says nothing about human choices.
