# Six supplied phase scores

Issue #100, following #88; baseline `69926ee`. Six maintainer-supplied originals
replace Awareness Loop. Canonical paths, source metadata, existing paid-plan
project authorization and SHA-256 values are in assets/audio/README.md and its
per-phase provenance. The six originals total 22,251,291 bytes (21.22 MiB),
885.48 seconds. No transcoding, normalization, cuts or artwork removal occurred.
Phase assignment follows upload filenames; Phase 0's embedded title is Buffer
Alignment. The old track remains in Git history and is absent from the bundle.

`musicSources.ts` contains six literal Metro-compatible imports. `musicTracks.ts`
accepts only public phases 0–5. The backend receives exactly the selected phase;
one player loops its source. Phase changes remove the old player before creating
the current one. Wipes/imports restart the current score, endings release it,
backgrounding pauses it, and teardown releases it. Pending initialization
reconciles the latest phase/run/background state; obsolete activation failures
and removed-player callbacks cannot change a newer player’s status.

Preferences and per-launch activation remain independent of game saves. Cold
launch still requires Enable/Resume, including after an enabled preference was
retained. The Audio menu reports only “phase N score” for the current phase,
avoiding embedded narrative titles and future track lists. Muted, paused,
loading and recoverable error states remain explicit. No separate predecessor
reveal cue was supplied: Phase 2 is its normal score, not a hidden-flag cue.
Future reveal music must follow actual disclosed presentation.

The exported artifact includes all six originals; the app creates no player or
media request before activation, and creates only the current phase’s player.
Static imports register local assets, not six simultaneous playback/download
requests. Browser/OS caching may retain previously requested media. No all-track
preloader, service worker, remote stream or directory scan was added. A web
cold visit or uncached phase needs its host/browser cache; this change does not
promise that uncached future tracks are already available offline. Native
release packaging includes local sources; Expo Go uses its development asset
server/cache and does not establish signed-build offline qualification.

No engine, content, balance, schema, persistence format, dependency, recording
capability, background playback or lock-screen controls changed.

## Verification

`mise exec -- make verify-full` passes: 501 unit tests, unchanged strict/lint/
coverage/content/pacing gates, production export, security scans and SBOM. App
statement/branch coverage is 99.08% / 95.39%. Unit tests cover every phase, exact
asset hashes, one-player ownership, pending preparation across several phase/
background changes, stale listener/failure rejection, wipes/imports, endings,
silent retained preferences and explicit retry.

Production E2E passes 104 cases. New real-media checks cover all six sources:
zero MP3 requests before Enable, only the current phase requested afterward,
one decoded advancing looping media element, expected duration, deployment-base
URL and full downloaded-body SHA-256/size. Live purchases switch 0→1 and 4→5
with one active player. Phase 0 wraps after seeking near its end and restarts
from the browser's existing cache offline; this is not a natural full-duration
loop or an offline cold-launch qualification. Existing save/menu/audio gates
remain intact. CI repeats these cases under the GitHub Pages base path.

Visible Chrome Audio views pass for all six phases at 390x844 and 1440x900:
current-phase status, no future title list, no media request before activation,
only current-phase media after activation, no console errors/warnings or
horizontal overflow, and control bounds at least 44px. Final screenshots are
PR attachments, not repository assets. Independent read-only review found no
blockers in phase selection, callback/activation guards or disclosure.

Actual Android Expo Go Phase 0 and Phase 5 playback produced stereo 48 kHz
media AudioTracks with advancing server frames (114240→187136 and
144704→217600). A cold Phase 5 launch retained On/20% without autoplay; Resume
started that phase’s player, and SQLite retained the separate On/20% preferences.
A bounded extra relaunch attempt ended before its check completed. Live native
phase transitions and a new Home/foreground cycle were not qualified here; the
production browser covers live 0→1/4→5 and unit tests cover lifecycle races.
The original scoped
SQLite database/journal and font setting were restored with hash verification.
The original 8081 Metro server disappeared during verification; a fresh owned
Metro on 8082 used the same confirmed scope key. Early failed starts showed the
recoverable paused/error state while the lazy backend could not reach Metro;
no source change was needed to restore playback. Native automation also met
Expo Go's overlapping Tools control, OCR and partial screenshot limitations;
these checks establish output/prefs, not complete native optical UI qualification.

No human listening, seam/fatigue approval, physical Android, iOS, signed native
build, screen reader or new full human campaign qualification is claimed.
