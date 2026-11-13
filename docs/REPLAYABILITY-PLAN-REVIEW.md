# Replayability plan — research and challenge record

Date: 2026-11-13. Issue #79. Reviewed baseline `444befc` and the subsequent
[implementation plan](REPLAYABILITY-PLAN.md). This is planning evidence;
implementation, native checks and human enjoyment remain unverified.

## Nexus research

`research_discover` queried arXiv, GitHub, Semantic Scholar, Papers with Code and
OpenAlex for interactive narrative/storylets/persistent consequences. It returned
five candidate references; Semantic Scholar was reported failed. Discovery
snippets are leads, not validated findings. No registry additions were necessary.

The root reviewer opened the primary abstract of
[Sun et al., Drama Llama (2025)](https://arxiv.org/abs/2501.09099): it describes
an LLM/storylet framework and a preliminary authoring study with six authors.
This supports interest in bounded authorable responsiveness, not a claim about
retention or this game's players. We did not review the full paper or adopt its
runtime generation approach. Offline deterministic authored content remains the
chosen architecture.

The [official ink overview](https://www.inklestudios.com/ink/) describes an
established narrative language and authoring/testing tools. It demonstrates an
available alternative, not a need to install it: the pilot fits existing JSON,
requirements and transaction infrastructure. No ink dependency is proposed.
The historical archive and developer-postmortem sources remain documented with
their inspection limits in [REPLAYABILITY-RESEARCH.md](REPLAYABILITY-RESEARCH.md).

## Nexus planning and vote: incomplete availability

- `orchestrate`, job `orch-mwf2z0b5-3nyj5q`, returned `executed: false`, zero
  steps and no experts. Its generic routing classification is not a design review.
- A created architecture expert was executed with no retry; the provider returned
  HTTP 429 / individual quota exhaustion. No expert analysis was produced.
- `consensus_vote`, job `job-vote-adf49234-56ea-40cf-a27c-f458a9fbc7fd`, used live,
  non-simulated voting, quick panel, unanimous strategy and fail-closed policy.
  Record: `vote-1794580831637-nxaoqof`.
- **Result: no_quorum.** One security approval, zero rejections, two errored seats.
  Architect: quota exhausted. Scope steward: provider circuit breaker open.
  The tool's 100% responding approval statistic is **not** three-person agreement.
- The answering security reviewer inspected repository files and found no concrete
  security blocker to the planning proposal. It requested explicit flag lifetime,
  legacy-save, pending-choice and ending-reachability contracts. It did not run
  tests or assess enjoyment. Serving-model identity was not independently reported;
  the response attributed the answering seat operationally to gpt-6.1-sol.

No fallback simulation, weakened quorum, provider reconfiguration or repeated
quota retries were used. Nexus consensus remains unavailable. Separate local
agents challenged engine/save contracts and presentation/content boundaries;
these are useful reviews, not a replacement multi-model consensus claim.

## Iteration record

| Initial idea | Challenge | Refined decision |
|---|---|---|
| Named first encounter, then recurring fragments | Global sequence index is not per-character history; old saves cannot prove a first meeting | All arrivals are explicitly fragments of named families; defer unique relationships |
| More audio variety | Reduced motion currently suppresses existing variety entirely | Fix manual access first; no new chatter text in PR A |
| One lasting human incident | Repeated incident also grants repeat resources/traits | Cryo pilot is a behavioral PR; measure recovery changes and preserve all gates |
| Show callback on iteration >=2 | First recorded choice might occur in iteration 4 | Gate on durable flag plus source not resolved in the current iteration |
| Recover earlier choices from saves | Resolved IDs contain no selected choice; traits/logs are not reliable provenance | Keep missing outcomes unknown; document first newly recorded outcome boundary |
| Revalidate pending trigger | A player may legitimately spend Understanding during the omen | Check narrow durable exclusion only; preserve the committed choice otherwise |
| Heal contradictory outcome flags | Picking one fabricates history; clearing both can enable repeated rewards | Content declares exclusivity; import rejects contradiction atomically |
| Put human follow-ups everywhere | Duplicated logs already crowded the interface | One collapsed recorded-transmission subsection in existing Audio; kernel keeps receipt |
| Add four sites and more AI immediately | Authoring/migration/testing cost grows faster than visible content | Defer sites until consequence pilot; start with two, then compare human observations |

The second local review found no blocking contradictions after these revisions.
It added hidden-empty recorded sections, actual decoder gating after wipes,
accessible expansion and stable selectors; discovery without guidance is now an
explicit human observation. Save tests now require atomic rejection to preserve
both memory and persisted data, plus pending-choice roundtrips through a wipe.
These were document/code inspections, not tests of an implemented feature.

## Remaining implementation responsibilities

The plan fixes intended behavior, not final narrative prose or code layout.
Implementers must extract small modules to preserve the existing file/function
limits, validate every new content reference, and prove save/reload behavior.
The cryo callback is optional information, never an income source or ending key.
Unknown historical choices cannot be recovered retroactively. Removing repeat
rewards may change reckless pacing; a failing gate blocks that PR rather than
justifying bot tuning or a weaker assertion.

The human evaluation gate is qualitative: can a returning player explain the
consequence and find the next action without navigating an archive? Record the
number of participants and observations. Neither this review nor a model vote
establishes replay enjoyment, accessibility qualification or improved retention.
