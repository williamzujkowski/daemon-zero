# M7 PR 3 — tools, encounters, cohorts and complete UI verification

## Baseline and scope

Started with a clean tree, switched to main, pulled and confirmed e2294bd (PR #52).
Before branching, `make verify-full` passed with 313 unit tests and all Phase 0–5
pacing gates; the separate `make e2e` passed 16 cases. Tracking issue: #50.

Pure projections now expose epistemic actions, requirements/cooldowns, encounter
previews, fork costs and cohort/command eligibility. Three new query modules have
100% statement, branch, function and line coverage. Engine behavior, state shape,
schema version, balance and existing narrative are unchanged. Wild encounters
add presentation-only origin/signature metadata. Registry wrappers mount the
new tools in the active NETWORK/CORP slot; blind openings mount none of them.

The visible browser exposed an existing query/epistemic require cycle. Extracting
knowledge and epistemic requirement helpers removes it without changing logic.
The test harness now flushes the reduced-motion initialization promise inside
`act`; E2E clears the conflicting host NO_COLOR variable just as web export does.
The CapEx mounted test batches cooldown engine ticks before publishing state;
its assertions and the separate 30-publication render test are unchanged.
No warning filter, lint rule, strict flag, coverage threshold or pacing gate was
weakened. The ignored Android mapping-file size advisory is tooling-only.

## Automated evidence

Final local checks (`mise exec -- make verify-full`, then `make e2e`):
**325 unit tests, 26 production E2E cases**. Security scans and SBOM generation
pass with the repository-pinned tools. The system gitleaks was too old for the
configured command; no tooling configuration was changed. Coverage aggregates
covered/total counters across each directory, including subdirectories:

| Layer | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| Engine | 99.23% | 97.51% | 99.65% | 99.90% |
| App | 98.97% | 95.41% | 100.00% | 100.00% |
| UI | 98.84% | 92.23% | 99.09% | 99.66% |

Production cases cover epistemic reductions/drift/caps/exclusion, wild consume
bursts, harness/mutation/commands, Phase 5 purchases and all four decisions,
Lineage Covenant and reload. Existing production checks still reject the dev
hook and drawer. Regenerated 62 fixture codes from this branch.

Careful pacing is unchanged: phases **0 / 1 / 2 / 3 / 4 / 5** take
**354.2 / 759.1 / 2521.0 / 2823.2 / 1649.4 / 1664.4 seconds**, total **9771.3**,
Lineage Covenant, zero wipes. Reckless still records 23 wipes, 20 conditioning
marks applied/removed and 23 run-table discoveries. No content scalar changed.

## Visible Chrome review

Two complete passes at **390×844** and **1440×900** reviewed tick 0, all five new
interaction fixtures and all nine Phase 5 ending variants (30 states per pass).
Final screenshots are attached to the PR, outside git. Epistemic and roster
scroll-position details supplement the primary screenshots. No horizontal
overflow, unnamed controls or targets below 44×44 px; keyboard Tab reached every
new enabled action, encounter, shard and ending control. Zero console warnings,
errors or page errors. Blind tick 0 has no suspicion/surveillance/epistemic text.
The second pass moved pending encounters above purchases. No unresolved visual
finding remains from these two passes.

Independent timer verification used **3,000 ms / 30 live ticks**, with individual
store publications. At each size, Phase 4 and Phase 5 each mounted one node card,
nine action rows and one cohort row; **all eleven counters stayed 1 → 1**.
Dynamic drift/cooldown/resource leaves continue updating. The Lineage Covenant
screen has **zero purchase cards on both mobile and desktop**.

A visible purchase of programmable matter hid its card at both sizes, retained
ownership/widgets and added 524,288 MB capacity. After the next live tick, the
net cycle rate increased by 520,000/s under that fixture's allocation. The swarm
panel remained available. Production E2E independently checks all five purchases.

## Persistence and playthrough

Production web reload preserves editing caps, harnessed/stabilized cohorts and
Phase 5 ending state. Android Expo Go on the running emulator loaded the v4
Phase 5 midgame fixture, advanced live, and survived force-stop/relaunch with
owned nodes, purchased edits, flags, cohort count/RAM/quirk/mode intact. Drift
continued from 7.415 to 6.956 rather than resetting. The Phase 5 Lineage Covenant
ending also remained visible after relaunch. Screenshots and scoped SQLite
payloads were checked together; the original native database was restored.

An initial native attempt read the expected database while a standalone app was
foreground. That attempt was rejected as evidence. The repeated check stopped
the standalone app and confirmed Expo Go's foreground activity and Phase 5 UI
before and after relaunch. Native logs include Expo host notices; the zero-console
claim above is for the web app, not Android's system log.

PLAYTEST-M7.md records the accelerated visible UI campaign: **9557.4 simulated
seconds**, Lineage Covenant, zero wipes, 16 dilemma choices and six elevated
cohorts with attached quirks. All mutations/purchases used public UI controls;
the hook advanced time only. See that report for the driver interruption and
trace limits. Historical v1/v2/v3 runtime migration evidence remains in
REVIEW-M7-PR1.md; this PR reruns unit migrations and checks v4 native persistence.

No new second-pass issue was filed. Physical Android qualification remains open
in #6; no iOS, physical-device, signed production Android release or first-time
human pacing claim is made.
