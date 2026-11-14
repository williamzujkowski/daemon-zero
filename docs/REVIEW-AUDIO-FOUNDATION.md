# Optional soundtrack foundation — #88

Historical PR #93 evidence. Six supplied phase scores replace the opening asset
and eligibility below; see REVIEW-PHASE-MUSIC.md and assets/audio/README.md.

This slice adds optional, offline Phase 0 music through SDK-compatible
`expo-audio` 58.0.12, installed using Expo's SDK resolver and pinned exactly.
MENU → Audio offers Music On/Off, Resume and numeric 0–100% volume in 10% steps.
The default is silent, at a retained listening level of 30%. A saved On preference
still requires explicit Resume after each cold launch. The page distinguishes
actual playback, muted playback, paused/blocked startup and phases without tracks.
No additional always-visible terminal panel or narrative disclosure is introduced.

The supplied Awareness Loop is bundled unchanged. Its metadata, hash, paid-plan
confirmation and separate asset licensing are in [the original provenance](https://github.com/williamzujkowski/daemon-zero/blob/69926ee/assets/audio/music/phase-0/PROVENANCE.md).
The original local root MP3 remains untouched and untracked. Measured peak is
−3.8 dBFS and mean is −16.8 dBFS (`ffmpeg` volumedetect); no normalization or loop
edit was made. The file is 3,998,691 bytes and 182.4 seconds long.

## Controller and safety boundaries

One app-owned controller lives above the terminal restore key. It lazily loads
one player after activation, loops only in the opening phase, pauses in the
background, releases on teardown, and stops on phase exit or ending. Wipe/import
restart the current eligible loop rather than visiting intermediate phases.
Readiness, phase, iteration, ending and restoration identity are the only game
subscription inputs that reach the backend. Ordinary game ticks do not cause
player calls. Removed-player events and obsolete preparation failures cannot
replace the current playback state; delayed preparation reconciles the latest run.

Preferences use strict bounded JSON in `daemon-zero.audio.v1`, separate from the
engine save. Invalid settings fall back to silence. Read/write failures explain
that changes may apply only to this session. A rejected browser start surfaces a
Resume action without an unhandled promise or fictitious playing state. Saves,
imports and fresh starts never carry or delete these presentation preferences.

Microphone permission, Android recording, background playback and background
recording are explicitly false in Expo config. Runtime capture/background flags
are false, device mute is respected, and no lock-screen service or runtime music
request exists. Source content, engine, balance, save schema and their gates are
unchanged. Existing text/waveform Audio is still a narrative widget, independent
of this instrumental score.

## Verification

`mise exec -- make verify-full` passes with 489 tests and unchanged coverage,
pacing and security gates. Production E2E passes 80/80 at root and 80/80 under
the real `/daemon-zero/` Pages prefix. Audio asset requests use that prefix.

- Controller, preference, Expo adapter and menu tests cover default silence,
  explicit enable/resume, mute/volume, malformed/bounded preferences, read/write
  failures, lifecycle cleanup, actual/blocked status, phase/ending, import/wipe,
  flat tick behavior, obsolete player events and asynchronous preparation races.
- Production Chromium E2E covers real playback, persisted On/20% preferences,
  silent reload and explicit Resume; a deliberately rejected media play request
  recovers through the UI with no warning/error console messages. Existing
  transmission-history E2E remains intact.
- Headed Chrome review at 390×844, 1440×900 and 320×844 with doubled menu text
  found no horizontal overflow. The menu remains scrollable and controls are
  reachable; normal music toggle height is 44 CSS px. Screenshots are PR artifacts,
  not repository files. A natural 182.4-second Chrome playback wrapped from over
  181 seconds to under one second while remaining playing; no seek shortcut was
  used to qualify repetition. Real media currentTime advances and the original cached
  asset continues playing after the browser is switched offline. Simulated
  pagehide/pageshow pauses and resumes; this is not a natural browser lifecycle
  qualification. A guest card's render counter stayed 1→1 across 3.1 live seconds.
- Actual Android Expo Go boot, On/Off, numeric volume, Home/background and return,
  cold relaunch retaining On/20% with silent paused status, and explicit Resume
  passed. Android `dumpsys audio` records Expo Go's stereo 48 kHz media AudioTrack
  starting, then pausing on Home. The existing SQLite database and journal were
  restored byte-for-byte with SHA-256 verification; font scale restored to 1.0.
  The maintainer's Metro process on 8081 was retained.
- Independent local read-only review identified delayed preparation races; both
  are fixed with regression tests. The requested external Nexus Gemini/AGY review
  failed with RESOURCE_EXHAUSTED/429 and provides no review evidence.

No claim of human listening or musical seam/fatigue approval is made: the agent
observed playback and platform output state, not sound with human ears. Physical
Android, standalone soundtrack playback, airplane-mode native cold playback,
headset disconnect, native silent-mode behavior, iOS/Safari and screen readers
were not qualified in this slice. Browser offline checking covers the already
loaded asset, not an offline-first cold launch/service worker.

Later-phase assets, crossfades, predecessor-reveal variations and manual speech
remain follow-ups in #88. No future-phase track or reveal cue is played early.
