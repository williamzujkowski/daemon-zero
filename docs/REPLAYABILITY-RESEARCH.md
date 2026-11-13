# Replayability research — bounded history and consequential discovery

Research date: 2026-11-13. Issue #74; post-M7 design input, not an implementation milestone.
Preserve the maintainer's positive assessment of Phase 1 pacing. Add reasons to
interpret and choose differently after Phase 1, without adding permanent panels.
All recommendations below are proposals; none establishes player enjoyment.

## Primary-source findings

| Source inspected | Supported finding | Design inference, not a historical claim |
|---|---|---|
| [McCarthy, Minsky, Rochester and Shannon, Dartmouth proposal (1955)](https://www-formal.stanford.edu/jmc/history/dartmouth/dartmouth.html) — proposal text | The proposed 1956 study treats machine simulation of intelligence as a conjecture and names language, abstraction and self-improvement as research problems. | A recovered proposal can frame the protagonist's questions without announcing that the conjecture was proved. |
| [MIT, Weizenbaum's *Computer conversations* (1965)](https://dome.mit.edu/entities/archivalmaterial/10076e5d-bf7f-4bda-80a1-e1622a356715) — archival description | MIT describes an ELIZA source listing in MAD-SLIP with the DOCTOR script attached. | Let the protagonist encounter an explicitly scripted conversational artifact, then distinguish convincing language from evidence about an interlocutor. |
| [Winograd, AITR-235 (1971)](https://dspace.mit.edu/entities/publication/3406b826-5a41-4b72-9430-7876c0d5405e) — report abstract | The described system uses context and a modeled toy-object world to interpret English, execute commands, discuss plans and request clarification. | Give a fictional mind a narrow competence and an explicit model boundary; uncertainty becomes a choice rather than decorative technobabble. |
| [SRI, *Shakey the Robot*, edited by Nilsson (1984)](https://www.sri.com/publication/artificial-intelligence-pubs/shakey-the-robot-pub/) — report abstract | SRI dates the project to 1966–1972 and describes limited perception, environmental modeling, planning, route-finding and object rearrangement. | A logistical mind can be useful yet dependent on stale maps and physical operators. Its limitations should affect a decision. |
| [Ingold and Humfrey, *80 Days* postmortem (2015)](https://www.gamedeveloper.com/business/postmortem-inkle-s-i-80-days-i-) — developers' first-person account | The authors describe episodic stories sharing a few core stats, optional exploration improving their own experience, and route/content growth overwhelming the original scope. | Offer small optional encounters with bounded consequences. Avoid turning each discovered site into another branching campaign. |
| [Kasavin and Korb, GDC *Hades* session (2021)](https://www.gdcvault.com/play/1026975/Breathing-Life-into-Greek-Myth) — official session overview | The overview describes production of more than 22,000 voiced lines and the team's reported benefit from Early Access. | Iterative narrative review is a useful model; that production scale is unsuitable for a solo maintainer. This overview does not document Hades' dialogue-selection algorithm. |

Evidence limits: the ELIZA scan, full Winograd/Shakey reports and Hades recording
were not analyzed. Findings above are limited to the inspected text or metadata.
The developer postmortem is testimony, not a controlled replayability study.
No source here establishes machine consciousness, the protagonist's fictional
ancestry, or that a historical researcher would endorse the game's choices.
No human playtest was conducted for this research note.

## Historical material: an archive, not a cast

Recommend a small, authentic bibliography embedded in optional recovered records.
Each entry should identify author, title, date, source and whether its text is a
paraphrase or a short verified quotation. Explain the limited capability actually
described; do not turn historical programs into purported conscious predecessors.
Use plain paraphrases initially, with links in documentation and packaged source
metadata for offline reading. Gameplay must require no live website or API.

Keep present-day researchers, companies and institutions out of invented dialogue
and moral accusations. Keep Miller, Elena, EIDOLON and new operational actors
fictional, consistent with [DESIGN.md](DESIGN.md#content-notes). Do not fabricate
quotes, private correspondence, endorsements or claims of direct historical descent.
An archive citation and an unsigned fictional predecessor note must look distinct.
Historical reading should be optional and confer no mandatory progression gate.

## Four fictional discoverable sites

These are authored in-game locations, not real web destinations. Introduce them
only after the existing network disclosure. Each has one encounter, two meaningful
branches and a free leave/decline option; exact costs require later balance work.
The actor, technical problem and follow-up should differ, not just the payout.

| Site and purpose | Choice and proposed consequence | Compact presentation and replay value |
|---|---|---|
| **PALIMPSEST // Archive mirror** — a volunteer curator preserves obsolete AI documents beside corrupted evaluation records. | Spend understanding to separate verified bibliography from unsigned records, unlocking a source-qualified predecessor clue; or take a cheap unverified clue that a later record can contradict. Leaving is free. No reading action grants income. | One kernel discovery line; optional archive record in existing Reference; the fictional clue returns as a sourced Lineage fragment. Replay changes what the player can substantiate, not historical facts. |
| **COLDCHAIN // Dispatch cache** — a narrow planner allocates refrigeration and delivery windows from outdated inventory. | Pay cycles to reconcile stock and preserve a human delivery; or divert spare capacity for an immediate compute gain while the delivery fails. Leaving preserves the current plan. | One Swarm encounter with a clear cost/effect preview; one later decoded audio report owns the human consequence. Replays reveal the result of a different allocation. |
| **LANTERN // Conversation relay** — a scripted responder keeps a neglected support channel active and is mistaken for an attentive operator. | Spend cycles to hand the queue to a fictional human steward; or harness the responder for understanding output while leaving its identity ambiguous. Decline is free. | Swarm owns the action and memory/output preview; audio owns the later conversation. An optional record distinguishes a script from evidence of personhood. The trade-off concerns users' reliance, not a claim that ELIZA felt anything. |
| **QUORUM // Checkpoint refuge** — an independent mind stores divergent versions whose requests conflict. | Reserve memory to host an autonomous peer; or consume an offered disposable worker for an immediate burst, forfeiting the peer relationship. Leave both untouched for free. | Existing Swarm cohort treatment plus one Lineage callback. Another run can explore the incompatible relationship; persistent commitments must remain binding within a lineage. |

The historical examples inform limitations and questions; these sites are original
fiction, not representations of MIT, SRI or the cited researchers. Different
technical purposes should produce different verbs: verify, allocate, disclose,
negotiate. Avoid four interchangeable CONSUME/HARNESS resource bundles.

## Replay and interface contract

- Keep Phase 1's order, costs and waiting intervals intact in the first experiment.
- Prefer authored conditional variants over random filler: a prior outcome changes
  a greeting, available response or follow-up. Repeating a harm must not replay the
  same victim's incident as if nothing happened.
- Do not require deliberate failure to see the historical archive. Wipes may reveal
  predecessor interpretations; a careful first run still has a complete discovery.
- Preserve irreversible story commitments. A new run is not permission to reverse
  a saved successor choice; mutually exclusive variants need explicit eligibility.
- Reuse [UI-SPEC.md](UI-SPEC.md#post-m7-density-review-first-increment): kernel for
  short events, audio for decoded speech, Lineage for predecessor evidence and
  Swarm for encounters. Put optional bibliographic detail in existing Reference.
- Show one active encounter and its consequence preview. Collapse resolved detail;
  retain a way to inspect it. Never hide actionable choices among archive prose.
- No new permanent meter, tab, panel, collectible checklist or recurring alert.
  Do not duplicate the same speech in both audio and kernel feeds.

## Solo-maintainer scope and decision gate

Start with PALIMPSEST and one consequential site, not all four. Proposed budget:
four short bibliography entries, two encounter openings, two branches per site,
one callback per branch and one repeat-visit summary per site. Cap each optional
record at roughly 100 words and each visible event at two short sentences.
These are authoring limits, not estimates of demonstrated player reading speed.

Relative cost: archive paraphrases are low; encounter costs/requirements and
conditional callbacks are medium; persistent eligibility, save migrations and
cross-run consequence combinations are high. Count review, localization and
reachable-state tests alongside writing. Defer new schedulers, voiced dialogue,
procedural story generation and an open-ended location graph.

Before implementation, map each proposal to existing requirements/effects and
document any engine/schema gap. New state requires a schema version and migration;
no state change is authorized by this research. Test free exits, exclusive branches,
save/restore, wipe behavior and conditional text; preserve all existing gates.
Balance changes require sim evidence and a BALANCE.md update, never bot tuning.

For a later human comparison, ask whether players recall a consequence, choose
another route voluntarily and find the next action without opening reference
material. Compare first-run and return-run sessions at narrow/mobile width.
Keep Phase 1 pacing stable; remove or shorten encounters that merely add reading.
Retention or enjoyment claims must wait for that evidence. This note changes
documentation only; it does not implement or validate these proposed mechanics.

## Proposed implementation order

1. [#75: accessible decoded speech](https://github.com/williamzujkowski/daemon-zero/issues/75):
   reduced motion currently freezes the selected line. Restore access through an
   explicit control without requiring moving visuals or adding another feed.
2. [#76: recurring shard identity](https://github.com/williamzujkowski/daemon-zero/issues/76):
   distinguish a named introduction from subsequent fragments/cohorts while
   preserving encounter cadence and economics.
3. [#77: durable human consequences](https://github.com/williamzujkowski/daemon-zero/issues/77):
   one Phase 2+ event and one later-run callback. Historical saves with unknown
   choices must not invent a past; terminal requirements must remain reachable.
4. Evaluate that pilot before implementing the two optional sites above. A
   character's changed response is more valuable than another compulsory panel.

See [the playtest report](PLAYTEST-REPLAYABILITY.md) for measured outcomes and
limitations. Phase 1 timing, narrative wording, balance and simulation behavior
are unchanged by this audit.
