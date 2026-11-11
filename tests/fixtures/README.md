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
