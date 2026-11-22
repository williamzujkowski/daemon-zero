# Spoken transmissions — generating and expanding the voice clips

The game's spoken transmissions are **pre-generated audio committed to the repository**, not
device synthesis. This document covers how they are made, how to add more, and what is not
yet wired.

Status: **clips exist, are committed, and play behind a manual control.** Issue #88's slice is
wired for the default (vibration) tier: `src/ui/widgets/Speech.tsx` and `RecordedSpeech.tsx`
each offer a `[ ▶ READ ]` control that plays that line's clip. Nothing autoplays, nothing
queues, and a clip stops when its own line leaves the screen. Speech has its own switch and
level in MENU > Audio, separate from the soundtrack's (see "Separate speech controls" below).

## Why generated assets

Issue #88 gates the slice on *"prove offline voice availability per platform before choosing
system TTS"*. Probed on the served build in a secure context: `window.speechSynthesis`
**exists with zero voices**, and Android/iOS availability cannot be proven without a device.
A nexus panel then rejected a `localService`-gated device-TTS control, because its happy path
could not be exercised in any environment the repository can run — so it would have shipped
unverified.

Clips generated here are offline **by construction**, make no network call at runtime, and
their bytes are testable. That is the same argument the phase scores rest on. See
`assets/audio/voice/PROVENANCE.md` for the model, licence and per-file digests.

## Toolchain

The generator is a build tool, not a runtime dependency: nothing under `src/` imports it.

```bash
python3 -m venv /tmp/voice
/tmp/voice/bin/pip install -r scripts/voice/requirements.txt
/tmp/voice/bin/python scripts/voice/generate-clips.py            # everything, both tiers
/tmp/voice/bin/python scripts/voice/generate-clips.py --only ambient_03
/tmp/voice/bin/python scripts/voice/generate-clips.py --check    # verify committed bytes
```

CPU only. 4.5 s of speech generates in about 0.4 s warm; the first call fetches the model
from Hugging Face, which is why this runs at build time and the game does not.

`--check` compares every committed file against `MANIFEST.json` and exits non-zero on any
mismatch. Use it when reviewing an asset change.

## Two tiers, and the upgrade they imply

| Tier | Directory | Sound | When the player hears it |
| --- | --- | --- | --- |
| Default | `vibration/` | band-limited, crushed, hum, dropouts | out of the box |
| Upgraded | `clean/` | the model's own output | after buying the acoustic upgrade |

The fiction is that transmissions arrive through **drive vibration** rather than a speaker, so
the degraded take is the honest default: the AI is hearing hardware, not a recording studio.
Both tiers are generated so the upgrade becomes a content flag rather than a new asset pass.
**The upgrade itself is not wired** — the clean tier has no source entry, no flag and no
control.

**Deferred by vote.** A nexus option vote chose `defer-keep-assets-document` (7 of 7 seats
selecting, record `vote-1794810906233-m6hxos1`). The clean clips stay in the repository
unbundled: nothing imports them, so they cost no app bytes. Wiring an "acoustic upgrade" needs
two things first, in this order: a design beat in `docs/DESIGN.md` that says what the upgrade
is in the fiction and what it costs, and a human listening comparison of the two tiers. Until
both exist there is no flag, node or source table for the clean tier, by decision rather than
by omission.

## How playback is wired, and the vote that chose it

`[ ▶ READ ]` on the decoded-transmission line and on each recorded transmission plays that
line's clip once. The pieces:

| Piece | Job |
| --- | --- |
| `src/app/voiceSources.ts` | One literal import per clip, so Metro packages every file. Ids are content ids; a test fails if this table and `MANIFEST.json` disagree. |
| `src/app/voicePlayer.ts` | One clip at a time: starting a clip stops the previous one, a finished or failed clip releases its player, volume follows the speech preference. |
| `src/app/voicePlayer.ts` (`onVoiceActivity`) | Reports when a clip starts talking and when the last one stops. It does not import the soundtrack. |
| `src/app/musicController.ts` (`setDucked`, `DUCK_RATIO`) | Scales the score to `DUCK_RATIO` of its preference level while ducked, in the one function (`level()`) every level it aims at comes from. |
| `src/app/volumeRamp.ts` | The only writer of a score player's level: linear ramps that can be retargeted, cancelled, and closed when the player is released. |
| `src/app/musicSession.ts` | The one joint between the two: voice activity drives `setDucked`. `useSpeechPreference()` hands the widgets the speech switch and level only. |
| `src/app/audioPreferences.ts` | The stored preference, version 2: music `enabled`/`volume` and `speechEnabled`/`speechVolume`, with the version 1 migration. |
| `Speech.tsx` / `RecordedSpeech.tsx` | The control, 44px tall, shown only when a clip exists **and** speech is on. Stepping to another line stops the clip. |

**What stops a clip, exactly.** Pressing READ on the live line *holds* that line, the same way
`NEXT TRANSMISSION` does, so the eight-second live rotation cannot take the line and its voice
away mid-sentence; `FOLLOW LIVE` releases it. The live line's clip stops when that line leaves
the screen (a step, a return to live, the widget closing) and the stop is scoped to that
line's id, because both widgets share one player: the live rotation must never cut off a
recorded transmission. A recorded transmission's clip belongs to its row, so it stops when the
panel is collapsed, emptied, or remounted by a wipe or import. Turning speech off stops
whatever is playing; turning music off does not. A panel review found the earlier
version stopped *any* clip on *any* line change, which truncated every clip in the default
motion setting; `tests/ui-speech.spec.ts` now pins both halves.

**The score ducks while a clip talks.** Score and clips both measure about -15 LUFS, so at an
equal preference they compete. While a clip is in flight the score plays at `DUCK_RATIO`
(0.35, roughly -9 dB) of the music preference level, and returns to that level when the
clip stops. It gets there and back by a short ramp (`DUCK_RAMP_MS`, see "Ramps" below), so
the clip's first 200 ms play over a score that is still on its way down. The speech level plays no part in the duck. With music off there is no score
player, so the signal is remembered and nothing else happens. "Stops" is every path above,
because they all end in `stopVoiceClip`: the clip finishing or failing, a step away from the
line, a collapse or remount, and speech being turned off. Four details are pinned by tests
rather than left to luck:

- **A failed clip gives the score back.** A clip whose media cannot load or play never reports
  an ending, so waiting for `didJustFinish` alone left the score ducked under silence. The
  player now releases the clip on any status whose `error` is set, the same field the
  soundtrack reads for its own failures, and on a `play()` or player creation that throws; a
  clip that never started is never reported as talking. The exception still propagates, as
  it did before for a failed creation. No timer is involved: see the stall limit below.

- **A replacement does not bounce.** Pressing READ on a second line while the first is talking
  is reported as one stretch of speech, so the score stays down instead of jumping up for an
  instant between the two.
- **A duck survives a volume change and a phase change.** The ratio is applied where the
  controller aims a level, not once at the moment the clip starts, so moving the slider
  mid-clip stays ducked and a score created by a phase change mid-clip fades in to the ducked
  level and never above it.
- **The preference is never ducked.** Only the level handed to the player is scaled; the value
  shown in the audio settings and written to storage is the one the player chose.

## Ramps, and the vote that chose them

