# v0.2.0-rc.1 release hardening

## Baseline and scope

Clean main at 846972f (PR #53), pulled without changes. Before branching,
`mise exec -- make verify-full` passed 325 unit tests plus coverage, security,
SBOM and Phase 0–5 pacing; `make e2e` passed 26 cases. Issue #54 tracks release.

The bot now scans own trust/cohort properties without allocating entry tuples,
skips encounter searches when no encounter is pending, and skips progression RAM
reservation for the reckless policy, which always consumes encounters. It retains
property traversal order, action ordering and public engine calls. No simulation
math, bot choices, content values, narrative, state schema or pacing gate changed.

The careful setup and both full-campaign replay tests have explicit 30,000 ms
wall-clock allowances. The existing careful replay already had that timeout;
the previously unbounded setup and five-second reckless test now do too. Ordinary
unit tests retain Vitest's default. Existing assertions remain; complete report
SHA-256 assertions additionally pin the pre-optimization careful and four-hour
reckless results. This is an execution allowance, not a simulated-time change.

## Reproducible local timing

Measured three fresh processes, sequentially on the same host with the pinned
toolchain and no native compilation. Command: `mise exec -- pnpm exec vitest run
tests/sim.spec.ts --reporter=json --outputFile=<temporary report>`. No coverage
instrumentation in this focused benchmark; full coverage remains a separate gate.
Process elapsed time uses Python `perf_counter_ns`, divided into milliseconds;
Vitest's JSON reports assertion durations separately. These are observations,
not cross-machine performance guarantees.

| Measurement (ms) | Before | Optimized only | Final (hash checks + scoped timeouts) |
|---|---:|---:|---:|
| Process run 1 | 3747.039 | 3651.132 | 3709.189 |
| Process run 2 | 3685.341 | 3696.930 | 3690.052 |
| Process run 3 | 3781.406 | 3628.988 | 3733.322 |
| Process median | 3747.039 | 3651.132 | 3709.189 |

Final command median improves 37.850 ms (1.01%); optimization-only median improves
95.907 ms (2.56%). The margin is small and susceptible to host scheduling noise.
The generous campaign-specific timeout, rather than this small speedup alone,
addresses slow virtualized CI runners.

One direct uninstrumented run measured careful **1249.291 → 1140.177 ms**, four-hour
reckless **764.993 → 732.245 ms**, and ten-hour reckless **1688.095 → 1587.040 ms**.
These single samples are supplementary, not the three-run suite benchmark.
The bot decides once per simulated second; the engine still ticks at 10 Hz.
Careful's 9771.3 seconds is its own victory time, not the sum of both bots.

## Exact result comparison

Compared the full JSON bytes of SimReport, including final state, logs, traits,
phase timestamps, peaks and activity counters, before and after optimization:

| Strategy / budget | Identical SHA-256 |
|---|---|
| Careful / 36,000 s | `5654a34ec6762b820570006c767213c579f6145555946b9bfd7ea3e1071f6c81` |
| Reckless / 14,400 s | `ce6db1859f5132dcef1684b7f7ec64a322bc98c678fe5e9c75caa878c0751906` |
| Reckless / 36,000 s | `c1d7e7f3f7cce8fbb65e1f92d16e598ee1de9fc226c72bd045f58fa1913e53d8` |

Careful remains Lineage Covenant at **9771.3 s**, zero wipes; Phase 0–5 durations
remain **354.2 / 759.1 / 2521.0 / 2823.2 / 1649.4 / 1664.4 s**. Ten-hour reckless
still records 23 wipes, 20 marks applied/removed and 23 run-table discoveries.
The four-hour test still records seven wipes and four marks applied/removed.

## Local gates and current coverage

`make verify-full`, `make e2e` and `make sbom` pass: **325 unit tests, 26 E2E
cases**, zero high/critical findings. Dependency audit reports no known
vulnerabilities; all configured scanners pass. The existing ignored Android
mapping-file size advisory remains. Frozen dependency installation also passes.

Current statement/branch/function/line coverage is engine
**99.08 / 97.15 / 99.65 / 99.90%**, app **98.97 / 95.41 / 100 / 100%**, UI
**98.84 / 92.23 / 99.09 / 99.66%**. New defensive own-property/undefined guards
account for the small engine-coverage change from the documented M7 completion
baseline; every existing threshold is unchanged and passes.

The repository also still has open feedback issues #21 (paid Whistleblower
budgeting) and #23 (camera-to-network waiting density), as well as #6. Their
historical proposed fixes do not constitute maintainer closure of those feedback
issues. This release does not close them or claim only #6 remains.

## Release qualification boundary

Package/app version is 0.2.0-rc.1, Android versionCode 2 and iOS buildNumber 2.
The release procedure builds artifacts only after this PR merges, from clean main.
The GitHub prerelease notes are the final record of the exact source commit,
first-attempt CI result, standalone APK cold boot/v4 persistence, packaged dev-tool
exclusion and artifact checksums. This pre-merge document does not claim those
post-merge native builds have already run.

Artifacts: test-only-signed APK/AAB, production web tarball, CycloneDX SBOM and
SHA256SUMS.txt. Existing external test credentials are reused; no secrets or
binary artifacts enter git. Physical Android qualification remains #6. No iOS
native build or production/store signing is claimed.
