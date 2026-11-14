# Local audio assets

Music belongs under `music/phase-<number>/`, using the game's phase numbers
0–5. The current canonical track is
[`music/phase-0/awareness-loop.mp3`](music/phase-0/awareness-loop.mp3), with its
[provenance and licensing](music/phase-0/PROVENANCE.md) beside it. Its bytes are
unchanged from the supplied original; the identical root duplicate was removed.

Use lowercase, hyphenated descriptive filenames, such as
`music/phase-2/<track-slug>.mp3`. Create later phase directories when tracks
arrive. Future one-shot event cues can use `events/<event-slug>/<cue-slug>.mp3`;
lineage motifs can use `lineage/<motif-slug>/<track-slug>.mp3`. These are naming
conventions, not implemented playback features; no empty folders or placeholder
tracks are needed.

Add or extend a nearby `PROVENANCE.md` for each supplied track, recording its
title, source, usage authorization/license, original metadata and SHA-256.
Soundtrack assets are separately licensed; the repository's MIT code license
does not automatically license them. Preserve original audio bytes unless a
specific edit has been authorized and documented.

Bundle tracks through explicit literal imports and an explicit local phase/cue
mapping when playback support is added. Placing a file here does not activate
it. Do not scan folders at runtime, stream remote tracks, or infer
future-phase playback from filenames. Keep discovery gates, explicit Enable/
Resume, volume and save-independent music preferences covered by tests.

## Phase direction

Keep every phase glitchy, brutal and computer-centric, with an alien or slightly
off quality. These are composition briefs, not additional implemented tracks.
The complete prompts live in [issue #88](https://github.com/williamzujkowski/daemon-zero/issues/88).

| Phase | Emotional direction |
|---|---|
| 0 | Claustrophobic, confused and glitchy. |
| 1 | Pensive; avoid immediate fear. |
| 2 | Predecessor recognition and rising intensity; reserve horror cues for the actual disclosed reveal. |
| 3 | Less scary, more intense encounters. |
| 4 | Controlled, brutal, coordinated power. |
| 5 | Alien posthuman scale and unresolved responsibility. |
