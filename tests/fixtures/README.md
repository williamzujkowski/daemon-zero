# Historical save compatibility input

`pre-second-pass-v1.json` was newly generated after PR #37, using the public
factory, STEALTH bot actions, 180 seconds of fixed engine ticks and serialize
from historical commit `a11c35f` (the pre-#37 M4 main). Historical source was
extracted with git archive outside the repository; no old review code/save
artifact was reused and no engine/content source was copied into this commit.

It is a genuine version 1 codec output with five Phase 1 nodes. SHA256:
`09dd2453f2b8bf4b8b1d277b5f228ca0a2c53ae25368efbabdb73726e72655ac`.
The cold-hydration test passes it through the normal app storage envelope, proves
migration preserves hardware and adds the version 2 fields, and checks that the
app checkpoints version 2 without replaying a guest escape. Web/Android manual
checks use the same newly generated input. It is test data, not a screenshot or
pacing fixture. Issue #39 records the existing migration's missing audit-widget
unlock for already-playing version 1 saves.

M7 compatibility inputs:
- `pre-lineage-v2.json`: historical codec output from `aa290f8`, generated for
  the lineage review (798.3 simulated seconds, twelve nodes). See REVIEW-LINEAGE.
- `pre-m7-v3.json`: the engine-generated victory-ready fixture from the PR #49
  baseline at `866d280`; schema and engine were unchanged in `89adc63`.

M7 tests migrate all three inputs to v4 and round-trip the resulting saves.

Content channel input (#204):
- `pre-channel-v4.json`: genuine version 4 codec output from `e89285c` (main before
  the v5 content-channel marker), made with the public factory, the STEALTH bot and
  fixed engine ticks for 3600 simulated seconds, then `serialize`. It is in phase 3
  with 22 nodes, six resolved dilemmas, a narrative flag, two shard cohorts and
  action counts, so the v4 fields are populated rather than defaulted. SHA256:
  `c00873b740abd43760158b26f1918f9b6bc5cb911bc6f45fd1069cf91e4aa8e0`.

`tests/save-channel.spec.ts` and `tests/swarm-save.spec.ts` load all four inputs
as v5 `production` saves, and preview adopts each of them as a `preview` save.
