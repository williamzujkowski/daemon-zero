# M4.6 UI review

Baseline: clean tree, main pulled to PR #43's merge `5e50a00`; frozen setup
passed. An unchanged retry of `make verify` passed all 223 baseline tests after
one initial all-endings component-test timeout. M5 work did not exist.

Fixtures were regenerated after the merge. The generator now produces 46 saves:
the 39 engine/content fixtures plus parser-ready, blind-reboot, table-ready and
one fixture for each of the four retraining marks. These use real engine
unlocks/wipes with codec-validated fixture funding; production UI never edits
state. No earlier save codes or screenshot artifacts were reused.

## Visible browser review

The pinned Playwright MCP 0.0.85 ran a visible Chrome window, isolated profile,
with `--browser chrome --isolated --allowed-origins
'http://localhost:8081;ws://localhost:8081;http://localhost:8088'
--snapshot-mode none`. HTTP transport added `--port 8935
--shared-browser-context`. No headless flag.

Three passes at 390x844 and 1440x900 covered guest-skimmer, guest-omen,
guest-dilemma, guest-exit-ready, lineage-parser-ready, lineage-blind-reboot,
lineage-reboot-retrained, lineage-table-ready, lineage-run-table, lineage-notes,
lineage-note-omen, all four lineage-mark fixtures, evaluation-ready and
ending-shipped. The review exercised actual parser/table purchases, mobile tabs,
recovery acknowledgements, notes and evaluation, rather than only loading saves.

The passes corrected harness tab selection and a stale expected-widget list
after buying the run table. The final UI adds a compact host audit indicator so
activity remains visible outside the guest. Reviews check gated resources,
44 px named controls, keyboard reachability, numeric meters, text fit/overflow,
and console warnings/errors. Final screenshots are PR attachments, not tracked
files. See the PR for the final pass result and any unresolved findings.

## Historical saves and Android

New historical saves were generated from extracted source outside the repository:
version 2 at pre-merge `aa290f8` (800 simulated seconds, twelve nodes), and
version 1 at `a11c35f` (180 seconds, five Phase 1 nodes, reproducing #39's old
readout situation). These were not current saves with a version field edited.

Both loaded through the ordinary storage envelope in production web and in
Android Expo Go (Pixel 7 API 36 x86_64 emulator), migrated to version 3, retained
their original hardware and survived reload/relaunch. Web reported no warnings
or errors. The version 1 understanding readout showed +6.30/s and the unreadable
trail; version 2 showed +11.75/s and the decoded meter because it owned the
parser. Native screenshots and the checkpointed AsyncStorage database confirmed
the same readouts, nodes and schema. The native database was backed up before
testing. This is emulator/Expo Go evidence, not a physical-device or signed-build
claim. iOS was not tested.

## Gates and limits

`make verify-full` passed: 242 tests, unchanged coverage thresholds (99.01%
statements overall), lint with zero warnings, strict typecheck, content,
pacing gates, production web export, security scans and SBOM. No src/engine or
src/content changes, no new queries, and no lint/TypeScript/coverage/pacing gate
changes. The production-hook exclusion tests remain passing.

The three-run accelerated UI playthrough and its comprehension limits are in
[PLAYTEST-LINEAGE.md](PLAYTEST-LINEAGE.md). No new pacing/content/design issue was
filed; task #44 tracks this UI follow-up. Any future finding must be labelled
`second-pass`.
