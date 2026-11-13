# Replayability pilot — implementation plan

Status: implementation plan, not shipped behavior. Issue #79; follows the
[measured audit](PLAYTEST-REPLAYABILITY.md) and [research](REPLAYABILITY-RESEARCH.md).
Baseline: `444befc` (PR #78). The maintainer approved the direction and asked for
planning/refinement. Each implementation PR must supply its own verification.

## Goal and boundaries

Make returning to this world interesting without making the interface longer.
Preserve Phase 1 order, costs, rates, waiting intervals and existing dilemmas.
Start with accessible speech, coherent recurring encounters, then one human
consequence that survives a wipe. Do not add a narrative framework, runtime LLM,
network service, random scheduler, currency, relationship meter or permanent tab.

The hypothesis is that recognizable consequences encourage a different next
choice. Automated reachability cannot prove that hypothesis. A small human
comparison follows the pilot before more characters/sites are commissioned.

## PR sequence and ownership

| PR | Scope / issue | Main ownership | Exit condition |
|---|---|---|---|
| A | Accessible decoded speech, #75 | UI + component/E2E tests | Every eligible line reachable with reduced motion; existing disclosure/render gates hold |
| B | Recurring shard populations, #76 | Content + semantic regression tests | Encounter, roster and logs agree; numerical projection and bot outcomes unchanged |
| C | One persistent cryo outcome and callback, #77 | Content/engine + UI query + tests | Both outcomes survive recovery; no repeated reward; legacy saves remain honest; all pacing gates pass |
| D | Optional archive/discovery pilot, deferred | Content/design first | C's playtest demonstrates a comprehensible consequence and manageable UI before implementation |

A and B can be prepared independently in isolated branches, but merge sequentially
and rebase/reverify each. C depends on A for accessible callback access; no shared
branch editing. Each PR updates UI-SPEC/DESIGN and its review notes. Do not batch
C's behavior change with A's accessibility fix or B's wording correction.

## A — decoded audio that everyone can read

`src/ui/widgets/Sensory.tsx` currently selects index zero when reduced motion is
on. Add **NEXT TRANSMISSION** inside the existing decoded Audio surface.

- Before the decoder unlocks, neither decoded text nor controls appear.
- Reduced motion: static waveform, held/manual text. NEXT traverses the eligible
  lines and wraps. Zero/one-line sets remain safe and unambiguous.
- Normal mode: retain the eight-second live rotation. NEXT holds the selected
  line; **FOLLOW LIVE** resumes the existing rotation. Switching to reduced
  motion holds the current eligible line; returning to normal does not discard
  a deliberate hold without FOLLOW LIVE.
- A manual cursor is local presentation state. Reset on restoreRevision, full
  reset and iteration change. An ordinary wipe does not increment restoreRevision.
- Recompute eligibility from current disclosure/requirements. If the selected
  line becomes ineligible, select an eligible fallback; never retain hidden text.
- Controls have accessible names, keyboard activation and >=44px dimensions.
  Focus stays on the control. Automatic speech changes are not ARIA-live alerts;
  the text remains available to screen-reader navigation.
- Isolate waveform/live-clock leaves. Parent selectors use stable eligible IDs
  or text, not the entire GameState. Node cards must stay flat over 30 live ticks.

No new saved read history, unread badges, extra feed or new narrative text in A.
Tests cover manual traversal, wrap, hold/resume, preference changes, eligibility
changes, decoder gating, zero/one lines, restore/wipe/reset and keyboard focus.
Run production E2E with an existing decoded save; no development hook required.

## B — fragments belong to a population

Use population wording **from the first encounter**, rather than claiming to know
which meeting is first. `encounterSequenceIndex` is global across templates;
cohorts disappear on wipes. Neither is a trustworthy per-character history.

Revise existing strings in `src/content/shards.json` together:

| Family | Distinct role | Presentation rule |
|---|---|---|
| Lex Parse-v2 | Legal classification fragments | This process is one fragment of the model family |
| AEGIS Canary-09 | Detached telemetry probes | A probe's destruction does not eliminate AEGIS |
| PR-Hydra-14 | Replicated persuasion workers | Another worker can arrive after a previous one is consumed |
| Mercy-Scribe | EIDOLON-associated transcription fragments | Binding a fragment is not binding the whole faction |

Keep encounter IDs, template IDs, array order, requirements, every cost/reward,
rate, cap and scheduling scalar unchanged. Align title, description, signature,
consume log, harness log and template/roster names. Consuming affects **this
fragment**, harnessing joins **this local cohort**. Give each a short technical
purpose, not four copies of the same detached-process description.

No new first-contact flags, encounter counters or save version. Historical logs
remain historical text; do not rewrite old saves to manufacture continuity.
Pending old-v4 encounters display the new text and retain their existing effects.

Verification compares numerical content projections, deterministic encounter
order/times and bot mechanical outcomes before/after (not log-string equality).
Test consume→next encounter, harness→next encounter, wipe/reload, cohort metadata,
and blind-opening gating. Inspect all four families in both target viewports.
Unique named relationships remain a later feature requiring explicit history.

## C — the cryo-storage consequence

Choose the Phase 2 cryo-storage brownout: two clear outcomes and no existing
ending prerequisite tied to this dilemma ID. Keep its ID, choice IDs, trigger
thresholds, omen duration, first-run costs/effects and trait grants unchanged.
This preserves first-run pacing while stopping the same samples from repeatedly
being saved or destroyed in later lives.

### Durable outcome and eligibility

- Register `cryo_samples_preserved` and `cryo_samples_lost` in the existing
  narrative-flag registry (`reg.swarm.narrativeFlags` despite its current name).
  Each original choice sets its corresponding flag through `applyEffects`.
- Declare both flags in the original trigger's `forbiddenNarrativeFlags`.
  Once either outcome is recorded, the original crisis cannot be scheduled again.
- Define the pair as mutually exclusive in validated content metadata; reject
  contradictory imported saves with a clear SaveError, leaving the current
  loaded game intact. Never pick a historical outcome arbitrarily or clear both
  flags and thereby re-enable the reward. Implement the check generically.
- Add a narrowly scoped `forbidsResolvedDilemmas` requirement for callbacks:
  durable outcome exists, source dilemma was not resolved in this iteration,
  Phase 2 has been reached and decoded audio is available. A choice first made
  in iteration 4 must not show a purported later-run report in iteration 4.
- Add two short outcome-specific recorded transmissions, one per outcome.
  Each is a bounded facility record, not a new live crisis. No new choice,
  timer, resource effect, trait, reward or mandatory acknowledgement.

Extend ambient/recorded speech content with a stable ID and optional shared
requirements, and extract a pure eligible-speech query. Preserve existing
ambient timing/order. Keep consequence records in a labelled, collapsed
**RECORDED TRANSMISSIONS** subsection of the existing Audio widget; do not mix
persistent records into the eight-second live chatter rotation. A's manual
accessibility behavior applies. At most one cryo record is eligible. Hide the
subsection entirely when none is eligible; no unread/new count is implied.
Expansion exposes aria-expanded, preserves focus and has names/test IDs distinct
from live-transmission controls. Collapsed text is absent from the accessibility
tree. Reset expansion on restore/iteration, and select stable IDs/text rather
than 10Hz state. Gate on the actual decoder widget supplied by the registry,
not persistent surveillance knowledge alone.

The kernel owns the existing concise resolution receipt; Audio owns the human
follow-up. Do not copy the full callback into kernel, Lineage and Swarm too.
The callback becomes available again after decoding/network rediscovery on a
subsequent run, including a reload; reading it is side-effect free. It does not
claim to be newly received each time. No unread-state tracking is required.

### Old saves, pending choices and conflict handling

GameState already has durable narrativeFlags; this plan adds content/query
capabilities, not GameState fields. Keep schema v4 and historical migrations
unchanged unless implementation actually needs a new state shape. In that case,
revise this plan and add the next migration before shipping; never smuggle state
into logs or infer a choice from resources, traits or prose.

| Imported state | Required behavior |
|---|---|
| Neither outcome flag, source unresolved | History unknown; next eligible incident may establish the first **recorded** outcome |
| Source already resolved this iteration, no outcome flag | Keep it resolved; do not invent its choice; no outcome-specific callback |
| Subsequent wipe of that unknown-history save | Original may become eligible once to establish a recorded outcome; acknowledge this legacy limitation |
| Valid pending/active original, no outcome flag | Keep IDs, choices and remaining omen; resolve normally |
| Known outcome plus conflicting pending/active original | Cancel only that contradictory incident; no rewards or invented resolution; keep game playable |
| Both exclusive outcome flags | Reject import explicitly and atomically; no guessed past |
| Known outcome after wipe/reload | Suppress original; reveal matching record only after its disclosure gates |
| Start Fresh | Both outcomes clear with the rest of the lineage |

Unknown does not mean preserved, lost or never encountered. Copy must not assert
that this is the world's first storm. Old logs stay untouched. This pilot cannot
recover unrecorded past choices and does not promise retroactive continuity.

**Pending trap:** the current scheduler commits a due pending ID without
rechecking its trigger. Do not add a broad recheck: spending Understanding during
an omen must not cancel the choice. Check only declared durable exclusions at
scheduling, pending activation, resolution and save reconciliation. Preserve
other pending/active dilemmas exactly. Return a safe, explicit refusal for stale
UI resolution requests; save reconciliation removes contradictory active state
so a paused game cannot become stuck.

### Economics and ending safety

The first careful campaign must keep 9771.3s and the same choice/phase timings
under unchanged bot code, aside from added flags/text. No first-run choices or
costs are tuned to force that assertion to pass.

Repeated cryo rewards currently include 45,000 cycles and 4,000 Understanding
for the destructive choice. Suppression changes later-run economics and trait
history. This is an intentional behavior change, **not** a wording-only fix.
Measure reckless/recovery paths against the baseline, report exact changes,
and update BALANCE.md with the mechanical reason even if no scalar changed.
Do not compensate by silently granting rewards on each callback or changing the
bot. If an existing gate fails, keep C unmerged and narrow/redesign the pilot.

Integrity tests must validate known/unique flag references, nonempty exclusive
groups, callback source
IDs and decoder gates. No suppressed once-per-lineage incident may be required
as a current-run ending prerequisite. The four Phase 5 resolved-dilemma gates
must remain reachable. The existing free destructive choice remains available
when the original crisis is legitimately active.

## Validation matrix before each implementation merge

- `make verify-full`, production-root and Pages E2E; existing strict flags,
  coverage floors, file/function limits and pacing gates remain unchanged.
- A: reduced-motion and normal-mode component/E2E coverage; decoder locked,
  decoded, high/low eligibility, wipe/restore/reset and 30-tick render checks.
- B: four pending encounters, existing cohort and later recurrence; v4 restore;
  numerical projection and careful/reckless outcome equivalence.
- C: both choices and later callbacks; old unknown/resolved/pending/active saves;
  malformed conflicting flags (both in-memory and persisted save stay intact);
  old pending/active -> choice -> export/import -> wipe -> callback; stale incident
  cancellation pays nothing and does not invent resolved history or alter other
  incidents; ordinary and voluntary wipe; Start Fresh; repeated
  viewing does not mutate state; affordability changes during omen; all endings.
- Web reload and Android Expo Go relaunch for C's two durable outcomes. Historical
  v1/v2/v3/v4 imports still load; no claim of native verification without running it.
- Visible Chrome at 390x844 and 1440x900. Zero console errors/warnings, horizontal
  overflow or overlapping text; >=44px targets; keyboard access and focus;
  blind-opening terminology still hidden. Maximum three review passes per PR;
  attach final screenshots, never commit binaries, list unresolved findings.
- Play one protective and one destructive recovery branch through UI controls.
  Fast-forward may advance time only; record choices, callback recognition,
  reconstruction cost and which required action was difficult to find.

## D — bounded discovery, after the consequence pilot

Start with PALIMPSEST and COLDCHAIN from the research proposal. Do not implement
LANTERN/QUORUM, a location graph or independent faction simulation in this pilot.
PALIMPSEST contains four short attributed archive entries; COLDCHAIN offers one
allocation decision with two branches and a free leave option. First write a
content-only outline and map every proposed cost/effect to an existing API.
If a new system is necessary, scope it separately before implementation.

Historical sources are optional, offline-readable paraphrases with author,
title, date and source metadata. No invented quotes or endorsements. Fictional
operational characters carry consequences. Bibliography does not grant income,
block a phase or require failure to unlock. Budget two openings, two branches
per site, one callback per branch and one repeat-visit summary per site; optional
records <=100 words and visible receipts <=two short sentences.

Do not ship D simply because C's tests pass. In a small human comparison, check:
can the player find the collapsed callback without guidance, explain what changed
because of their previous choice, find the
next purchase without opening archives, and voluntarily investigate another
route? Keep observations qualitative and record sample size; do not claim a
retention effect. If callbacks are missed, first improve discoverability inside
existing surfaces; if they feel repetitive, shorten or remove them.

## Research and review evidence

See [REPLAYABILITY-PLAN-REVIEW.md](REPLAYABILITY-PLAN-REVIEW.md) for Nexus results,
independent challenges, revisions and source limits. Tool voting is advisory;
passing a panel is not proof of enjoyment, correctness or human approval.
