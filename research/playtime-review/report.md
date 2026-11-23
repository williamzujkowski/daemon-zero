# Playtime review: every phase, at bot pace and at human pace

Research only: no game code, content, gate or bot was changed. Measured on `main` at `9da3ff0` (2026-11-23). The full tables are in [`data/analysis.md`](data/analysis.md) and the raw runs in `data/`. To reproduce, see the end of this file.

The maintainer asked (2026-11-23): "Why are we keeping them at 1800s? How much total playtime does the game have? I'd like players to have time to think through the narrative."

## Answer in brief

- **Bot time:** the careful bot finishes in **169 min (2.82 h)**. By phase: 5.9 / 11.1 / 30.0 / 53.9 / 39.2 / 29.0 min.
- **Human first run (modelled, not timed):** about **3.3 to 4.4 h** with reading added, or **3.5 to 5.1 h** with human purchase speed. **About 4 h** is a fair central figure.
- **Reading:** a careful run shows about **9,300 words**, or **39 min** at 238 wpm (Brysbaert 2019). That is 34% of the 27,464 authored words; the rest lies on branches the bot never takes, such as Earned Access's 8,414 words.
- **Gate pressure:** only Phase 5 pressed on a gate: 63 s of headroom under 1800 s, and content was re-priced to fit (#485, #465). The cap is now 3600 s (#539). Every other phase has 51 to 91% headroom.
- **The real problem is when text arrives, not how much there is:**
  - 87 of 96 over-full 60 s windows fall in Phases 4 and 5.
  - The densest minute is Phase 5 at about 150 min: 511 words, a fleet battle, two dilemmas 0.8 min apart.
  - 20 of 32 log bursts are in Phase 4, where payroll lines bury story lines.
  - Phase 3 is thin: 54 min with 2 dilemmas, a 45 min gap and 5 new feed lines.
  - Phase 5 ends with an 8.5 min wait and then a 33-word epilogue.
- **The decoded feed is fine.** It has 33 to 40 lines and 178 s of voice, the longest line is 19 words, and nothing outruns its 8 s rotation.

## Method

- One script (`measure.ts`) replays the unchanged careful and reckless policies one simulated second at a time, under legacy and campaign rules. Each run matched `runHeadlessSim` exactly.
- It records every new text the UI would show, through the same engine queries, in three groups:
  - **A, pushed story:** log, feed, dilemmas, the phase notice, the ending.
  - **B, decision prose:** node cards, tracks, actions, encounter cards.
  - **C, optional details:** text behind folds and in readout panels.
- Reading rate is 238 wpm, with a range of 200 to 250.
- Dilemma deliberation is assumed at 15 s (low) to 60 s (high). Dilemmas pause the clock.
- Human models:
  - **Floor:** reading overlaps all waits.
  - **Low:** reading fills the bot's waits.
  - **High:** nothing overlaps, and all text is read at 200 wpm.
- Purchase speed (2 to 5 s for each of the bot's 482 purchase-seconds) is a separate sensitivity.

## Per phase (careful bot, legacy rules)

| Phase | Bot min | Words A/B/C | Dilemmas | Read min | Density (wpm) | Human low / high min | Headroom (before #539) |
|---|---|---|---|---|---|---|---|
| 0 | 5.9 | 230/129/48 | 1 | 2.0 | 61 | 8.0 / 9.5 | 51% |
| 1 | 11.1 | 463/206/73 | 1 | 3.3 | 60 | 13.5 / 16.3 | 91% |
| 2 | 30.0 | 593/356/360 | 3 | 5.0 | 32 | 33.4 / 44.1 | 75% |
| 3 | 53.9 | 833/816/474 | 2 | 7.7 | 31 | 56.6 / 74.2 | 55% |
| 4 | 39.2 | 1125/1040/1278 | 4 | 10.9 | 55 | 47.7 / 70.3 | 67% |
| 5 | 29.0 | 1109/1067/573 | 4 | 10.4 | 75 | 36.3 / 51.7 | 3.5% |
| All | 169.0 | 4353/3614/2806 | 15 | 39.3 | | 195.5 / 266.1 | 53% of 6 h |

## Proposals (each needs a vote)

- **Gates.**
  - **A1:** the current bands, with Phase 5 now at 15 to 60 min.
  - **A2:** about twice today's bot time per phase (P1 8-25, P2 8-60, P3 8-110, P4 8-80, P5 15-60), which tightens P1, P2 and P4.
  - **A3:** also gate estimated human time and density; it needs B1 and C1 first.
- **Instrument.**
  - **B1:** a report-only `make sim-reading` target that prints this table.
  - **B2:** a reading line in `make sim`, once snapshots run only on change.
  - **B3:** gates.
- **Content pacing.**
  - **C1:** a minimum gap between dilemmas, data-driven.
  - **C2:** merge repeated mechanical log lines and let story lines hold the preview.
  - **C3:** story text in the final Phase 5 wait and a longer careful ending.
  - **C4:** an earlier Phase 3 beat.
  - **C5:** pause the clock on the phase notice and dilemma outcomes. This changes a reviewed rule, so it needs a design vote.

## Limitations

- No human was timed.
- Only the careful path is measured.
- The text inventory approximates what is on screen.
- `research/` sits outside `tsconfig.json`; it type-checks with `tsc -p research/playtime-review/tsconfig.json`.

## Reproduce

```bash
python3 -I research/playtime-review/clip-seconds.py
pnpm exec tsx research/playtime-review/measure.ts
python3 -I research/playtime-review/analyze.py
python3 -I research/playtime-review/authored.py
```
