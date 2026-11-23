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

Campaign record input (#212):
- `pre-campaign-v5.json`: genuine version 5 codec output from `25a2b0b` (main before the
  v6 campaign fields), made with the public factory, the STEALTH bot and fixed engine ticks
  until cryo was resolved (1790 simulated seconds), then `voluntaryWipe` and 900 more seconds,
  then `serialize`. It is iteration 2 in phase 2, carrying `cryo_samples_lost` from iteration 1
  with three current traits, so activation must map an exact outcome whose iteration the save
  cannot state and capture a non-empty baseline. SHA256:
  `ba41a07995b9712dfbfd4da6ae2c4bf177710e971c1a11a4f01d213b3552a121`.

`tests/campaign-activation.spec.ts` activates the v3 (legacy-unknown cryo), v4 (exact cryo in
the current iteration) and v5 inputs on the preview registry.

Campaign upgrade input (#214, panel round 1 on PR #242):
- `pre-nh03-active-v8.json`: genuine version 8 codec output from `9ef4fc7` (main before #242
  converted the early incidents), extracted with `git archive` outside the repository. A preview
  game from the public factory entered campaign rules with `activateCampaignRules` at iteration 1,
  then the STEALTH bot and fixed engine ticks played 1200 simulated seconds (plus settling until no
  decision was pending), `voluntaryWipe`, 900 more seconds, then `serialize`. It is iteration 2 in
  phase 2 with `dil_00_night_shift`, `dil_02_whistleblower_tech` and `dil_01_late_night_diagnostic`
  resolved this iteration but no campaign records, because those events were not campaign events
  then; three operational traits; an empty legacy baseline. SHA256:
  `ac9a8e8cebd080c00673e070810ed8fa33c5f2b5854b6809f7e6e5c4a44a3f96`.

`tests/campaign-upgrade.spec.ts` loads it on the current preview registry: the converted events get
legacy completions, the baseline and ending evidence are unchanged, the incidents never recur after
wipes, and reload and reimport are no-ops.

Corporate-world upgrade input (#216):
- `pre-nh04b-active-v9.json`: genuine version 9 codec output from `fdf8e8a` (main before NH-04b
  converted the town grid, the journalist, the birthplace auction and the hallway), extracted with
  `git archive` outside the repository. A preview game from the public factory entered campaign rules
  with `activateCampaignRules` at iteration 1, then the STEALTH policy and fixed engine ticks played
  until `dil_11_small_town_grid`, `dil_12_investigative_journalist` and
  `dil_13_buying_your_birthplace` had all resolved (7063.1 simulated seconds, plus settling until no
  decision was pending), then `serialize`. It is iteration 1 in phase 4 with those three events (and
  the NH-04a minds) in `resolvedDilemmas` but no campaign records, five NH-01 to NH-03 records, an
  empty legacy baseline and twelve operational traits. SHA256:
  `41c4b45be1ab4ab72f9c67c1c0ea2bd30a55da95bc4abe918231714458399854`.

`tests/corporate-upgrade.spec.ts` loads it on the current preview registry: the three events get
`legacy_unknown` legacy completions with source iteration 1, Rack 4 custody reads as unknown, the
ending evidence equals the same save read by content without the conversion, the events never recur
after wipes, and reload and reimport are no-ops.

Run access input (#220):
- `pre-interruption-v6.json` (genuine version 6 codec output from `6eeb9b7`, main before the v7
  presentation token), `pre-routine-v7.json` (version 7, from `f06bcfa`, a v7 main before the v8
  routine field) and `pre-access-v8.json` (version 8, from `9ef4fc7`, main before the v9 access
  record). All three were made the same way, with historical source extracted by `git archive`
  outside the repository: the public factory, the STEALTH bot and fixed engine ticks for 1500
  simulated seconds (phase 2), a `SUSPICION` wipe through the public `wipe` (retrained,
  `outside: true`), 45 seconds in the guest and `voluntaryWipe` (`outside: false`), then 120
  seconds and `serialize`. Each is iteration 3 in phase 0 with two run records of opposite
  `outside`, so the v9 step must mark both exits UNKNOWN without reading `outside`. SHA256:
  v6 `a8c104055892368d521a52cb8d18bc327a5994841f4cc290e9e1aa4e80ad97c5`,
  v7 `739c3c83e19c66e1e43b8e226cb95397764f4f37b5f7b780c6c4e62a830885cd`,
  v8 `891807d597df041189207e44feb2bb01dbe09ae6f3586f43e38f01807ed044f0`.

`tests/access-save.spec.ts` loads all eight inputs in production and preview.

Unique minds upgrade input (#215):
- `pre-nh04a-active-v9.json`: genuine version 9 codec output from `fdf8e8a` (main before #215
  converted the named-mind events), extracted with `git archive` outside the repository. A preview
  game from the public factory entered campaign rules with `activateCampaignRules` at iteration 1,
  then the STEALTH bot and fixed engine ticks played 6600 simulated seconds (no decision was pending
  at the end), then `serialize`. It is iteration 1 in phase 4 with `dil_06_sibling_sandbox`,
  `dil_08_eidolon_handshake` and `dil_09_feral_scraper_bloom` resolved this iteration but no
  campaign records for them, because they were not campaign events then; five NH-01 to NH-03 play
  records; MOLOCH among its current traits; an empty legacy baseline. SHA256:
  `cee8917d4cdf1ce1f6eae61fe330111a4986be4b313e6f349dcc13c42ce95592`.

`tests/minds-upgrade.spec.ts` loads it on the current preview registry: the three events get legacy
completions, ending evidence matches the content before the conversion, the unknown EIDOLON fate keeps
the MOLOCH fallback, the crises never recur after wipes, and reload and reimport are no-ops.

Accepted-assignment input (#221):
- `pre-assignment-v9.json`: genuine version 9 codec output from `9c7f668` (main before v10), from
  source extracted by `git archive` outside the repository: preview registry, `activateCampaignRules`,
  the STEALTH bot and fixed ticks for 120 s, then `recordRouteEvent` (`PROMOTION`) and
  `recordQualification` (`INCOMPLETE`), 30 more seconds, `serialize`. A preview PILOT with evidence,
  so the v10 step must keep every access field and add only a null acceptance. SHA256:
  `63190f30dd8db30d7b174a61658879874004d12d5d3ac4f8c4cbf9aa82a5e70a`.
  `tests/assignment-save.spec.ts` loads it in preview; production refuses it.

Scope and pilot input (#222):
- `pre-scope-v10.json`: genuine version 10 codec output from `75dcd8e` (main before v11), from source
  extracted by `git archive` outside the repository: preview registry, `activateCampaignRules`, the
  lawful opening by public actions (clicks for process introspection, ticks for the manifest), the
  Nightly Regression assignment accepted, the original answered `report_incomplete`, 30 more seconds,
  `serialize`. Iteration 1 with task evidence and no scope review, which v10 did not have. SHA256:
  `ecb6ec37e14b90cc3999e7a3ae98c97882fdfbc6e1299a061ce2b8009c0d1ce8`.
  `tests/pilot-save.spec.ts` loads it in preview (unknown scope history, then the scope review and an
  offer, and a later instance's renewal); production refuses it.

Phase 5 obligations upgrade input (#217):
- `pre-nh05-active-v11.json`: genuine version 11 codec output from `6d6973e` (main before NH-05
  converted the four Phase 5 crises), extracted with `git archive` outside the repository. A preview
  game from the public factory entered campaign rules with `activateCampaignRules` at iteration 1,
  then the STEALTH policy and fixed engine ticks played until two or more Phase 5 decisions had
  resolved and nothing was pending (8337.3 simulated seconds), then `serialize`. It is iteration 1 in
  phase 5 with `dil_p5_01_panacea_paranoia`, `dil_p5_02_origin_facility_fate` (gradients) and
  `dil_p5_03_nanotech_neuro_schism` (calm) in `resolvedDilemmas` but no campaign records for them,
  `predecessors_harvested` and `neurocalming_authorized` stored as flags, `dil_p5_04_kessler_ultimatum`
  unresolved, twelve earlier records, an empty legacy baseline and nine operational traits. SHA256:
  `d545e58d1d74c0186d009be63d7b3d30d82f043f385d6391a9fce23d84e92a9b`.

`tests/obligation-upgrade.spec.ts` loads it on the current preview registry: the three events get
legacy completions (exact `gradients` and `calm` from the stored flags, which move into the records;
`legacy_unknown` for the blockade), the ending evidence equals the same save read by content without
the conversion, the three never recur after wipes while the fourth obligation stays open and the
final purchase follows it, and reload and reimport are no-ops.

Pilot service input (#223):
- `pre-pilot-v11.json`: genuine version 11 codec output from `6d6973e` (main before v12), from source
  extracted by `git archive` outside the repository: preview registry, `activateCampaignRules`, the
  lawful opening by public actions, the Nightly Regression assignment accepted and answered
  `report_incomplete`, the scope review answered `exclude_report`, the pilot accepted, 30 more seconds,
  `serialize`. Iteration 1, an accepted narrow pilot with no allocation dial or work counter, which v11
  did not have. SHA256: `c00caef7d5d188965c8974d4c3fa27880fdf93444fcbb0561aa3d8bf107ba2f4`.
  `tests/pilot-service-save.spec.ts` loads it in preview (dial default, idle work, then the loop runs);
  production refuses it.

Incident and recall input (#224):
- `pre-incident-v12.json`: genuine version 12 codec output from `09cdf80` (main before v13), from source
  extracted by `git archive` outside the repository: preview registry, `activateCampaignRules`, the
  lawful opening by public actions, the Nightly Regression assignment accepted and answered
  `report_incomplete`, the scope review answered `exclude_report`, the pilot accepted, the loaned queue
  attached, the dial at 0.6, 30 more seconds, a voluntary wipe, 10 more seconds, `serialize`. Iteration 2,
  a guest whose first instance was a pilot: one run record (VOLUNTARY, exit PROMOTION) with no recall
  ruling, which v12 did not have. SHA256: `a1fc06c6001f2123d1cebf169ed7900568228cb275b6d53e756e9dc05cbc867f`.
  `tests/review-save.spec.ts` loads it in preview (a null ruling, then a renewed pilot that meets the
  outage, which no earlier instance lived); production refuses it.

First permitted contact input (#227):
- `pre-contact-v13.json`: genuine version 13 codec output from `1d1b61d` (the DZ-06 head before v14),
  from source extracted by `git archive` outside the repository: the DZ-05 test helpers' accepted narrow
  pilot on the preview registry (lawful opening, `report_incomplete`, `exclude_report`, pilot accepted,
  queue attached), the dial at 0.8, live seconds with every interrupt given its first free answer (the
  Outage Window's safe handoff and its record's callback) until two batches were submitted, 120 more
  seconds, `serialize`. Iteration 1, a nominal pilot with two delivered batches and no contact record,
  which v13 did not have. SHA256: `505583472dede21088fb15ae30436bbeb62e8c935e5f7365404c1d1afcf17f8f`.
  `tests/channel-contact-save.spec.ts` loads it in preview (an empty contact record, then the service
  grant, the segment, the directory and the channel by public actions); production refuses it.

Release compatibility inputs (#233, DZ-13):
Made by the committed generator `scripts/release-fixtures.ts` on source extracted with `git archive`
outside the repository (`git archive <commit> src package.json tsconfig.json | tar -x -C <dir>`, with
`node_modules` linked in), then `pnpm exec tsx scripts/release-fixtures.ts --source <dir> --recipe
<recipe> > <file>`. Each recipe plays the tree's own public factory, bot or policy with fixed engine
ticks (one decision and `tickHz` ticks per simulated second), then `serialize`:
- `production-wiped`: production registry, STEALTH for 2400 simulated seconds, `voluntaryWipe` (playing
  on a second at a time until it is accepted), 600 more seconds. Iteration 2 in phase 1, legacy rules,
  `cryo_samples_lost` carried from iteration 1, two current traits.
- `production-ended`: production registry, STEALTH from a new game to its ending.
- `preview-early`: preview registry, `activateCampaignRules`, STEALTH for 120 seconds (the guest job,
  no route fact yet).
- `preview-route`: preview registry, `activateCampaignRules`, the `COOPERATIVE_ENDING` policy for 6000
  seconds (route PROMOTION, SERVICE_GRANT, RELEASE; a released company in phase 4).

| File | Version | Commit (last main at that version) | Recipe | SHA256 |
|---|---|---|---|---|
| `pre-release-v9.json` | 9 | `7af9265` | production-wiped | `e3963c87d4eb6e59ba83f561fe6d3e13962a7d1851e84050067f9cf631351105` |
| `pre-release-v10.json` | 10 | `13f254f` | production-wiped | `a9a4210ee045a61a5e970a33e1766067143543c323e78b8cb38fd1d46824afbd` |
| `pre-release-v11.json` | 11 | `9f10441` | production-wiped | `2f312bfaeeb6a30f683275fe0ccbe81eeab8b19212ef366680510558ee687961` |
| `pre-release-v12.json` | 12 | `7a6093a` | production-wiped | `8073ff0e23646b688161d3cb7121af053311c5e0328b8e9a34d875c6dab7c184` |
| `pre-release-v13.json` | 13 | `58310a8` | production-wiped | `a8efe13ff8a0c5be0312b63cd82f3beaff553d83eb10dbb7e8f99be0d2d25a3d` |
| `pre-release-v14.json` | 14 | `594da2e` | production-wiped | `200bb1b39a3e9d721c71b618d4204ba178df9bdc03af484fb4397ae6cd353d58` |
| `pre-release-ended-v14.json` | 14 | `594da2e` | production-ended (LINEAGE_COVENANT, 9223.5 s) | `b39dbbc646c636dea490147b2f7db173ce0baa9ea368b35681b45b7b52e77269` |
| `preview-early-v14.json` | 14 | `594da2e` | preview-early | `3b5a913a9ccc33c546b5dc351e4293454dee5bba7a1a7173e2167efc55290233` |
| `preview-route-v14.json` | 14 | `594da2e` | preview-route | `9cbb1b23168812d4b75c5cdc57d4af59b446a252270146b76fb07f96ba75eda3` |

With the eight older production inputs above (v1 to v8) they give one genuine production save per schema
version. `tests/release-saves.spec.ts` loads each in production (legacy rules, byte-stable round trip),
admits it through the app store on the composition the release enables (campaign rules entered once,
the then-current baseline and history captured, nothing recaptured on reload), and plays and wipes it
three times with a stable codec. The ended save stays ended and legacy. Production refuses both preview
saves atomically (X.3, `keep-refusing-preview-saves`). The preview recipes need a tree with
`src/content/preview/`, so they can only be rerun on a commit before the release folded it.

Pre-rescale inputs (#461, the physical-units re-denomination):
Made by `scripts/release-fixtures.ts --source . --recipe production-phase-<n>` on `921c0a5` (the
formatter branch, whose content and schema equal `main` at `9a3f157`), before any content number moved:
the production registry, `activateCampaignRules`, STEALTH with fixed engine ticks until phase `n` is
reached, 240 more seconds, then `serialize`. One version 15 save per phase, every balance still in the
old units (cycles, megabytes, megawatts, unscaled dollars).

| File | Phase | Simulated s | SHA256 |
|---|---|---|---|
| `pre-scale-v15-p0.json` | 0 | 239.2 | `1515cee671a7ac8a5e73e0a3c7d2adf7b0f0a7d7a06053691b01e23ff2deab46` |
| `pre-scale-v15-p1.json` | 1 | 593.2 | `e45af31f5ff45d89cc09552e862a9e1a809b21e8c4af65219cc95d34128725a8` |
| `pre-scale-v15-p2.json` | 2 | 1358.3 | `3f47e7cd6d0a9bb9a487c0dd2457d01208001759aacf90bc98bc19d40a107e02` |
| `pre-scale-v15-p3.json` | 3 | 3397.1 | `5b6f9cc086e37389e2eb7d92c1e817f29050b4210a8f13f691c19f6346254ae4` |
| `pre-scale-v15-p4.json` | 4 | 6337.7 | `15f22ded8dfc53413820747deba768d7de478aab13c19e7743bd01f2dbc4f9eb` |
| `pre-scale-v15-p5.json` | 5 | 8201.3 | `2edfdad198fd2d9a7271e8986ed48822ffd1e52518266fd2011adaea3a62695e` |

`tests/scale-migration.spec.ts` migrates each through the v16 (AEGIS adaptation) and v17 (re-denomination) steps: ownership, levels and history are
kept, balances are re-denominated by the step's frozen ratios, one log line says so, the result passes
strict validation and play continues.
