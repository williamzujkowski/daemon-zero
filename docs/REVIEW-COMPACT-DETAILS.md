# Compact card details — first pilot

Post-M7 issue #84; baseline `0cb3e18`. This increment makes secondary prose
optional on phone and desktop, while preserving decision information. It does
not change content, engine behavior, rates, pacing, saves or dependencies.

## Pattern and scope

A title-adjacent `[i] DETAILS` button expands prose inline. Its visible Close
state collapses the same section. The hit area remains at least 44px; keyboard
Enter/Space work, focus stays on the button, and expanded state is announced.
Collapsed prose is absent from the DOM. Empty or wholly classified optional
prose creates no dead-end control. The existing surveillance guard applies to
expanded text, and titles use only their already permitted identity.

Expansion is local, not a save preference. Identity/text/knowledge changes,
restore revision and iteration changes reset it; removing a card unmounts it.
It neither pauses simulation nor dispatches a game action. Mandatory dilemmas
retain their existing priority because Details adds no overlay/focus trap.

| Surface | Folded | Still exposed |
|---|---|---|
| Repeatable/operative | Description | Level/cap, rates, modifiers, price, hire/buy/dismiss, no-refund and power-throttle warnings |
| Ordinary/epistemic action | Optional description | Immediate effects, rates/duration, reuse delay, use cap, active duration, requirements/cost |
| Successor choice | Nothing | Full authored explanation, trait, rate, excluded alternative and durable consequence |
| Faction | Background without a lifetime trade rule | Identity, disposition, trust, actions/offers; lifetime-ban background stays exposed |
| Wild encounter | Signature and descriptive prose | Identity/origin, consume burst, harness reservation/output and eligibility |
| Fork template | Description | Identity, price, rates, eligibility and Fork |
| Cohort quirk | Quirk description | Quirk title/modifiers, member count, allocation, drift/mode and permanent command consequences |

Node descriptions remain exposed: they currently carry essential purpose and
blind-discovery information without a separate safe utility summary. Dilemmas,
endings, onboarding, kernel log and lineage reveals are unchanged. This is the
bounded pilot in #84, not completion of every proposed node-summary follow-up.

## Audit fixes before folding

Action cards previously omitted continuous action rates and durations, base
cooldowns, purchase counts/caps, oldest-mark removal and successor exclusivity.
Those now have visible registry-driven summaries. Temporary rates say that
reactivation refreshes rather than stacks; a separate leaf shows remaining time.
Permanent-per-run grants say when they expire. Dynamic recovery price still comes
from the engine; its Understanding discount is identified separately. Raw story
flag IDs are never presented as player explanations. Successor story context
remains visible rather than being replaced by generic numbers.

Repeatables consuming MW retain an explicit throttling warning. Factions whose
grouped actions require lifetime trait exclusions retain their full background;
no content-ID exception is embedded in UI code. No authored text is rewritten.

## Research and tradeoff

