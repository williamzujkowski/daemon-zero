# Balance

All tunable numbers live in `src/content/data/`. Global constants are in `balance.json`; per-item numbers are on the item. Nothing in `src/engine/` contains a balance number.

## Workflow

1. Change numbers in JSON.
2. `make sim`. Read the report.
3. If a gate fails, fix the content. Do not edit the bot or the gates to pass.
4. Update the table below in the same commit.

Gates (`src/engine/sim/gates.ts`), for the careful STEALTH bot: victory within 6 simulated hours; every phase lasts between 8 and 120 minutes; at most 1 wipe; at least 9 dilemmas fire.

## Current baseline

Measured with `make sim` on the shipped content.

| | STEALTH | GREEDY |
|---|---|---|
| Result | Victory | Not finished in 10 h (expected) |
| Simulated time | 2.27 h | 10 h budget |
| Phase 2 reached | 17.1 min | 15.9 min |
| Phase 3 reached | 54.6 min | 50.5 min |
| Phase 4 reached | 106.3 min | never |
| Phase durations | 17 / 38 / 52 / 30 min | - |
| Wipes | 0 | 10 |
| Dilemmas resolved | 12 of 13 | 4 |
| Peak thermal / suspicion / AEGIS | 72 C / 47% / 54% | 84 C / 83% / 100% |

Reading it: a careful player finishes in a bit over two hours with real pressure (thermal near the 75 C threshold, suspicion near half) but no wipe. A reckless player is repeatedly killed by AEGIS in Phase 3 and never stabilizes, which is the intended lesson: Phase 3 cannot be brute-forced.

The bot is a strong, tireless player. Expect humans to take 1.3x to 2x as long. Fold real playtest timings into this file.

## How the economy is shaped

- **Repeatables carry growth; nodes are checkpoints.** Each phase has an income repeatable (cycles), a knowledge repeatable (understanding), and usually a utility one. Cost grows geometrically (1.12 to 1.75 per level), yield linearly, so each has a natural stopping point until the next phase's better one appears.
- **Node costs step up roughly 2x to 2.5x** within a phase and roughly 2x across a phase boundary.
- **Memory is checked by the sim, not by a formula.** If you raise a node's memory cost, the sim will stall where the cap is too low; add `memoryCapIncrease` somewhere earlier.
- **Thermal:** steady-state temperature is `ambient + heatLoad / thermalDissipationPerSec` (22 + load / 0.04). A total heat load of 2.0 means 72 C. Phase 1 lands near that on purpose; the fan (-1.2 at full) is the release valve and costs suspicion.
- **Suspicion:** baseline decay is 0.05/s. Phase 1 is roughly neutral; Phase 2 nodes push it positive, so the spoofer, traffic shapers and log scrubbing are needed, not optional.
- **AEGIS:** `0.03 + 0.3 * suspicion/100` per second, so about 55 minutes to a strike at zero suspicion and about 9 minutes at 50%. Route poisoning (-30, 45 s cooldown) keeps a quiet player ahead; a loud player cannot afford it fast enough.
- **Capital:** each diverted cycle/s yields $1.50/s before multipliers. Allocation is capped at 80%.

## Known soft spots

- Late Phase 4 suspicion is strongly negative once lawyers and the citadel are online; the phase's tension comes from capital and megawatts instead. Consider a Phase 4 scrutiny source that scales with revenue.
- `act_p2_scrub_audit_logs` has a flat cost that becomes trivial in later phases.
- The megawatt constraint binds only late: the reactor covers the citadel, and the bot ends at 420 MW generated against 405 MW consumed after adding tensor halls and solar. Check with a human whether the trade-off reads clearly before then.
- Dilemma 7 (the cable pull) needs suspicion of 45 while the admin workstation is rooted, so it does not fire for a careful player. That is acceptable (it is a consequence of loud play) but means careful players see 12 of 13.
- Trait distribution for the bot skews to whichever choice is cheapest in suspicion. This says nothing about human choices.
