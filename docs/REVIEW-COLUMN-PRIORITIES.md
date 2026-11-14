# Column priorities

Issue #89; baseline main `60c05e3`. This bounded pass moves thermal/fan controls
and the interrupt forecast before optional chatter/camera content. Registry UI
priority is stable across ticks and preserves manifest order for other widgets.
The mobile primary scroll and desktop column allocation remain intact.

Node buttons now show WRITE DRIVER once, with their full hardware identity in
the accessible name. The title, blind/revealed description, cost, shortfall and
requirements remain exposed before the button. No dynamic affordability sorting,
engine/content changes, hidden decision information or balance changes are involved.

Fresh careful-bot fixtures cover all six phases at start/mid/end. Visible Chrome
reviewed 36 development views at 390x844 and 1440x900, with zero console warnings,
errors or horizontal document overflow. In the same rendered states, restoring
the former full button caption for a geometry comparison added 22–44px to the
first mobile purchase button in 17 checkpoints. The compact caption avoids that
repetition; no claim is made that all purchases now fit above the fold.

At Phase 1 end on desktop, forecast begins at y=483 and decoded chatter at y=654;
the previous measured order placed chatter at y=512 and forecast at y=706. Those
older measurements preceded the menu foundation, so they are illustrative rather
than a controlled same-build performance comparison. Eleven of seventeen sampled
mobile first-node buttons still extend beyond the initial fold. Further reductions
must preserve necessary blind-node context and readable text.

Two mounted regressions verify the forecast precedes retained chatter and the
compact purchase retains its full accessible identity. Verification results and
limits are recorded on the PR. Screenshots remain outside git. Physical Android,
iOS, screen readers and a full campaign are not requalified by this UI pass.
