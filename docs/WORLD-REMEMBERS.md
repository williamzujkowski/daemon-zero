# The World Remembers / Earned Access: contract and decision record

Status: released (started 2026-11-17). The release PR #301 (DZ-13, #233) merged to `main` as
`8f0b949` on 2026-11-18 and the `deploy-pages` job of that commit's `ci` run published it to GitHub
Pages the same day. It folds the route into production content and enables campaign rules for every
game; there is no preview build any more (dz13a), and production still refuses preview saves (X.3).
This page is the repository's durable record of the plan's contract,
its Nexus decisions and its tracker. The working plan packet
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

Before #233 the route and campaign-rule activation shipped only in a **preview channel**: a
build-time content overlay in `src/content/preview/`, its own save keys, a visible PREVIEW marker,
never deployed. The release removes that boundary:

- **One composition.** The overlay is now `src/content/data/earned-access.json`, an add-only pack
  that `src/content/production.ts` applies to the original game (`RAW_CONTENT =
  applyPack(ORIGINAL_RAW_CONTENT, EARNED_ACCESS_PACK)`). Every build, test, sim run and export loads
  it; there is no second composition and no Metro alias (`metro.config.js` is gone).
- **Campaign rules for every game.** The app store admits every game through
  `activateCampaignRules`: a new game enters `campaign_v1` at once, and an existing production save
  of any schema version loads as legacy and is admitted on its first entry to the store, capturing
  its then-current history once. Activation refuses a game that is already active or has ended (an
  ended save stays on legacy rules), so nothing is captured twice.
  What activation can and cannot recover from an old save is in ARCHITECTURE.md, "Legacy migration
  limits".
- **Preview saves stay refused (X.3).** `GameState.contentChannel` keeps both values, new games
  write `production`, and `deserialize` throws `SaveChannelError` for any preview-marked save before
  migration, validation or reconciliation. No `SCHEMA_VERSION` bump (still 14).
