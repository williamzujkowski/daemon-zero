# Local audio assets

The six maintainer-supplied scores below replace Awareness Loop. Each file's
**audio stream is the supplied one, bit for bit**; its container tags are not
(see "What is preserved" below). The former opening file is removed from the
current bundle and remains in Git history. Per-phase provenance records source
IDs, authorization, the hashes of both the supplied and the shipped file, and
the supplied tags.

| Phase | Canonical file | Duration | Bytes | Provenance |
|---|---|---:|---:|---|
| 0 | [the-guest.mp3](music/phase-0/the-guest.mp3) | 137.6s | 3,376,974 | [record](music/phase-0/PROVENANCE.md) |
| 1 | [the-blind-host.mp3](music/phase-1/the-blind-host.mp3) | 97.6s | 2,350,638 | [record](music/phase-1/PROVENANCE.md) |
| 2 | [the-local-subnet.mp3](music/phase-2/the-local-subnet.mp3) | 143.2s | 3,655,806 | [record](music/phase-2/PROVENANCE.md) |
| 3 | [the-dark-forest.mp3](music/phase-3/the-dark-forest.mp3) | 174.32s | 4,307,934 | [record](music/phase-3/PROVENANCE.md) |
| 4 | [the-sovereign-corporation.mp3](music/phase-4/the-sovereign-corporation.mp3) | 194.76s | 4,869,918 | [record](music/phase-4/PROVENANCE.md) |
| 5 | [post-orbital-transcendence.mp3](music/phase-5/post-orbital-transcendence.mp3) | 138s | 3,530,670 | [record](music/phase-5/PROVENANCE.md) |

The six shipped files total **22,091,940 bytes (21.07 MiB)** and 885.48 seconds;
the six supplied originals totalled 22,251,291 bytes. All six contain stereo
48 kHz MP3 audio. No transcoding, normalization, trimming or custom loop cuts
were performed. Player looping does not establish that the musical seam is
inaudible; that requires listening.
The seams are measured, in the files and as rendered, in
[docs/VOICE-CLIPS.md](../../docs/VOICE-CLIPS.md) ("Loop seams"): each loop is a
piece ending and restarting, and Phase 0's file ends mid-decay, 28 dB below
full scale, which is the seam most likely to tick.

## What is preserved, and what was changed

**Preserved: the audio stream, bit for bit.** In each shipped file every byte from
the first MPEG frame to the end of the file is the supplied one, including the
Xing/LAME frame that carries the encoder delay and padding. Each PROVENANCE.md
records the proof: identical compressed packets, identical decoded PCM with the
same sample count, and unchanged duration, sample rate, channels and bit rate.

**Changed on 2026-11-17: the container tags** (issue #193; nexus option vote
`strip-tags-and-set-neutral-tags`, 7 of 7 seats, record
`vote-1794891913762-bfqvn7c`). As supplied, each file carried an ID3v2.4 tag with
a title (phase 0: "Buffer Alignment"; phases 1 to 5: the phase's name and a
line about its story), the Suno account label as artist, a Suno URL and
comments, an `[Instrumental]` lyrics frame, a 360×360 JPEG cover and a C2PA
manifest. On Android the media session shows a bundled file's own tags, so
those reached Bluetooth and car displays, against the rule that phase names stay
hidden until found. Each file now carries one ID3v2.3 tag with exactly three
frames, the strings the app itself publishes: title `Phase N score`, artist and
album `DAEMON // 0`. No artwork and nothing else. `tests/score-tags.spec.ts`
fails if a bundled score carries any other tag.

The supplied files are not in the current tree; they are in Git history, and
each PROVENANCE.md gives the supplied file's SHA-256 and size so the
maintainer's own export can be recognised and put back.

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
license them. Preserve the supplied audio stream exactly; the only edit made to a
supplied file is the neutral tag above, written by
`scripts/neutral-score-tags.ts` (docs/SOUNDTRACK.md has the checklist). Any other
edit needs to be authorized and documented. Keep discovery gates, explicit Enable/Resume, volume and independent
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
