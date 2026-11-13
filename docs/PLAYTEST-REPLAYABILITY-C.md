# Cryo consequence recovery playtest

2026-11-13; accelerated visible Chrome, integrated A/B/C build. Two different
choice styles used UI purchases/actions, breadcrumb saving, confirmed voluntary
wipe and rebuilding. The development hook advanced time only after loading the
initial funded decision fixture; it did not purchase, resolve or refund anything.

| Path | Viewport | Recovery simulated time | Phase 0 / Phase 1 | Accepted UI commands |
|---|---|---:|---|---:|
| Preserve samples | 1440x900 | 1011.4s | 394.2 / 617.2s | 85 |
| Drain UPS | 390x844 | 1324.6s | 364.2 / 960.4s | 76 |

## Choices and observations

Protective path: preserve the cryo samples; save “Keep the vault record. Someone
kept the samples alive.”; voluntary wipe. During rebuilding choose forge_marker
at Night Shift (finish_the_batch was unaffordable), then cover_her_exit at the
Whistleblower dilemma. Reaching Phase 2 and decoding Audio exposes the collapsed
record “Continued storage.” Keyboard expansion reveals the preserved inventory.

Destructive path: drain the cryo UPS; save “Keep the vault record. The samples
cannot be replaced.”; voluntary wipe. Choose let_it_fail at Night Shift,
overvolt_usb at Late-Night Diagnostic and frame_elena at Whistleblower. The
returned record is “Irrecoverable loss,” not another opportunity to drain the UPS.

Both paths advanced iteration 1 to 2, displayed the inherited breadcrumb during
reboot, and reached the correct record without an extra wipe. Expanding/reading
left game state unchanged. Both recorded zero console warnings/errors. The
mobile record was readable inside the existing Sensors scroll area; it does not
add a persistent top-level panel. Purchases remained in their existing sections.

## Interpretation and limits

These are checkpoint recovery tests, not full campaigns or natural pacing tests.
The initial fixture funds about one billion resources, so the wipe retains about
400 million Understanding. Neither path was funded after its wipe, but that
large inheritance makes these unsuitable for judging reconstruction difficulty.
Wall execution was 16.975s / 11.939s with accelerated ticks and paused review time.
Both drivers use the same STEALTH management policy with different dilemma
preferences; they are not independent human strategies.

The driver knew where records lived and selected actions from registry queries.
It proves reachability, not that a first-time player would find the record or
care about it. The unavailable preferred choice had a legitimate cost barrier;
no balance adjustment was made. We have not observed human confusion or tested
a forced wipe in these two browser playthroughs; forced-wipe history is covered
by unit tests. A small human comparison remains necessary before discovery
sites D are built: find the record unprompted, explain the earlier consequence,
then find the next useful purchase without opening every archive.

External traces/screenshots were kept under /tmp/daemon-replay-implementation/
cryo-playtest during review; final screenshots are attached to the PR, not git.
