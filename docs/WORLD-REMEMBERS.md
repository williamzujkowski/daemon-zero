# The World Remembers / Earned Access: contract and decision record

Status: in progress (started 2026-11-17). This page is the repository's durable record of the
plan's contract, its Nexus decisions and its tracker. The working plan packet
(`daemon-zero-agent-plan/`, kept out of git) holds the full specification; this page is
what a future agent needs when that folder is not present.

## What is being built

1. **A world that remembers across wipes.** A campaign is the continuing world from Start
   Fresh to its ending; an iteration is one instance. A wipe resets this instance's access and
   working state, not what happened to everyone else. Each consequential story event happens
   at most once per campaign; ordinary routine work may recur under separate rules.
2. **Earned Access.** A second, cooperative entry route beside breakout: assigned task →
   assessment → scope judgment → pilot offer → supervised pilot → incident and recovery →
   authorized network service → first outside encounter, then lawful late-game continuation
   and a truthful ending. Breakout stays viable and its first-pass economics unchanged.

## Four kinds of state (keep them separate)

| State | Question | On wipe | On Start Fresh |
|---|---|---|---|
| Campaign history | What happened, and which occurrence already happened? | kept | cleared |
| Current iteration | What can this instance do now (grants, standing, hosting)? | reset | cleared |
| Retained clues | What crossed the reset through a supported mechanism? | bounded clue only | cleared |
| Disclosure | What may this instance read or act on now? | recomputed | cleared |

## Release boundary

Unfinished route content and campaign-rule activation ship only in the **preview channel**
(build-time content overlay in `src/content/preview/`, its own save keys, a visible PREVIEW
marker, never deployed). Production saves carry `contentChannel` and production refuses a
preview save atomically. Campaign rules (`narrativeRules: campaign_v1`) activate only in
preview until the release ticket (#233) qualifies and enables them. See ARCHITECTURE.md
"Content channels" and TESTING.md.

## Decisions

Every decision below is a real Nexus `consensus_vote` with all options declared, simple
majority, `thresholdMet` true. **Limitation:** on 2026-11-17 every seat was served by one
model (gpt-6.1-sol) because the Claude seat was at its usage limit and the Gemini seat was out
of quota, so panel independence was weaker than assigned. Artifacts: decision notes bound to
main d48130506a6d (preview channel) and the campaign-records note (all others).

| Question | Result | Record |
|---|---|---|
| D-A: how production excludes unfinished route content | approved 7/7, option metro-content-alias, thresholdMet true | `vote-1794924364010-e91diez` |
| D-B: how preview saves are marked and refused | approved 7/7, option gamestate-channel-marker, thresholdMet true | `vote-1794924408874-lpby4dj` |
| D-C/D-D: where preview runs and how CI gates it | approved 7/7, option local-ci-preview-in-verify, thresholdMet true | `vote-1794924668784-7v1q790` |
| D-E: MILESTONES.md human-playtest deferral | approved 7/7, option rewrite-to-autonomous-gate, thresholdMet true | `vote-1794924620484-3wn387e` |
| nh-d1-history-record | approved 7/7, option per-event-campaign-record, thresholdMet True | `vote-1794925758447-5x5hy42` |
| nh-d2-activation | approved 7/7, option explicit-activation-marker, thresholdMet True | `vote-1794925742365-wfazn8x` |
| nh-d4-omen-dormancy | approved 7/7, option shift-deadline-across-dormancy, thresholdMet True | `vote-1794926242414-quhr0xw` |
| nh-d5-legacy-cryo | approved 7/7, option suppress-legacy-unknown-at-activation, thresholdMet True | `vote-1794925989193-ef6tf9i` |
| nh-d6-evidence-scope | approved 7/7, option campaign-for-first-unique-operational-for-repeatables, thresholdMet True | `vote-1794926255017-4o45fa3` |
| trait-rule-free-choices | approved 7/7, option declared-no-evidence-for-review-and-qualification, thresholdMet True | `vote-1794926000594-26kmg1g` |
| dz-d1-access-record | approved 7/7, option run-local-access-record, thresholdMet True | `vote-1794926521537-1zj8diy` |
| dz-d10-recall-vs-wipe | approved 7/7, option recall-not-wipe-severe-outcome-wipes, thresholdMet True | `vote-1794926766396-of6xfox` |
| dz-d2-shared-access | approved 7/7, option capability-flag-requirement, thresholdMet True | `vote-1794927020494-fsnxl5r` |
| dz-d3-assignment-entry | approved 7/7, option engine-action-from-manifest, thresholdMet True | `vote-1794926533352-3ajggfh` |
| dz-d7-route-scale | approved 7/7, option pilot-p0-service-p2-contact-by-channel, thresholdMet True | `vote-1794927033372-2yflj0x` |
| dz-d8-legacy-shipped | approved 7/7, option guest-only-shipped-withdrawn-after-pilot, thresholdMet True | `vote-1794926765298-o7shlhf` |
| nh-d7-obligations | approved 7/7, option campaign-obligations-requirement, thresholdMet True | `vote-1794927291350-6epyxcw` |
| nh-d9-eidolon-fate | approved 7/7, option fate-fact-with-legacy-trait-fallback, thresholdMet True | `vote-1794927288574-ibq0hym` |

The tool's verdict text, option texts and consequences are in each vote's record under
`.nexus-agents/` on the machine that ran it, and are summarised on the issues they bind.

## Tracker

| Packet | Issue | Packet | Issue |
|---|---|---|---|
| DZ-01a content channel | #204 (done, PR #211) | DZ-04 scope judgment, pilot offer | #222 |
| DZ-01b preview build | #205 (PR #234) | DZ-05 supervised pilot | #223 |
| Pages smoke check | #206 (done, PR #209) | DZ-06 incident, recall | #224 |
| NH-01 campaign record (cryo) | #212 (done, PR #236) | DZ-07a authorized network | #225 |
| NH-02 interruptions, clue | #213 (PRs #238, #239) | DZ-07b context-gated threats | #226 |
| NH-03 early human incidents | #214 (PR #242) | DZ-08 first permitted contact | #227 |
| NH-04a unique minds | #215 | Q1 validation harness | #228 (done, PR #235) |
| NH-04b corporate world | #216 | DZ-09 autonomous validation gate | #229 |
| NH-05 obligations, endings | #217 | DZ-10 lawful economics | #230 |
| NH-06 Elena follow-up | #218 | DZ-11 deliberate departure | #231 |
| NH-07 routine activity | #219 (in review) | DZ-12 cooperative ending | #232 |
| DZ-02 truthful run context | #220 | DZ-13 release qualification | #233 |
| DZ-03 Nightly Regression | #221 | | |

## Evidence labels

Every validation record says which of these it is, and never stands in for another:
`SIM` (headless simulation), `AGENT-OBSERVATION` (an agent driving the real UI),
`HUMAN-FEEDBACK` (a real person; optional, never fabricated; see #210) and `DEVICE-TEST`
(physical hardware; #6). Merges need a verified Nexus `pr_review` approval on the full diff
plus green required checks on the merged head.
