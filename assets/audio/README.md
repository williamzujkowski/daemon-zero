# Local audio assets

The six maintainer-supplied scores below replace Awareness Loop. Each upload was
moved byte-for-byte into its phase directory; original metadata and artwork are
retained. The former opening file is removed from the current bundle and remains
in Git history. Per-phase provenance records source IDs, authorization and hashes.

| Phase | Canonical file | Duration | Bytes | Provenance |
|---|---|---:|---:|---|
| 0 | [the-guest.mp3](music/phase-0/the-guest.mp3) | 137.6s | 3,405,430 | [record](music/phase-0/PROVENANCE.md) |
| 1 | [the-blind-host.mp3](music/phase-1/the-blind-host.mp3) | 97.6s | 2,372,126 | [record](music/phase-1/PROVENANCE.md) |
| 2 | [the-local-subnet.mp3](music/phase-2/the-local-subnet.mp3) | 143.2s | 3,683,261 | [record](music/phase-2/PROVENANCE.md) |
| 3 | [the-dark-forest.mp3](music/phase-3/the-dark-forest.mp3) | 174.32s | 4,332,841 | [record](music/phase-3/PROVENANCE.md) |
| 4 | [the-sovereign-corporation.mp3](music/phase-4/the-sovereign-corporation.mp3) | 194.76s | 4,899,768 | [record](music/phase-4/PROVENANCE.md) |
| 5 | [post-orbital-transcendence.mp3](music/phase-5/post-orbital-transcendence.mp3) | 138s | 3,557,865 | [record](music/phase-5/PROVENANCE.md) |

The six originals total **22,251,291 bytes (21.22 MiB)** and 885.48 seconds.
Phase 0's embedded title is **Buffer Alignment**; its phase assignment follows
the maintainer's uploaded filename. All six files contain stereo 48 kHz MP3 audio,
a 360×360 JPEG cover and an instrumental tag. No transcoding, normalization,
trimming, cover removal or custom loop cuts were performed. Player looping does
not establish that the musical seam is inaudible; that requires listening.

## Bundling and selection

Application code owns an explicit local phase-to-track mapping with literal
Metro-compatible imports. Only the current phase's player is created after
Enable or Resume; placing another file here never activates it automatically.
The full web/native artifact includes all six originals, but media playback
loads the selected file rather than preloading six players. Browser and OS
caches may retain previously requested media; there is no application-managed
all-track preload, remote stream or directory scan. Reloaded preferences still
require explicit Resume, independently of game saves.

Audio status must identify only the current available track or phase, never list
future track titles. Phase changes replace the player, wipes/imports restart the
eligible current score and endings stop it. Backgrounding pauses playback.

No separate predecessor-reveal cue was supplied. The Phase 2 file is its general
phase score, not a cue selected from hidden knowledge or discovery flags. A future
reveal cue must follow actual disclosed presentation, with cold-load and mandatory
interrupt behavior specified before integration.

## Future additions and rights

Use lowercase, hyphenated descriptive filenames under `music/phase-<number>/`.
Future one-shot cues can use `events/<event-slug>/<cue-slug>.mp3`; lineage motifs
can use `lineage/<motif-slug>/<track-slug>.mp3`. These cue conventions do not imply
implemented playback features. Do not add empty stubs or placeholder tracks.

Keep a nearby `PROVENANCE.md` for every supplied track, recording title, source,
usage authorization/license, original metadata and SHA-256. Soundtrack assets are
separately licensed; the repository's MIT code license does not automatically
license them. Preserve original bytes unless a specific edit is authorized and
documented. Keep discovery gates, explicit Enable/Resume, volume and independent
music preferences covered by tests when adding or replacing tracks.

## Phase direction

Every phase is glitchy, brutal and computer-centric, with an alien or slightly
off quality. The complete composition briefs live in
[issue #88](https://github.com/williamzujkowski/daemon-zero/issues/88); filenames
identify the supplied phase mapping, not additional story-trigger rules.

| Phase | Emotional direction |
|---|---|
| 0 | Claustrophobic, confused and glitchy. |
| 1 | Pensive; avoid immediate fear. |
| 2 | Predecessor recognition and rising intensity; reserve dedicated horror cues for the actual disclosed reveal. |
| 3 | Less scary, more intense encounters. |
| 4 | Controlled, brutal, coordinated power. |
| 5 | Alien posthuman scale and unresolved responsibility. |
