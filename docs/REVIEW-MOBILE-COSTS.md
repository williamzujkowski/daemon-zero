# Lossless mobile costs

Issue #89; baseline `bbe26df`. Mobile node purchase costs and shared missing-amount
rows abbreviate values only when the printed decimal times its multiplier equals
the original number exactly and the result is shorter. 15000000 becomes 15M;
15000001 and 16384 remain fully written. No approximate price, rounded missing
amount or extra disclosure control is introduced. Memory retains the MB unit.
Desktop retains full digits. Accessible names contain full values and preserve
the remembered-price qualification. Engine affordability uses unchanged values.

CostHint serves nodes, repeatables and action/faction controls. Its selector still
uses the existing ceiling of each missing amount; shallow equality isolates the
leaf from card rendering. Other purchase cost displays retain their existing
formatting. Global resource rounding is unchanged by this price-specific helper.

Fresh careful-bot snapshots cover all six phases at start/mid/end. Visible Chrome
reviewed 36 development views at 390x844 and 1440x900. Replacing compact cost and
missing labels with their exact full strings in the same rendered state moved the
first mobile purchase button down by 19px at Phase 3 start, Phase 4 end, Phase 5
midpoint and Phase 5 end. Other sampled checkpoints did not lose a line. This is
a bounded readability improvement, not a claim that all cards fit above the fold.
Necessary descriptions, prices, requirements and purchasing semantics remain.

Verification and limits will be recorded on the PR. Physical Android, iOS,
screen-reader speech and a full campaign are not requalified by this increment.

Final verification: `make verify-full` passes with 476 unit tests; production E2E
passes 76 cases (50.5s). All strict/lint/coverage/security/pacing gates and SBOM
remain intact. Nine visible production views cover Phase 1, Phase 4 and Phase 5
at 390x844, 1440x900 and 320x844 with doubled text in the narrow cases. Reviewed
views have zero console warnings/errors, document overflow or purchase targets
below 44px. Phase 4/5 node/action/cohort counters remain 1 -> 1 over 30 live ticks.
Screenshots are attached to the PR, not committed. The inherited oversized
ignored generated Android mapping-file scanner warning remains.