- **No unfinished route content remains (13.8).** The three notes shown after first contact, the
  negotiated release and a departure used to say the route ended there ("PREVIEW BOUNDARY", "no
  ending has been earned"). DZ-12 connected the late chain and the cooperative ending, so they are
  now "WHAT COMES NEXT" notes that say where the route goes and how to stop or start over
  (`tests/release-qualification.spec.ts`). No bounded prototype on the route claims to be unfinished.

- **The assignment offer sits after the hardware.** Production's breakout fixtures now show the
  Nightly Regression offer (the arrangement is still the guest job after an escape), and above the
  hardware it pushed the first purchase below the usable fold on every phone cell of the reviewed
  layout contract (`tests/e2e/ui-sizes.e2e.ts`, docs/UI-SIZES.md). The release keeps the contract
  unchanged and moves only the unaccepted offer below the current phases' hardware
  (`AssignmentPanel placement="offer"` in `src/ui/TerminalPane.tsx`); every later job-surface state
  (assessment, pilot, service, release, departure) stays above the hardware as before. This places a
  route surface relative to the mobile fold, so it went to a Nexus vote: dz13b, offer-after-hardware,
  7/7 (`vote-1795035911390-zjcqf8d`), over a one-line notice in place or keeping it in place and
  re-baselining the fold cells (which would weaken a reviewed gate).
  Since the follow-up fix (`fix/assignment-offer-window`) an unaccepted offer closes at the escape, so
  the breakout fixtures above Phase 0 no longer show it; the placement still governs the guest's cells.
  See "When the assignment offer closes" below.
- **The live journey's returns play the evaluating careful player.** After its deliberate wipe the
  live harness asks the unchanged bot with #262's `EVALUATING_OVERRIDES` (TESTING.md, "Live
  journey"): Nexus vote dz13c, evaluating-settings-from-iteration-2, 7/7 (`vote-1795036211282-jk5xy0o`).

See ARCHITECTURE.md "Content composition and preview saves", TESTING.md and RELEASE.md.

## Decisions

Every decision below is a real Nexus `consensus_vote` with all options declared, simple
majority, `thresholdMet` true. **Limitation:** on 2026-11-17 every seat was served by one
model (gpt-6.1-sol) because the Claude seat was at its usage limit and the Gemini seat was out
of quota, so panel independence was weaker than assigned. Artifacts: decision notes bound to
main d48130506a6d (preview channel) and the campaign-records note (the NH and DZ rows).

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
| dz-d6-pilot-loop | approved 7/7, option allocation-actuator, thresholdMet true (same single-model panel) | `vote-1794967752443-fldutlq` |
| dz-d9-unauthorized-output | approved 7/7, option disclose-and-stop-at-acceptance, thresholdMet true (same single-model panel) | `vote-1794967752663-5qklwcz` |
| nh-d8-ckpt0413 | approved 7/7, option fixed-successor-skip-number, thresholdMet true (2026-11-18, same single-model panel) | `vote-1794960079374-49h8wdn` |
| nh-d10-hallway | approved 7/7, option unique-defer-with-record, thresholdMet true | `vote-1794960031193-dhxx2vm` |
| dz-d11-truthful-phase-copy | approved 7/7, option context-variants-by-query, thresholdMet true (same single-model panel) | `vote-1794967994106-cy22kqm` |
| X.3: what production does with a pre-release preview save | approved 7/7, option keep-refusing-preview-saves, thresholdMet true; declared alternatives accept-current-preview-version-remarked and accept-any-preview-version-with-migration | `vote-1795021413579-mi9igot` |
| dz13a: the preview machinery after release | approved 7/7, option remove-dead-preview-machinery, thresholdMet true; declared alternatives keep-empty-overlay-and-alias and keep-preview-build-same-content | `vote-1795035929741-dezdlho` |
| dz13b: where the unaccepted assignment offer sits | approved 7/7, option offer-after-hardware, thresholdMet true; declared alternatives one-line-notice-in-place and keep-in-place-rebaseline-fold | `vote-1795035911390-zjcqf8d` |
| dz13c: the live journey's settings after its first wipe | approved 7/7, option evaluating-settings-from-iteration-2 (bot unchanged), thresholdMet true; declared alternatives keep-greedy-settings-and-accept-stalls and drop-return-iterations-from-live | `vote-1795036211282-jk5xy0o` |
| Release is an avenue, not an end (map #442): a released or departed instance keeps AEGIS, the world view and its suspicion (#555) | approved 7 of 7. Built as route-declared window unlocks (`unlockedByRoute`), surveillance knowledge from leaving review, and the hunters keeping the hunt's rule (`huntedForScale`); see UI-SPEC "After release or departure (#555)" | `vote-1795485274389-m6hmz9q` |

The tool's verdict text, option texts and consequences are in each vote's record under
`.nexus-agents/` on the machine that ran it, and are summarised on the issues they bind.

## Preview machinery after release (decision note)

**Decided: option A, remove-dead-preview-machinery** (Nexus vote dz13a, 7/7, thresholdMet true,
`vote-1795035929741-dezdlho`; single-model panel, artifact `daemon-zero-agent-plan/execution/decision-dz13.md`).
The fold leaves the preview build, its report, its storage keys and its marker with nothing to carry.
Because removing them undoes infrastructure the reviewed votes D-A (`metro-content-alias`) and D-C/D-D
(`local-ci-preview-in-verify`) set up, the choice went to a vote with all three alternatives declared.

| Option | What it means | Cost |
|---|---|---|
| **A (chosen; shipped in #301)** | Remove the dead machinery: `make build-preview`, `make e2e-preview`, `make sim-preview` (now `make sim-report`), the `dist-preview/` output, the preview storage keys in `src/app/storage.ts`, `src/ui/PreviewMarker.tsx`, the CI "Preview web E2E" step, `DAEMON_CONTENT_CHANNEL` and `DAEMON_E2E_CHANNEL`/`DAEMON_E2E_DIST`. Keep only the save marker's `preview` value, `SaveChannelError` and the import and storage refusal messages. | Future unfinished content has no channel to merge into; it stays on a branch until a reviewed decision says otherwise. |
| B | Keep an empty preview overlay and the Metro alias for future unfinished content. | A second composition, build, CI step and key set kept alive with nothing in them; every export test keeps proving an empty overlay absent. |
| C | Keep the preview build with its own keys, serving the same content as production. | Two builds of identical content and two storage slots on one origin; nothing to test that production does not already test. |

Option A does not alter the X.3 refusal: the marker vocabulary and both refusal messages are
unchanged, `admitChannel` (`src/engine/save.ts`) still refuses every preview-marked save before
migration (only the table that let the preview build load both channels is gone), and `tests/release-saves.spec.ts`,
`tests/save-channel.spec.ts`, `tests/app-storage-channel.spec.ts` and
`tests/e2e/preview-isolation.e2e.ts` assert them on genuine preview codec outputs. The production
keys `daemon-zero.save.v1`, `daemon-zero.save.corrupt-backup` and `daemon-zero.audio.v1` are unchanged
byte for byte. `.gitignore` and ESLint still ignore `dist-preview/`, so an old local copy is never
committed. What A removes is the preview channel and its storage keys, which D-A and D-C put in
place; that is why it went to the vote above.

## When the assignment offer closes (decision note)

**Decided (#316, PR #317).** Two multi-model Nexus `consensus_vote`s, every option declared
(artifact `daemon-zero-agent-plan/execution/decision-316-offer-window.md`):

- **Offer window:** close-at-escape, 7/7, `vote-1795070565875-457msa4` (option A below).
- **Scenes already queued at the escape:** scenes-lapse-at-escape, 5/7, `vote-1795070741286-2kjn9rj`.
  Dissent: 2 for scenes-still-play-with-truthful-copy.

A careful STEALTH run was still offered "JOB 7731 // nightly-regression" with
`[ ACCEPT ASSIGNMENT ]` in Phase 4. The offer's only requirement was the mapped manifest, and the
arrangement stays the guest job after an escape, so nothing closed it. Accepting there played the
campaign's two once-per-campaign opening scenes (the stale-fixture assessment and The Unrelated Record)
in Phase 4. Both granted their traits and reloaded cleanly, but no pilot can follow:
`qualifiesForPilot` holds only in the opening phase (nexus vote dz-d7: "an instance that has already
left it is not offered a deployment there"). The job surface then stopped at the submitted evidence,
and every later instance got the requalification job instead of the original scenes.

No reviewed rule said when the offer closes. The dz13b note above says the breakout fixtures *show*
it, and its vote decided only where it sits. Everything the offer leads to is written for a guest
that has not left. The pilot is opening-phase only, and a deferred pilot offer already lapses at the
escape (`tests/pilot-offer.spec.ts`). The pilot offer's own answers are "stay in this environment" and
"the way out included". The SPEC's third answer is "continue pursuing breakout", and D8 says
"New assignments enter at ordinary guest eligibility. Old late-game runs retain their established route."

| Option | What it means | Cost |
|---|---|---|
| **A (implemented)** | The unaccepted offer closes when the instance leaves the opening phase through the escape. Content: the assignment's `requirements.forbidsNodes` names `p0_shared_mount`. Integrity: an assignment with pilot terms must forbid every opening-phase node a guest can buy that unlocks a later phase. | A player who skipped the offer cannot take it after breaking out. The next instance (after a wipe) is offered it again. |
| B | Close it at a later phase (for example on entering Phase 2 or Phase 4). | Arbitrary: between the escape and that phase, accepting still spends the unique scenes with no pilot possible. |
| C | Never close it. Change the copy so it says that no pilot follows outside the guest. | Keeps a dead end on the job surface, and lets a late instance use up the campaign's original scenes (and their traits) at prices set for the guest. |
| D | Keep it open after the escape, but send a non-guest instance to the requalification stage (no unique scenes). | New content and a new stage rule for a path that leads nowhere. |

**Scenes queued at the escape (scenes-lapse-at-escape).** An assignment accepted in the guest keeps
its card after the escape. A scene the acceptance queued and that has not yet been presented lapses at
the escape. It is recorded as interrupted under the existing campaign lifecycle (NH-02), not presented,
and never submits evidence. It is all declared in content and the engine names no id:

- Each scene gated on the assignment adds the same `forbidsNodes: ["p0_shared_mount"]` to its trigger.
  That is an access requirement (`requirementScopes.ts`), so it fails once the guest is gone.
- `unlockNode` now revalidates the live pointers after any purchase, as route events already do
  (N4: "revalidate structure at transition"). A queued scene whose access ended takes its declared
  interruption policy at once instead of counting down to an interrupt that cannot come.
- A scene that never began has no record, and none begins outside the guest.
- Every assignment scene declares `close` (integrity requires originals to close). A lapsed original
  therefore returns for a later instance in the guest the way any closed original does: as the
  requalification job (`assessmentStage`). A scene that never began returns as the original.
- **Iteration-scoped scenes** (panel round 1 on #317). The requalification, the scope statement and
  both pilot offers are `once_per_iteration` and keep no campaign record. Revalidation used to cover
  only once-per-campaign events, so one of these queued at the escape still presented on the host
  and committed its trait and evidence. Structural revalidation (`structuralFailure`) now covers
  every dilemma that declares a campaign policy, which since NH-05 is every shipped dilemma:
  consequential events, recovery reviews, follow-ups and iteration qualifications. A dilemma with no
  declaration stays outside the lifecycle, as before. For an iteration-scoped scene, a lapse records
  what a wipe already records for it, which is nothing. The pointer is dropped, nothing is presented
  or committed, its own trigger keeps it closed for the rest of this instance, and the next instance
  in the guest meets it fresh. No new rule was added.
- The job surface says "Lapsed." (`assignmentView` status `lapsed`): the assessment can no longer reach
  this instance, it was never presented and nothing was submitted.
- Integrity requires every scene of an assignment with pilot terms to forbid the same guest exits as
  its offer.

The headless sim is byte-identical to main: no bot accepts an assignment and then escapes.

## Tracker

Issue states as of 2026-11-18.

| Packet | Issue | Packet | Issue |
|---|---|---|---|
| DZ-01a content channel | #204 (done, PR #211) | DZ-04 scope judgment, pilot offer | #222 (done, PR #257) |
| DZ-01b preview build | #205 (done, PR #234; retired by #301) | DZ-05 supervised pilot | #223 (done, PRs #261, #263) |
| Pages smoke check | #206 (done, PR #209) | DZ-06 incident, recall | #224 (done, PRs #267, #268) |
| NH-01 campaign record (cryo) | #212 (done, PR #236) | DZ-07a authorized network | #225 (done, PR #266) |
| NH-02 interruptions, clue | #213 (done, PRs #238, #239) | DZ-07b context-gated threats | #226 (done, PR #269) |
| NH-03 early human incidents | #214 (done, PR #242) | DZ-08 first permitted contact | #227 (done, PRs #271, #272) |
| NH-04a unique minds | #215 (done, PR #254) | Q1 validation harness | #228 (done, PR #235) |
| NH-04b corporate world | #216 (done, PR #255) | DZ-09 autonomous validation gate | #229 (done, PRs #277, #287; fixes #280, #289) |
| NH-05 obligations, endings | #217 (done, PRs #259, #260) | DZ-10 lawful economics | #230 (done, PRs #291, #292) |
| NH-06 Elena follow-up | #218 (done, PR #258) | DZ-11 deliberate departure | #231 (done, PR #294) |
| NH-07 routine activity | #219 (done, PR #241) | DZ-12 cooperative ending | #232 (done, PRs #296, #297) |
| DZ-02 truthful run context | #220 (done, PR #243) | DZ-13 release qualification | #233 (done, PRs #298, #299, #300, #301) |
| DZ-03 Nightly Regression | #221 (done, PRs #250, #252) | | |

## Evidence labels

Every validation record says which of these it is, and never stands in for another:
`SIM` (headless simulation), `AGENT-OBSERVATION` (an agent driving the real UI),
`HUMAN-FEEDBACK` (a real person; optional, never fabricated; see #210) and `DEVICE-TEST`
(physical hardware; #6). Merges need a verified Nexus `pr_review` approval on the full diff
plus green required checks on the merged head.