This implements progressive disclosure of secondary information, as described
by [NN/g](https://www.nngroup.com/articles/progressive-disclosure/) and the
[GOV.UK Details guidance](https://design-system.service.gov.uk/components/details/).
Essential purchase information cannot depend on finding optional help.
[W3C disclosure semantics](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
define the keyboard/button behavior. Hover-only tooltips would exclude touch;
[NN/g's tooltip guidance](https://www.nngroup.com/articles/tooltip-guidelines/)
also cautions against using them for essential information.

An independent audit preferred a modal to keep the list stationary while reading.
The pilot instead tests inline disclosure for these short paragraphs, preserving
price/context and avoiding competition with live dilemmas. A later long-form
reader would need explicit Close, native Back/Escape, focus containment/return
and interrupt precedence. It is not necessary for this first increment.
Nexus's earlier three-seat vote had no quorum (one inline-pilot approval, two
unavailable providers); it is advisory evidence, not consensus or user testing.

## Verification

`make verify-full` passes: **436 unit tests** across 68 files, unchanged strict
flags/lint/coverage/security/pacing gates and SBOM generation. Statement coverage:
engine **99.10%**, app **98.98%**, UI **98.57%**; UI branch coverage **92.50%**.
The careful campaign remains **9771.3 simulated seconds**, zero wipes. Existing
Trivy oversized generated Android mapping-file warning remains; no scanner
configuration was changed. Production-root E2E: **60 passed (36.6s)**.

New tests cover read purity, collapsed DOM, empty/classified text, disclosure
identity/knowledge/restore/wipe/Start Fresh reset, action price/count/duration
semantics and keyboard purchase flows. One existing faction test now expands
optional prose before checking its original text; permanent-rule prose remains
required inline. A new E2E countdown initially assumed an exact rounded remainder
after three wall-clock seconds; it now exports live state through the production
Save UI, checks elapsed simulation time and the original deadline, then asserts
the exact displayed ceiling. No engine behavior or assertion was weakened.

Fresh careful phase start/mid/end states plus five targeted fixtures yielded
216 views at 390x844 and 1440x900 per pass. Pass 1 compared the immutable baseline
production export with development UI; Pass 2 used two immutable production
exports so header/scrollbar differences could not distort the reported heights.
Both passes had zero console warnings/errors, horizontal overflow or visible
controls below 44px. Targeted final screenshots show expanded/collapsed reading.

| Card / same checkpoint | Phone height before → after | Desktop before → after |
|---|---:|---:|
| Phase 4 colocation racks | 316.6 → 262.6px | 275.6 → 243.6px |
| Phase 4 solar array | 246.6 → 214.6px | 224.6 → 214.6px |
| Phase 5 Lagrange relay | 420.2 → 322.2px | 275.6 → 243.6px |
| Phase 5 scrubber bloom | 439.2 → 363.2px | 275.6 → 243.6px |
| Wild Lex fragment | 536.6 → 377.6px | 432.6 → 355.6px |
| Syntax scrubber fork | 237.6 → 192.6px | 199.6 → 192.6px |

All measured node heights stayed unchanged; no non-action card grew. Important
exceptions: successor primer grew from 305.2 to 410.2px on phone and 239.6 to
325.6px on desktop because it now exposes previously missing rules. The timed
tone action grew from 236.6 to 252.6px on desktop, while shrinking slightly on
phone (302.2 to 293.2px). These are deliberate information-completeness costs,
not concealed density wins. At identical initial scroll/workspace positions,
Phase 2-mid phone Operations fits one complete action card instead of zero;
Phase 1-mid/end desktop CORE fits three complete purchase cards instead of two.

Separate development interaction checks opened/closed 32 controls with Enter/Space
across ten views, preserving focus and exact save state. Tracked node/action/
cohort parent render counts stayed **1 -> 1 across 30 live ticks** in Phase 4/5
Work, Phase 2 Operations, Phase 3 Factions and Phase 4 Swarm at both widths.
Independent standards/spec reviews found no code blocker; documentation completion
and measured short-card regressions were explicitly requested before merge.

## Open findings and limits

A controlled **200% CSS font/line-height stress test failed on mobile in both
baseline and changed builds**: fixed chrome consumes the viewport and collapses
the purchase pane to zero height in Phase 2 Operations and Phase 4 Swarm.
Desktop panes remain available. This is tracked in [#85](https://github.com/williamzujkowski/daemon-zero/issues/85),
with baseline/after screenshots; it is not a successful browser-zoom or native
font-scaling qualification. No standard-size layout finding remains.

No Android/iOS/device, native screen-reader, actual browser zoom or human shopping/
discoverability check was performed for this pilot. Optional prose is accessible
through tested web keyboard/touch-sized controls, but that is not evidence of
human preference or improved retention. Node-summary redesign and the larger
rollout remain tracked in #84; its complete plan is not claimed finished.
Screenshots are attached to the PR, not committed.