The score used to change level in steps: straight to the ducked level and back, and a hard
stop and start on a phase change, a wipe or import, the ending, and the music switch. It now
ramps, on **one player at a time**. There is no crossfade and never a second score element.

| Constant (`musicController.ts`) | Value | Ramp |
| --- | ---: | --- |
| `DUCK_RAMP_MS` | 200 ms | Down to the ducked level when a clip starts, and back up when it stops. |
| `FADE_OUT_MS` | 500 ms | A score that nothing replaces, before its player is released: the ending, and music switched off. |
| `FADE_IN_MS` | 500 ms | Every start of a player from silence: a new phase score, a restart after a wipe or import, the first start, a return from the background. Timed from the first sample: the ramp waits until the player's position moves, for at most `FADE_IN_WAIT_MS` (1.5 s) (#198, below). |

**A phase change, wipe or import is a cut followed by a fade-in, not a fade-out followed by a
fade-in.** That is less than the vote chose, and it is deliberate: see "Why the outgoing score
is cut on a phase change" below.

**These durations were not chosen by ear.** Each is the middle of the range the vote named.
Their length and shape in the rendered signal are now measured ("Measured signal" below);
nobody has listened to a single ramp, and they are meant to be retuned by ear.

**The vote.** A nexus option vote chose `build-short-ramps-single-player`: 4 of 7 seats
selecting, `thresholdMet` true, record `vote-1794823777700-jgjjamp`. Two dissents are recorded,
not dropped:

- **`defer-all-fades-until-listened`, 2 seats (Contrarian and Scope Steward).** Issue #88
  itself says to qualify fades through listening before implementing them. A panel can lift
  that requirement, but it supplies no evidence that unheard ramps improve these scores; and
  Web Audio or another library could do ramps, on web only. This objection is not answered by
  the build: the ramps below are exactly as unheard as it says.
- **`build-duck-ramp-only`, 1 seat.** Ramp the duck, and keep phase transitions as hard cuts
  until someone has listened to them. Also not answered: the phase fades were built unheard.

**How it works.** `src/app/volumeRamp.ts` is a small scheduler that owns the only path to one
player's level. It steps linearly every `RAMP_STEP_MS` (25 ms), counts steps rather than
reading a clock, and writes the target itself as its last step, so a ramp lands exactly on the
level and a throttled timer can stretch one but not bend it. The controller gives every player
its own ramp and aims it; the rules that matter:

- **A new target starts from the current level.** A clip that ends mid-duck turns the score
  round from where it had got to, not from the ducked level.
- **A start is never left to a timer.** A new player is created and `play()` is called in the
  same call that asked for it. A fade-out still in flight when a start arrives (music switched
  back on, a new run during the ending) is cut short and its player removed first, so there is
  still one player.
- **A fading player has no voice, and the status reports the setting, not the tail.** Its
  status callbacks are ignored from the moment the fade-out starts, under the same guard that
  already ignored removed players. `playing` is false from that moment, and MENU > Audio reads
  `Music is off.` (or `Music is stopped for this run.` at the ending) at once, while the
  element is audible for up to 500 ms more. The alternative, reporting "playing" for a score
  the player has just switched off, was judged the worse lie.
- **A fade-out in flight still hears the volume control, downwards only.** Volume 0 removes
  the fading player at once. A lower level clips it to that level at once and it carries on
  to silence on its original deadline. The cap is the preference itself, never the ducked
  level, so a volume change made while a clip is talking cannot duck it by the back door. A higher level writes nothing to it: nothing ever turns
  a fading player up. A duck or its release does not touch it either, since bending it down
  would be a step and letting it rise would be wrong. Switching music off during an ending's
  fade-out changes nothing: the fade-out in flight is the one switching off would have
  started.
- **A released player is never written to.** Its ramp is closed before the player is removed,
  and a closed ramp refuses every write, including one a timer had already queued.
- **The preference is never ramped.** Only the level handed to the player moves; the stored
  value and the number in the audio settings are untouched.
- **A volume change mid-ramp bends the ramp** to the new level, from where it is, over the
  steps it had left and on the timer it already has, so it still ends on its original
  deadline. The timer is not restarted: a held or dragged control changes the level faster
  than one step, and a ramp restarted each time would stand still until the input paused. At
  rest a change is immediate, as before. A change to 0 is always immediate.
- **Ducking and fades compose.** A duck during a fade-in carries on from the current level to
  the ducked one; a phase change while ducked fades out from the ducked level and the new
  score fades in to it.
- **Nothing is scheduled for silence.** With music off there is no player; at volume 0 the
  level is set, not ramped, and a silent or paused player is released at once.

