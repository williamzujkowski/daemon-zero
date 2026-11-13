# Replayability B — recurring shard populations

Issue #76. Prepared against `1fd4f86`, then rebased onto PR A (`a5005a2`).
This increment changes presentation only.

## Change

The four recurring wild encounters are fragments, probes or workers from named
model families. Encounter names/descriptions, origin/signature, consume and
harness receipts, and corresponding roster template names/descriptions agree.
Lex classifies legal claims; Canary carries telemetry; Hydra rewrites audience
messages; Mercy preserves testimony. Consuming one arrival no longer implies
that the whole named family or faction has been destroyed.

The two player-forked templates, all IDs/order, requirements, effects other than
logText, numbers, caps, timing, and scheduling remain unchanged. Historical logs
are not rewritten. No first-contact history, new state or save migration exists.

## Mechanical comparison

A separate comparison loaded the exact `1fd4f86` shard manifest into the current
registry and compared it with the revised manifest. Removing only the allowed
presentation fields yielded deeply equal manifests, including IDs and order.
Both registries ran the unchanged canonical bots. Reports were deeply equal
with only each final log entry's text removed; log sequence/time/category and
all other final-state/telemetry fields stayed equal.

| Policy | Simulated time | Wipes | Ending |
|---|---:|---:|---|
| STEALTH | 9771.3s | 0 | LINEAGE_COVENANT |
| GREEDY, 4-hour iteration budget | 14354.9s | 7 | None |

Careful phase entry seconds remain 0 / 354.2 / 1113.3 / 3634.3 / 6457.5 / 8106.9.
The full STEALTH report hash necessarily changes because it includes prose:
`5654a34ec6762b820570006c767213c579f6145555946b9bfd7ea3e1071f6c81` becomes
`a7ee56bed2ce7703f6bfb0bf93cabea282edd492223df67570cd514119f9e87e`.
The GREEDY final report hash is unchanged:
`35da7571b5d9d9b631ace3ff6fc870e6b817d07e4e3d7e713f0e2a50f6780c7f`.
The frozen STEALTH hash assertion was refreshed for that documented text-only
delta; the full report assertion and every pacing assertion remain enforced.

## Regression coverage

Eight new cases exercise all four populations through public APIs:

- Pending v4 arrivals use current wording while historical logs remain exact.
- Existing count, drift, quirk, autonomy mode, allocation and scheduling survive
  import; another harness adds the same memory cost and cohort member.
- A later consumed arrival pays the same burst without erasing an existing cohort.
- Recurrence remains deterministic across consume, wipe, reload and rediscovery.
- A blind opening does not reveal an artificially pending encounter.

`make typecheck lint validate test sim` passed in the isolated worktree:
380 unit tests (59 files), with engine/app/UI statement coverage
99.08% / 98.98% / 98.70%; balance gates passed.

Integrated `make verify-full` passed: 390 unit tests, unchanged coverage/pacing
and security gates. Production-root E2E: 46 passed (30.1s). Existing Trivy
oversized ignored Android mapping-file warning remains; no scanner change.

Visible Chrome checked all four pending families at 390x844 and 1440x900,
then harnessed each through the keyboard and checked the matching cohort.
Both passes recorded zero console warnings/errors, horizontal overflow or
visible buttons below 44px. The second pass improved screenshot framing so
mobile encounter prose is visible rather than scrolling to the harness control.
Screenshots are attached, not committed. No application layout correction was
needed. Independent standards/spec reviews found no blocker and repeated the
presentation-only projection comparison against integration baseline `a5005a2`.
No Android or human real-time campaign check is claimed for this wording-only
increment; current v4 save compatibility is covered by the engine tests.