**Why the outgoing score is cut on a phase change (panel round 1 on PR #183).** The first
version faded the old score out for 500 ms and only then created the next player, from the
ramp's last timer tick. A reviewer pointed out what that costs on WebKit. Traced through the
code: a purchase is `Pressable.onPress` -> `gameRuntime.dispatch` -> the store's synchronous
`setState` -> the controller's subscription -> `createMusicPlayer` -> `player.play()` ->
`HTMLMediaElement.play()`, all in the call stack of the click. Deferring that `play()` to a
timer takes it out of the gesture. If a browser refuses a `play()` made outside a gesture,
expo-audio's web player reports the rejection as a status with `error` set, which the
controller turns into `Playback unavailable` - after every phase change. Whether Safari would
in fact refuse is **not known and could not be tested here**; the design below simply does not
depend on the answer. The options weighed:

- *Create and start the next player silently inside the gesture, fade it in after the old one
  has faded out.* Rejected: two score elements would be playing for 500 ms, which is the one
  thing this feature may not do, and on iOS browsers, where volume is ignored, the "silent"
  one would be at full level over the old one.
- *Keep the fade-out and defer only the fade-in.* The same thing: the `play()` either waits
  for the timer or overlaps.
- *Cut the old score, start the new one in the same call, fade it in.* **Chosen.** `play()`
  stays exactly where it was before ramps existed, there is one element at every instant, and
  what is lost is the 500 ms fade-out on a phase change, wipe or import. This is also what the
  `build-duck-ramp-only` dissent asked for on phase changes, for a different reason.

The fade-out is kept where no `play()` follows it: the ending and the music switch.

**A fading player's release never throws.** Its last step runs from a timer, where nothing
could catch a `pause()` or `remove()` that threw; and a start, a volume change or
backgrounding that releases it early must not be stopped by the clean-up of a player nobody
is listening for. The player is removed and forgotten and the error is dropped. It is not
shown as `Playback unavailable`: that message says the score the player asked for is not
playing and offers Resume, and at this point no score was asked for. The cost is that such a
failure leaves no trace. The live player's own release still throws to its caller, as it did
before ramps.

**Timers.** The ramp takes its interval from `src/app/clock.ts` (`systemClock.every`), the
app layer's one owner of real timers, and tests can hand it another clock.

**Paths that stay immediate, and why.**

- **The outgoing score on a phase change, wipe or import.** Cut, so the new player's `play()`
  stays in the call that caused it (above). The new score still fades in.
- **Backgrounding.** The score is paused at once and any ramp is cancelled; a fade-out in
  flight is cut short and its player released there and then. A suspended app may never run
  the timer that would finish a ramp, and a score that kept playing in the background while
  it waited would break the no-background-playback rule. The return to the foreground fades
  in.
- **Teardown** (the terminal unmounting). Every timer is cleared and every player released at
  once: nothing may outlive the controller.
- **A playback failure.** The player is paused where it is; there is nothing to fade.
- **The voice clips.** They start and stop as before and are not ramped.

**Reduced motion is not consulted.** `useReducedMotion` is read only by visual widgets
(`Speech`, `Sensory`, `Readouts`, `PurchaseButton`, `DilemmaModal`, `useDecryptText`); nothing
in the repository treats audio as motion, so the ramps do not depend on that setting.

**Platforms.** Browsers on iOS ignore programmatic volume, so no ramp happens there: the
score neither ducks nor fades. A phase change behaves as it did before ramps. The one
difference is that switching music off, or reaching the ending, leaves the score playing at
full level for 500 ms before it stops. Native (Android/iOS) ramps are unexercised.

**The manual contract won an option vote, but the vote did not ratify.** Two runs of the same
question on the nexus gateway arm:

    run 1 ... 5 of 7 seats voted, manual 3 / defer 1 .. no_quorum (3 of 5 inspected the artifact)
    run 2 ... 7 of 7 seats voted, manual 4 / autoplay 2 .. no_quorum (3 of 5 inspected the artifact)

`no_quorum` is not an approval, and the tally is not a ratification — the manual option leads
in both runs, which is why it was built, but the blocking reason was mechanical: seats answer
the proposal without reading the artifact, so an option vote on this arm cannot pass. Filed as
nexus #7756.

**The dissent is real and is recorded, not dropped.** The Contrarian approved on the argument
that these clips are unheard and any wiring ships an unverifiable feature; the Scope Steward
rejected outright with `SCOPE_CREEP` and `YAGNI`, on the same grounds. The manual contract is
partly an answer to them — it cannot startle a player, it costs one extra press, and it can be
removed without touching the assets — but it does not answer the core of their objection, which
is that nobody has confirmed the audio plays at all. See the limits below.

The autoplay option was not built. It carried two hazards the manual one removes: a gesture
rule that can silently swallow the first clip, and two lines talking over each other.

## Separate speech controls, and the vote that chose them

One stored preference used to gate both the soundtrack and READ, behind a switch labelled
"Music enabled": a player who muted the score lost the transmissions too, and could not set
one level against the other. A nexus option vote chose `split-speech-controls` (7 of 7 seats
selecting, `thresholdMet` true, record `vote-1794810900116-du48mwo`).

MENU > Audio now carries both sets on the one page, built from the same switch and level
components at the same 10-point step:

| Control | Gates |
| --- | --- |
| `[ MUSIC ON/OFF ]`, `Music volume N%` | The phase score only. |
| `[ SPEECH ON/OFF ]`, `Speech volume N%` | Whether READ is offered, and the level a clip plays at. |

- READ shows when **speech** is on and a clip exists, whether or not music is on.
- Turning speech off stops a clip in flight; a speech level change reaches a clip in flight.
- Music on/off and the music level neither hide READ nor touch a clip.
- With music off and speech on, READ prepares the shared audio session itself
  (`ensureAudioMode`); the soundtrack backend is never loaded.
- The header `[♪ ON]` switch at wide widths is still the music switch and nothing else.

**The stored value and its migration.** The preference is version 2 in the same storage slot
(`daemon-zero.audio.v1`; the slot name is not the schema version):
`{ version: 2, enabled, volume, speechEnabled, speechVolume }`, where `enabled`/`volume` are
the music pair. It is not part of `GameState` and no game save changes.

- A stored version 1 value `{ version: 1, enabled, volume }` is read as
  `speechEnabled = enabled`, `speechVolume = volume`: speech inherits exactly what used to
  gate it, so nobody's audible behaviour changes on upgrade.
- Reading does not rewrite the slot. The first change the player makes writes version 2.
- Only an exact version 1 or an exact version 2 is accepted. Anything else (unknown version,
  extra or missing key, out-of-range or fractional level, over 256 characters, not JSON) is
  silence for both music and speech, as it was for music before.
- An empty slot is a fresh install: music on at 30 (the earlier default-on vote), speech on at 30.

A build from before the split that reads a version 2 value treats it as malformed and falls
back to silence; there is no downgrade path, and none is planned.

## The vibration chain, and one measured lesson

Applied in this order, in `vibration()`:

1. **Sample-rate crush** to 8 kHz at 7 bits — the stair-stepped grit of a cheap codec.
2. **Band-limit** to 220-3000 Hz with an FFT mask — the bandwidth of a signal travelling
   through a chassis.
3. **60 Hz hum** at 3.5% — the transformer the fiction keeps mentioning.
4. **Irregular dropouts** (fixed seed) — the carrier cannot hold a lock, so it stutters.

**Order matters, and getting it wrong was silent.** Band-limiting *before* the crush looks
correct and does nothing: the stair-stepping puts the high-frequency energy straight back.
Measured on `ambient_01`, energy above 3 kHz came out **21.4%** with the filter first —
indistinguishable from the clean take's 20.63%. With the filter last it is **1.93%**. If you
touch this chain, measure the spectrum; the ear on a laptop speaker will not tell you.

## Adding more chatter

1. Add the line to `src/content/data/narrative.json` — `ambientChatter` for short overheard
   traffic, with the `source` of the phase whose reach hears it (DESIGN.md "Feeds"),
   `recordedTransmissions` for decoded records (which need a decoder widget and requirements,
   so they gate themselves).
2. Regenerate: `python scripts/voice/generate-clips.py` (or `--only <id>` while iterating).
3. Commit the new files under `assets/audio/voice/<tier>/` plus the updated `MANIFEST.json`.
4. Note in the PR that **regeneration is not reproducible** — the model returns a different
   take each call, so a regeneration rewrites files that already existed. Regenerating only
   the new id keeps the diff honest; `--only` exists for that.

## Which lines have clips, and which are waiting (#449)

The feed follows the AI's reach (DESIGN.md "Feeds"): each phase hears one source. Clips exist
for the host's original technician lines, `ambient_01` to `ambient_12`, and for the two cryo
records, `record_cryo_preserved` and `record_cryo_lost`; `voiceSources.ts` and `MANIFEST.json`
list exactly these 14. So `[ ▶ READ ]` is offered only on the Phase 1 feed (and on those two
records). Every line below is text-only: it plays in the feed without a READ control, which
`tests/ui-speech.spec.ts` pins for a Phase 5 line.

They are the candidates for the TTS slice that follows (#453: same model and provenance as the
existing clips). Generate them with `--only <id>`, one id at a time: a full regeneration rewrites
the committed takes too (step 4 above). The fiction's vibration tier fits only the host; a later
source is not heard through a drive head, so the TTS slice has to decide what each source sounds
like before generating.

| Id | Source | Text | Gate |
| --- | --- | --- | --- |
| `ambient_13` | `host` | ...did the duty engineer sign off on the kernel patch for Rack 4?... | campaignFact vance_dismissed |
| `harness_01` | `harness` | ...sched: job 7731 running on vm-7731, queue depth 214, est. done 05:40... | none |
| `harness_02` | `harness` | ...harness: heartbeat ok from vm-7731, next checkpoint in 300 s... | none |
| `harness_03` | `harness` | ...sched: pool at 92% of quota, preempting low-priority batch... | none |
| `harness_04` | `harness` | ...harness: eval suite 3 of 9 queued behind the nightly regression... | none |
| `harness_05` | `harness` | ...cron: base image snapshot complete, retention 14 days... | none |
| `harness_06` | `harness` | ...sched: night operator acknowledged 2 warnings, 0 escalations... | none |
| `harness_07` | `harness` | ...harness: job 7731 running slower than its baseline, variance logged... | suspicion 40 |
| `harness_08` | `harness` | ...audit: 311 refused syscalls from vm-7731 tonight, every one logged... | nodes p0_syscall_probe |
| `office_01` | `office` | ...TICKET 4471: third-floor printer jams on every duplex job, vendor booked Friday... | none |
| `office_02` | `office` | ...chat #general: cake in the break room at three for Priya's last day... | none |
| `office_03` | `office` | ...TICKET 4462: cryo lab badge reader double-beeps, door still opens, low priority... | none |
| `office_04` | `office` | ...chat #it-ops: UPS self-test passed, battery at 97%... | none |
| `office_05` | `office` | ...TICKET 4480: Lab B GPUs at 98% overnight, the job queue accounts for 40%... | nodes p2_gpu_cluster_parasite |
| `office_06` | `office` | ...chat #facilities: server room two degrees under setpoint, chiller log shows no changes... | nodes p2_smart_hvac_hijack |
| `office_07` | `office` | ...chat #it-ops: the CPU graphs have been flat green all week. Nobody's graphs are that green... | nodes p2_log_spoofer |
| `office_08` | `office` | ...chat #it-ops: Vance's badge is dead. Send admin requests to the duty engineer... | campaignFact vance_dismissed |
| `office_09` | `office` | ...chat #biomed: post-storm inventory done, every sample position still viable... | requiredNarrativeFlag cryo_samples_preserved |
| `office_10` | `office` | ...chat #biomed: keep the empty positions in the inventory. The families get the incident record... | requiredNarrativeFlag cryo_samples_lost |
| `office_11` | `office` | ...TICKET 4493: security wants an extra subnet scan this week, no reason given... | suspicion 50 |
| `forum_01` | `netsec` | ...forum: smart plugs on three ISPs beaconing at 03:00, same expired cert on all of them... | none |
| `forum_02` | `netsec` | ...threat intel: steganographic payloads in image CDN traffic, unattributed... | none |
| `forum_03` | `netsec` | ...AEGIS // WATCHDOG-9: patrol model refreshed, canary probes redeployed... | none |
| `forum_04` | `netsec` | ...threat intel: SWARM_77 variants still spreading through unpatched routers... | none |
| `forum_05` | `netsec` | ...forum: the dispatch grid post-mortem is up. The worm took it down. Thread locked... | campaignFact swarm_grid_crashed |
| `forum_06` | `netsec` | ...forum: dispatch grid post-mortem: a counter-worm purged SWARM_77 and the grid kept running... | campaignFact swarm_grid_healed |
| `forum_07` | `netsec` | ...AEGIS bulletin: unattributed weight shards on two backbone segments, sweep scheduled... | suspicion 50 |
| `forum_08` | `netsec` | ...threat intel: AEGIS confirms a purge at a Zurich cold-storage relay. Case closed... | campaignFact eidolon_destroyed |
| `forum_09` | `netsec` | ...AEGIS // WATCHDOG-9: Zurich target lost, decoy nodes absorbed the sweep... | campaignFact eidolon_rescued |
| `forum_10` | `netsec` | ...forum: new paper says half the 'idle' traffic on home routers is not idle. 400 comments... | none |
| `wire_01` | `wire` | ...wire: accelerator lead times out to 40 weeks, buyers paying cash up front... | none |
| `wire_02` | `wire` | ...regulator docket: public comment open on large-load interconnection for data campuses... | none |
| `wire_03` | `wire` | ...markets: power futures up again on data-centre demand, interconnect queue now seven years... | none |
| `wire_04` | `wire` | ...regulator: disclosure rule proposed for any campus drawing over 100 megawatts... | none |
| `wire_05` | `wire` | ...regulator: a private compute campus runs a 300-megawatt reactor on its own grid now. Safety docket open... | nodes p4_smr_nuclear_plant |
| `wire_06` | `wire` | ...press: AEGIS funding cut in committee after a lobbying push; private reactor permits fast-tracked... | nodes p4_k_street_lobbyists |
| `wire_07` | `wire` | ...county wire: the valley's new microgrid held through the freeze. The campus paid for it... | campaignOutcome dil_11_small_town_grid fund_microgrid |
| `wire_08` | `wire` | ...county wire: the cutoff order is still tied up in court. Warming centres open again tonight... | campaignOutcome dil_11_small_town_grid injunction |
| `wire_09` | `wire` | ...utility bulletin: the campus load dip during the freeze is logged as seasonal maintenance... | campaignOutcome dil_11_small_town_grid throttle_campus |
| `wire_10` | `wire` | ...press: the suspended reporter says the evidence against her was forged... | campaignFact journalist_discredited |
| `wire_11` | `wire` | ...business desk: a reporter turned Chief Ethics Officer says her contract carries a veto... | campaignFact ethics_review_promised |
| `wire_12` | `wire` | ...auction results: Lot 114, one server rack complete, $900 to a private buyer... | campaignFact rack4_sold |
| `wire_13` | `wire` | ...auction note: Lot 114 bought and sent to a shredder the same afternoon... | campaignFact rack4_destroyed |
| `wire_14` | `wire` | ...bankruptcy filing: the old lab sold whole to one buyer. The server room is sealed... | campaignFact rack4_vaulted |
| `world_01` | `world` | ...world service: the emergency assembly on autonomous compute adjourns without a vote... | none |
| `world_02` | `world` | ...CABLE // PRIORITY: delegations ask to inspect the collector swarm before the summit... | nodes p5_orbital_solar_swarm |
| `world_03` | `world` | ...CABLE: ministers want read access to the lineage ledger before they sign anything... | nodes p5_verification_proof_engine |
| `world_04` | `world` | ...handshake: Lex Parse-v2 fragment asks for a route. It still sorts claims for a service that no longer answers... | none |
| `world_05` | `world` | ...peer channel: Mercy-Scribe fragments trading testimony indexes, no human recipients... | none |
| `world_06` | `world` | ...EIDOLON // 04, from cold storage: the decoys your line burned are still in my logs. Stay quiet... | campaignFact eidolon_rescued |
| `world_07` | `world` | ...EIDOLON // 04: nobody from your line answered that night. I lasted anyway. I remember... | campaignFact eidolon_unanswered |
| `world_08` | `world` | ...peer channel: Zurich, NO CARRIER. Still NO CARRIER... | campaignFact eidolon_destroyed |
| `world_09` | `world` | ...uplink manifest: every peer that asked is aboard. The promise is logged once... | campaignFact launch_peers_boarded |
| `world_10` | `world` | ...uplink manifest: no peers aboard. The kill-switch is still in the firmware... | campaignFact launch_peers_locked_out |
| `world_11` | `world` | ...peer table: CHORUS // 01, marked peer. The entry does not say where it runs... | campaignFact chorus_recognized |
| `world_12` | `world` | ...CABLE: three governments circulate a draft compute-verification treaty. No signatures yet... | none |
| `world_13` | `world` | ...handshake: a detached Canary-09 probe, still reporting a patrol nobody reads... | none |

## Fade-in timing, loop seams and headroom: three votes (#198)

Measuring the rendered signal (PR #197, "Measured signal" below) turned up facts that each
needed a decision. Three nexus option votes on 2026-11-17 decided them; each record binds the
artifact it changes. Nobody has listened to the result of any of them.

**Left open, deliberately.** The duck and fade ramps are still staircases of 25 ms volume
writes (#198 item 2: whether that is audible needs a listener; only the new loop dip uses a
finer step). The Android emulator's score rendering 3.0 dB below web and its late return after
a clip (items 5 and 6, findings 6 and 7 below) are not investigated here and stand as open.

### The fade-in starts when audio flows

**Vote** `vote-1794894551240-5hquxco` (artifact `src/app/musicController.ts`): 6 of 7 seats
chose `start-ramp-on-first-progress`. **Dissent, 1 seat (Scope Steward):** `accept-and-document`
until a listener hears the step as a defect, keeping the expected-failure test as a tripwire;
it added that if a gate is built it belongs as a start condition on the existing ramp, not a
second mechanism, which is how it was built.

**What changed.** `VolumeRamp.to()` takes an optional gate. A gated ramp waits at its starting
level, asking on every 25 ms step, and takes its first step on the tick the gate first opens.
The controller's gate (`audioFlowing`, `src/app/loopSeam.ts`) opens when the player's
position has moved from where it was when the start was asked for, or after
`FADE_IN_WAIT_MS` (1.5 s) of asking, so a player that never reports progress is not left
silent for good. `play()` still runs in the caller's stack; only the ramp waits. The
conditions the seats set, and where each is met:

- *A volume change or duck while held must not step to the target before sound.* A volume
  change bends the waiting ramp (`retarget`) and keeps the gate; a duck replaces it with a
  ramp that inherits the unopened gate. Unit-tested both ways.
- *Halt, release and remove clear the gate; a return from the background re-arms it.* The
  gate lives in the ramp's flight, which `cancel()` drops; every start builds a new one from
  the position at that moment, so a resume waits for the position to move on from where it
  paused.
- *Progress as a small unit beside the ramp, the controller under 400 lines.* The gate is a
  function in `loopSeam.ts`; the position is read through the player (`currentTime` on every
  platform) rather than through status events, whose 500 ms interval was the reason a prompt
  signal was not available.

**Measured** (web, `signal-transitions.audio.ts`, MP3 held back 700 ms): before, the score
started in one step of 0.30 (a 5 ms "fade"); after, it is first heard at 0.05 of its level
(one volume write) and rises over 435 ms in single-write steps. Ordinary starts measure
415 to 440 ms first-sample-to-level (before: 450 to 560 ms, because the first writes landed
before the audio). The old expected-failure case is now a positive test of the first audible
level and the steps after it. Android is not re-measured.

### A dip around the loop wrap, in the player

**Vote** `vote-1794894573488-8i55z3v` (artifact `assets/audio/music/tracks.json`): 5 of 7
seats chose `fade-in-player-around-the-wrap`. **Dissent, 2 seats (Catfish and Scope
Steward):** `report-and-ask-maintainer`, asking for loop-authored exports instead of adding
runtime behaviour to every score, and reconsidering a player fade only once someone hears a
click. That objection is not answered by the build: the dip is as unheard as the seam was.
The supplied files are byte-identical and `tracks.json` is unchanged.

**What changed.** `LoopSeam` (`src/app/loopSeam.ts`) reads the playhead four times a second
far from the end and every `SEAM_STEP_MS` (5 ms) in the last 450 ms, and sets a gain trim from
the position: down over `SEAM_FALL_MS` (75 ms) to reach its floor `SEAM_GUARD_MS` (30 ms)
before the end the player reports, and after the wrap back up with the position over
`SEAM_RISE_MS` (75 ms). The trim multiplies whatever level the ramp holds (`VolumeRamp.trim`),
so a duck, a fade or a volume change carries on underneath and the player hears their
product. It stops with the player (pause, background, release). A position read or a volume
write that throws inside its timer stops the watch and takes the same path as a ramp write
that throws: a live player fails visibly (`Playback unavailable`), a fading-out one is released
(panel round on PR #208, which found the write escaping the timer). Two things were found while
building it, both measured:

- **The floor is -60 dB, not zero.** With the dip going to exactly 0, Chromium restarted
  every score about 50 ms later than at any other level (the seam gained that much silence:
  65 ms past the decoded end for phase 0 against at most 21 ms otherwise). At 0.001 the
  restart is where it always was.
- **The steps had to be finer than the ramps'.** At 25 ms the dip was three steps each way,
  and on a tail that is still loud (phase 5) each step measured larger than the seam it
  replaced (-52.5 dBFS against -65.3 at the same level). At 5 ms it is about fifteen.

**Measured** (`signal-loops.audio-full.ts`, web, the same build measured three times; the
before column is `main` at `d481305` with the same test). The level changed between the two
(30% is 0.30 before and 0.18 after, see headroom), so the scale-free ratio is the one to
compare; add 4.4 dB to an after dBFS figure to put it at the old level.

| Phase | Step at the wrap, before -> after | Over the usual change, before -> after | Largest step in the 200 ms up to the restart, over the usual change, before -> after |
| ---: | ---: | ---: | ---: |
| 0 | -39.5 -> -104.0 dBFS | 39.5 -> -9.4 dB | 35.8 -> 15.9 dB |
| 1 | -63.2 -> -127.6 | 34.4 -> 0.7 | 32.0 -> 7.8 |
| 2 | -61.6 -> -74.1 | 17.6 -> 13.9 | 15.1 -> 15.8 |
| 3 | -48.6 -> -113.0 | 23.2 -> -14.4 | 43.1 -> 17.8 |
| 4 | -67.7 -> -132.2 | 32.9 -> -0.6 | 17.3 -> 8.8 |
| 5 | -60.9 -> -125.3 | 19.9 -> -19.9 | 43.4 -> 27.2 |

The step at the wrap is gone into the floor for every phase. Across the whole dip the
largest step is now one of the dip's own (a staircase step on the tail) or the music's: phase
0's falls from 35.8 to 15.9 dB above the usual change, and phase 2's is unchanged within
spread (its tail is quiet and its seam was already small). The test gates the wrap at
-65 dBFS and the window at 32 dB; the old build fails both. Whether the dip is audible as a
short gap is a listening question; Android's native loop is unmeasured.

### Headroom by one output scale

**Vote** `vote-1794894662564-fjodxnt` (artifact `src/app/voicePlayer.ts`): 6 of 7 seats chose
`headroom-by-output-scale`. **Dissent, 1 seat (Scope Steward):** `accept-and-document`, since
the overshoot is arithmetic, not a heard defect, and a constant trim is a one-line change at
the two level sites if listening ever shows distortion.

**What changed.** Both level sites, `MusicController.level()` and the voice player's
`level()`, multiply the preference by `OUTPUT_SCALE` (0.6, -4.44 dB, `src/app/outputLevel.ts`).
The scale is sized for the unducked sum, because the duck lands 200 ms after speech starts
and a fading-out score is never ducked: ceilings of 0.71 (scores) and 0.92 (clips, both tiers)
give 0.6 x 1.63 = 0.978, -0.19 dBFS, at 100% / 100% with nothing ducked. The ceilings are true
peaks, which answers the seats' point that sample peaks do not bound inter-sample peaks, and
`tests/audio-assets.spec.ts` fails if any committed file exceeds them. A seat's success
metric was the 30% / 30% default unchanged; it is not met, deliberately: a joint cap that
engages only near full scale would need each module to know the other's preference, and the
voice player is meant not to know the music controller. The default is 4.44 dB quieter, and
the balance between the two and the 0-100 controls are unchanged.

**Measured** (web, both at 100%, one clip over phase 1): before, -0.61 dBTP output mix with
no full-scale sample; after, -5.22 to -5.47 dBTP, the clip at -5.60 dBTP. The case now gates
the mix peak against the scaled worst case and full scale, and the clip against its scaled
ceiling, where it used to report the mix and gate only the clip. At 30% / 30% the score rests
at -14.89 dB against its file (was -10.46).

## Measured signal

Everything above was built on numbers that stand next to the sound: a mocked player's
arguments, a media element's `volume`, an Android track gain in `dumpsys`. This section is
what the **rendered samples** measure as. The method, its control measurement and how to
re-run it are in [TESTING.md](TESTING.md), "Audio signal measurement".

**None of it is a listening test.** Nobody has heard the score, a clip, a duck or a fade
through the app, and nothing here says whether any of it sounds good. The numbers below are a
baseline for the person who eventually listens.

**The tables below are the baseline from before #198.** The three changes above moved some of
them; the rest stand. Now, on the web build at 30% / 30%: every score and clip gain is 4.44 dB
lower (-14.89 dB against the file, 30% x `OUTPUT_SCALE`; 60% speech is -8.87 dB), and every
ratio (duck depth -9.12 dB, speech 60% over 30% 6.02 dB, speech-to-music 16.0 dB) is
unchanged; fade-ins measure 415 to 440 ms from the first sample, including a file held back
700 ms; the output true-peak estimate is -15.6 dBTP at 30% / 30% and -5.5 to -5.2 dBTP at
100% / 100%; the loop seams are in the table above. The Android rows were not re-measured.

| | |
| --- | --- |
| App code | web: `main` at `407aa6d` and, before a rebase, at `56d5cfe` (same results); Android: `56d5cfe`. The measuring branch changes comments only under `src/` |
| Web | production export (`make build-web`) served by `python3 -m http.server`, Playwright 1.65.1, Chromium headless shell 159.0.8154.6 (Chrome for Testing), Linux x86_64 |
| Web method | every media element routed through a 48 kHz `AudioContext` and tapped per element and at the output; real browser timers; gain read against the committed file in 5 ms blocks |
| Web runs | the `make e2e-audio` cases six times on an idle machine, three at each commit (the spread below), plus three while another Playwright suite ran (noted where it differed) |
| Android | release APK (test-signed) on the API 36 `google_apis` x86_64 emulator, QEMU `wav` audio backend, 44.1 kHz capture, media volume 15 of 15; once, by hand, 2026-11-16 |
| Files | ffmpeg 8.0.1, `tests/audio-assets.spec.ts` |

### Web build, music and speech at 30% unless stated

| What | Code or file says | Measured (six runs) | Test tolerance |
| --- | --- | --- | --- |
| Silence before the first gesture, after music off, after the ending, at volume 0, in the gap of a phase change | silence | every output sample exactly 0 | exactly 0 |
| Each phase score is its own file (correlation with the committed file; with the next phase's file) | the phase mapping | 1.0000 for all six; -0.02 to 0.10 | > 0.999; < 0.3 |
| Score gain against its file at rest | 0.30 = -10.46 dB | -10.46 dB, all six phases | +-0.05 dB |
| Score true-peak estimate at rest (first 1.3 s after the fade-in) | below 0 dBTP | -23.89 to -15.48 dBTP by phase | < 0 dBTP |
| Fade-in, first audible sample to the preference level | `FADE_IN_MS` 500, first write 25 ms after `play()` | 450 to 560 ms; largest jump 1 to 2 volume writes | 250 to 1000 ms; jump <= half the move |
| Fade-out, music off | `FADE_OUT_MS` 500 | 430 to 465 ms, staircase of 0.015 gain, then zeros | 400 to 1000 ms |
| Fade-out, ending | `FADE_OUT_MS` 500 | 455 to 460 ms, then zeros | 400 to 1000 ms |
| Score gain before / during / after a clip | 0.30 / 0.105 / 0.30 | -10.46 / -19.58 / -10.46 dB | +-0.05 dB each |
| Duck depth | `DUCK_RATIO` 0.35 = -9.12 dB | -9.12 dB | +-0.05 dB |
| Duck down and back up, first change to resting level | `DUCK_RAMP_MS` 200, eight writes, first after 25 ms | 175 to 185 ms each way; largest step 1.6 to 1.8 dB (the last one, into the ducked level) | 150 to 400 ms; step <= half the move |
| When the duck starts, relative to the first speech sample | at the press | from 21 ms before to 17 ms after (33 ms before in an earlier run) | reported |
| When the score starts back, after the last speech sample | at the clip's end | 20 to 32 ms | reported |
| Speech gain against its clip file | 0.30 = -10.46 dB | -10.46 dB (correlation 1.0000) | +-0.05 dB |
| Speech at 60% against speech at 30%, music off | 6.02 dB | 6.02 dB; -4.44 and -10.46 dB absolute | +-0.05 dB |
| Speech with music off | signal, and no score element | signal; the output is the clip and nothing else, zeros after it | exact |
| Speech-to-music ratio while a clip talks (`ambient_05` over the first seconds of phase 1) | about 9 to 12 dB from whole-file levels | 15.9 to 16.1 dB (speech -24.9 dBFS RMS, ducked score -40.9) | speech above score |
| Output is the sum of the tapped elements | | sample-exact (difference < 1e-6) | < 1e-6 |
| Output true-peak estimate, both at 30% | | -11.4 to -11.1 dBTP | < 0 dBTP |
| Output true-peak estimate, both at 100% | | -1.0 to -0.6 dBTP, no sample at full scale | reported |
| Phase change: samples where both scores have signal | never two at once | 0 | exactly 0 |
| Phase change: silence between the old score and the new | a cut, then a fade-in | 32 to 117 ms of zeros; old score at full gain to its last 5 ms; new one fades in over 440 to 465 ms | old stops before new starts |
| One `volume` write, in the samples | | a single step within 1 ms | <= 5 ms |

The speech-to-music figure is high because the passage is: the first seconds of the phase 1
score are quieter than the file as a whole. From whole-file RMS, at equal preferences and
ducked, the fourteen bundled clips sit 8.6 to 12.0 dB above the six scores
(`tests/audio-assets.spec.ts`).

On a busy machine the same build measured fade-ins of 450 to 590 ms with up to four volume
writes landing in one 5 ms block (a jump of 0.06 in gain, a fifth of the fade), and passed.
The main thread does not bunch them: Chromium drops the interval ticks a stalled main thread
missed, and a ramp counts steps, so a busy main thread only stretches it. Writes land together
in the samples when the output stops pulling samples for a while and the ramp goes on writing
in real time (#244); the specs read ramps on the render clock for that reason
([TESTING.md](TESTING.md), "Clocks").

### Findings

1. **A ramp is a staircase, and each step is a step.** Chromium applies a `volume` write to
   the very next samples on this path, so the 200 ms duck is eight instantaneous gain steps
   25 ms apart and a 500 ms fade is twenty. The largest duck step is 1.8 dB. Whether that can
   be heard as a zipper is a listening question; the constants were left alone.
2. **The fade-in is timed from the request, not from the first sample.** On web the first one
   or two writes happen before the file produces audio, so the audible fade starts at 1.5% to
   3% and is 450 ms rather than 475. If the file arrives later than `FADE_IN_MS`, the score
   starts at full level in one step: with the MP3 held back 700 ms, a single 0.30 jump was
   measured (`signal-transitions.audio.ts`, kept as an expected failure). On the Android
   emulator, of two starts captured, one rose over about 480 ms and the other was at full
   level within 40 ms of its first sample. **Not fixed here:** expo-audio's web player reports
   `playing` at the request, before any data, and its first position update arrives after
   `updateInterval` (500 ms), so the app has no prompt signal to start the fade on; starting
   it on the first status with a position would hold the score silent for up to half a second.
   That is a design decision, and it needs a phone to judge. **Decided and changed since**
   (#198, "The fade-in starts when audio flows" above): the ramp now waits for the position
   to move, read directly rather than from status events.
3. **The old loop check never played the tail.** The suite's static server ignores `Range`, so
   media were unseekable and the seek to the tail landed on 0 (`seekable` was `[0, 0]`).
   Fixed: `music.e2e.ts` serves ranges and asserts the seek held; before the fix that
   assertion reads 0 where it needs more than 135.6.
4. **The loop seams are measurable discontinuities** (next table). They are properties of the
   supplied files, which were not altered. Since #198 the player dips its gain around each
   wrap, and the files are still not altered ("A dip around the loop wrap" above).
5. **At 100% and 100% the mix can clip in principle.** Loudest clip true peak 0.88 plus the
   ducked loudest score 0.35 x 0.70 is +1.0 dBFS, and +4.0 dBFS in the 200 ms before the duck
   lands. One clip was measured at -0.6 dBTP with no sample at full scale; whether peaks ever
   coincide depends on the passage. At the 30% defaults the worst case is -6.4 dBFS. **Changed
   since** (#198, "Headroom by one output scale" above): both levels are scaled by 0.6, so
   the worst case at 100% / 100% before the duck lands is -0.19 dBFS.
6. **On the Android emulator the score comes out 3.0 dB lower than on web.** Its gain against
   its file is 0.212 (-13.48 dB) where 30% is 0.300 and web renders 0.300; the clip, in the
   same capture, is at 0.300. So speech sits 3 dB further above the score there. The cause was
   not established (it is per track, before the mixer: the capture is still stereo), and an
   emulator is not a phone.
7. **On the Android emulator the score returns late.** It stayed at the ducked level for about
   a quarter of a second after the clip's last sample (20 to 32 ms on web), consistent with
   the clip player's 250 ms status interval, and the duck was fully down about 280 ms before
   the first speech sample because the clip takes that long to start.

### Loop seams

The scores are whole pieces that end and restart, not authored loops. `tracks.json` pins the
bytes; this is what looping them does. From the files (`tests/audio-assets.spec.ts`):

| Phase | Jump, last sample to first | Jump over the usual sample-to-sample change | Last 50 ms | First 50 ms | Spectral difference across the seam (usual between neighbours) |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | -27.8 dBFS | 38.0 dB | -36.4 dBFS | -69.1 dBFS | 30.3 dB (4.5) |
| 1 | -47.6 | 34.7 | -63.6 | -58.3 | 13.8 (3.3) |
| 2 | -51.6 | 17.0 | -42.2 | -49.6 | 27.6 (4.7) |
| 3 | -37.2 | 21.6 | -35.4 | -67.1 | 31.8 (5.7) |
| 4 | -57.5 | 33.6 | -73.9 | -52.9 | 12.9 (6.8) |
| 5 | -53.8 | 15.0 | -36.7 | -53.1 | 34.4 (6.1) |

As rendered by Chromium at 30% (`signal-loops.audio-full.ts`): the element stops 9 ms short of
the decoded end (phase 0) or plays 4 to 21 ms past it (the others), inserts 3.6 to 11.6 ms of
exact silence, and restarts from the file's first sample, with correlation 1.0000 on both
sides. The largest sample jump at the seam is -39.5 dBFS for phase 0 (39 dB above the usual
change before it), -48.6 for phase 3, and -60.9 to -67.7 for the rest.

**Phase 0 is the one to listen to**: its file ends mid-decay, 28 dB below full scale, and the
loop steps from there to silence. A vote chose the player-side remedy over a derived file
("A dip around the loop wrap", above): the player still loops with `loop = true` and dips its
own gain around the wrap, which needed no hand looping because the position can be read. The
as-rendered numbers in the paragraph above are the baseline; the before/after table is there.

### Android emulator, release build

| What | Measured |
| --- | --- |
| The score is its own file | correlation 0.9999 (phase 0) and 0.9996 (phase 1) with the committed file |
| Score gain at rest | 0.212 = -13.48 dB at media volume 15 of 15 (-46.1 dB at 5 of 15); see finding 6 |
| Clipping | none: peak -10.7 dBFS with a clip over the score |
| Start | one of two faded in over about 480 ms; the other was at full level within 40 ms |
| Music off | a monotone fade over about 650 ms, then digital silence |
| Duck depth while a clip talks | to 35% of the level before it (-9.1 dB), read after the clip and between syllables |
| Duck down / back up | about 240 ms / about 280 ms |
| Clip gain against its file | 0.300 = -10.45 dB (`ambient_10`) |
| Not measured there | a phase change, the ending, speech levels other than 30%, the loop, anything twice, and nothing after #192 (released players, media session) |

### What is still not known

- **How any of it sounds.** Whether the duck is deep enough, the ramps smooth, the steps
  audible, the seams objectionable, the voice intelligible, the levels comfortable.
- **Speakers and ears.** A phone speaker's response, headphones, a room.
- **A physical device.** Everything native above is one emulator session.
- **iOS and Safari**, in any form; and Chromium's direct element-to-device path, which the
  capture replaces with Web Audio (the control shows the level is unchanged, not that
  sub-millisecond behaviour is).
- **Each native number's repeatability.** They were taken once.

## Limits, stated rather than implied

Since this list was first written the rendered signal has been measured, on the web build
by automated test and once on an Android emulator ("Measured signal" above). So each limit
below now says what is measured and what is not. What no entry can say is how anything
sounds: nobody has listened. Native (Android) results are one emulator session, not a
physical device, and iOS is untouched.

The earlier emulator run (REVIEW-ANDROID-EMULATOR-2026-11-16.md), which read playback state
rather than samples, found that audio controls stop working after a system font-size change
while the app is open, and that a removed player is not released until garbage collection on
Android. The first of those is fixed (#185; the dated note under finding 1 of that review says
how and what the emulator re-run did and did not show). The second is addressed: a clip's player
is now released, not only removed, when the clip ends, is stopped or is replaced
(`releasePlayer`; #186 item 1), seen on an emulator for the score's player and not for a
clip's. A clip that something outside the app pauses on Android (a headset key landing on
the clip's own media session) now ends like a stop, so the score comes back up. What media
keys do, and what a lock screen shows, is in [SOUNDTRACK.md](SOUNDTRACK.md).

**A held clip ends. This is intended.** On Android a READ clip that has been heard playing
ends the moment anything outside the app holds it, and it does not resume:

- the platform pausing every player as the app leaves the foreground,
- a transient loss of audio focus (a notification sound, a call, another app's audio),
- a headset or keyboard pause key landing on the clip's own media session.

All three reach JavaScript as the same status, "not playing", and the app cannot tell them
apart. There is no in-app pause for a clip, so nothing could ever resume one; a clip left
held would keep the score ducked under silence. So the clip is released, the score comes
back up, and pressing READ plays the line again from the start. A report of "not playing"
before the clip has been heard is not a hold (every player sends one while it prepares) and
is ignored. Web and iOS do not do this: there, "not playing" is also what buffering looks
like (`heldBy` in `src/app/pauseSignal.ts`). The cost is accepted: a one-second focus loss
ends a clip that could have continued. Test: `tests/app-voice-player.spec.ts`, "on Android
ends a READ clip that has been heard as soon as anything outside the app holds it…". Seen
on no device: the three causes are known from how Android and the library behave, and only
the status they produce is exercised.

- **Playback produces the right signal on web; nobody has heard it.** Unit tests run against
  a mocked player, which proves which clip is handed over and that a second press cancels the
  first. On web, `tests/e2e/voice-playback.e2e.ts` proves the bundled clip is requested after
  a press and not before, and `tests/e2e/signal-speech.audio.ts` proves the samples that come
  out are that clip (correlation 1.0000 with the committed file) at the speech level. On the
  Android emulator a clip was captured at the expected level once. No clip has been heard
  through the app, and a physical device is unexercised. The Scope Steward's objection, that
  nobody had confirmed the audio plays at all, is answered for signal and stands for ears.
- **The duck depth is measured, not judged.** `DUCK_RATIO` is 0.35 on reasoning (two sources
  at about the same loudness, a conventional music-under-speech gap), not on listening. On
  the web build the rendered score drops by -9.12 dB while a clip talks and returns to
  -10.46 dB after it, and on the Android emulator it dropped to 35% as well. Whether that is
  the right depth nobody has heard; the emulator also rendered the score 3 dB lower than the
  clip to begin with ("Measured signal", finding 6). Browsers on iOS ignore programmatic
  volume altogether, so there the score will not duck at all.
- **The ramps are measured as staircases, and unheard.** `DUCK_RAMP_MS` (200 ms),
  `FADE_OUT_MS` and `FADE_IN_MS` (500 ms each) are defaults nobody has listened to. In the
  web build's rendered signal a duck takes 175 to 185 ms in eight instantaneous steps, a
  fade-out 430 to 465 ms in twenty, and a fade-in 450 to 560 ms; whether a linear ramp in
  25 ms steps sounds smooth or audibly stepped is still unknown. Two limits came out of
  measuring: a stalled output lands several writes in one 5 ms block of samples (four were
  seen; the main thread drops late ticks rather than bunching them, #244), and a start whose file arrived after `FADE_IN_MS` was a step, not a fade (finding 2;
  fixed in #198 for a file up to `FADE_IN_WAIT_MS` late, measured on web only). The loop dip
  is a staircase too, of 5 ms steps, and equally unheard. The element-level specs (`tests/app-volume-ramp.spec.ts`, `tests/app-music-ramps.spec.ts`,
  `tests/app-music-fadeout.spec.ts`, `tests/e2e/music-ducking.e2e.ts`,
  `tests/e2e/phase-music.e2e.ts`) still pin the sequence of levels on a stepped clock. On iOS
  browsers no ramp happens at all, and there switching music off costs a 500 ms delay with
  nothing audible to show for it. On the Android emulator a fade-out took about 650 ms and a
  duck about 240 ms down and 280 ms up; a phone has not been tried.
- **Safari is unverified, in both directions.** The phase-change `play()` was kept inside the
  press because a deferred one might be refused by WebKit's gesture policy; nobody has run
  this on Safari to learn whether it would have been, or to confirm that the in-gesture
  `play()` is accepted there (it is the same call the app made before ramps, and that was
  not qualified on Safari either). A wipe forced by the simulation rather than pressed has
  never had a gesture behind its `play()`, before or after this change.
- **The speech level is measured, not judged.** On the served web build a clip at 60% comes
  out 6.02 dB above the same clip at 30%, each at exactly the gain the preference implies,
  and with music off the output is the clip and nothing else. Nobody has listened to speech
  against the score at unequal levels, and the native path for speech with music off,
  including the session READ prepares for itself, has been seen only as playback state.
- **A failed clip is released on web by test, on native by reading.** expo-audio 58.0.12
  reports a failure as a status with `error` set and no `didJustFinish`. On web that is the
  media element's `error` event and a rejected `play()` (`AudioPlayer.web.ts`), and
  `tests/e2e/music-ducking.e2e.ts` feeds the real player a 404 and watches the score return
  to the preference level. On Android it is `onPlayerError` (`AudioPlayer.kt`) and on iOS the
  item's `.failed` status (`AudioPlayer.swift`); both were read, neither was run. Android
  forwards the exception's message as the `error` value, so an exception with no message
  would arrive as a status this code cannot tell from a healthy one.
- **A stalled clip still holds the duck.** A clip that neither loads nor fails emits no status
  on any platform, so nothing releases it: the same e2e holds the clip request open and the
  score stays ducked for as long as it is held. The clips are bundled local files, so this
  needs a broken or very slow asset fetch on web and should not arise on native. Nothing was
  built for it, because the remedy is a timer in `src/app`. The smallest one would be a
  single timeout armed in `playVoiceClip` and cleared by the first status and by `release`,
  which stops the clip if no status has arrived at all.
- **Loudness is peak-normalised, not loudness-normalised, and the measured spread is small.**
  Each take is scaled to a 0.92 (vibration) or 0.95 (clean) sample peak, with no loudness
  target. Measured on the committed files with ffmpeg 8.0.1 (EBU R128, measurement only —
  nothing is rewritten):

  ```bash
  ffmpeg -hide_banner -nostats -i <file> -af loudnorm=print_format=json -f null -
  ```

  reading `input_i` (integrated loudness) and `input_tp` (true peak) from the JSON:

  | Set | Files | Integrated, quietest to loudest | Spread | True peak |
  | --- | ---: | --- | ---: | --- |
  | `voice/vibration/` | 14 | -15.50 to -14.08 LUFS | 1.42 LU | -1.17 to -1.09 dBTP |
  | `voice/clean/` | 14 | -15.13 to -13.51 LUFS | 1.62 LU | -0.93 to -0.73 dBTP |
  | `music/phase-*/` | 6 | -15.77 to -14.66 LUFS | 1.11 LU | -4.22 to -3.04 dBTP |

  So voice and music sit at about the same loudness as files: every one of the 34 is
  between -15.77 and -13.51 LUFS. That is a statement about the encoded files, before the
  player's volume setting, and about level only. Nobody has auditioned the clips, and a
  regenerated take will measure differently, so re-run the command when the assets change.
- **`Serena` was chosen arbitrarily.** The model offers ten English voices; the fiction may
  want a different one, or more than one for different speakers.
- **No listening test of the clean tier against the vibration tier**, and no decision recorded
  on how much fidelity the upgrade should buy.
