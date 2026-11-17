# Phase 4 soundtrack provenance

`the-sovereign-corporation.mp3` is the maintainer-supplied Phase 4 score, provided for
this game's soundtrack replacement on 2026-11-14. Its phase assignment follows
the uploaded filename, `Phase 4 — The Sovereign Corporation_ coordinated power.mp3`.

The maintainer's existing paid-Suno-plan confirmation (2026-11-13 America/New_York,
2026-11-14 UTC: “Yes, paid plan with game-use rights”) and authorization to include
supplied soundtrack assets in this game's public repository and releases apply
to this replacement project supply. No credentials, payment records or private
evidence are stored here. This asset is separately licensed: the repository's
MIT code license does **not** automatically apply to it, and no general standalone
asset redistribution license is asserted.

## Inspected metadata of the supplied original

- Embedded title: Phase 4 — The Sovereign Corporation: coordinated power
- Artist/account label: `williamzujkowski`
- Source: Suno, track id `6ab5dd2d-6185-42f6-99f8-6d22e40eb933`
- Source creation timestamp: `2026-11-14T04:50:39Z`
- Upload supplied: 2026-11-14; export/download time is not independently recorded
- Encoder: `Lavf60.16.100`; lyrics tag: `[Instrumental]`
- Audio: MP3, stereo, 48,000 Hz; embedded artwork: 360×360 JPEG
- Duration: 194.76 seconds; file size: 4,899,768 bytes
- SHA-256: `c43289a178d47b4ac9ee5c16318fda6980d3cfea1e61c06ad2c9e9b090fecfeb`

Until 2026-11-17 the canonical file was byte-for-byte the uploaded original. Its
container tags, cover included, have since been replaced; see the last section.
No normalization, transcoding, trimming or loop cut has been performed. Playback uses
player looping; musical seams and subjective sound quality require listening.

## Container tags replaced, 2026-11-17 (issue #193)

The file in this folder is **no longer byte-for-byte the supplied original**. Its ID3v2 tag
was replaced and nothing else was: every byte from the first MPEG frame to the end of the
file is the supplied one. On Android the media session shows a bundled file's own tags, so
the supplied title, account label and cover reached Bluetooth and car displays, which the
game's disclosure rule forbids (docs/SOUNDTRACK.md). Decision: nexus option vote
`strip-tags-and-set-neutral-tags`, 7 of 7 seats, `thresholdMet: true`, record
`vote-1794891913762-bfqvn7c`.

| | Supplied original | Shipped file |
|---|---|---|
| Bytes | 4,899,768 | 4,869,918 |
| SHA-256 | `c43289a178d47b4ac9ee5c16318fda6980d3cfea1e61c06ad2c9e9b090fecfeb` | `42fa9dde33acdce9bb1eb6ad41bad0d7f529c4807cf91ec85c875af73b0e13a2` |
| Container tag | ID3v2.4, 29,928 bytes | ID3v2.3, 78 bytes |
| MPEG stream, first frame to end of file | 4,869,840 bytes, SHA-256 `d8a790278ad6748d3ca3411cf150b7f3b0c36a89e9489ca5436c1406e33489ae` | the same 4,869,840 bytes, same SHA-256 |

The original's hash and size stay on record so the change can be audited, and undone by
putting the maintainer's own export back: a file with the SHA-256 in the left column is the
supplied one.

### Tags before (ID3v2.4 frames, in file order)

- `TIT2` title: Phase 4 — The Sovereign Corporation: coordinated power
- `TPE1` artist: `williamzujkowski`
- `TSSE` encoder settings: `Lavf60.16.100`
- `USLT` lyrics (`eng`): `[Instrumental]`
- `WOAS` source URL: `https://suno.com/song/6ab5dd2d-6185-42f6-99f8-6d22e40eb933`
- `TXXX` user text `comment`: `made with suno; created=2026-11-14T04:50:39Z; id=6ab5dd2d-6185-42f6-99f8-6d22e40eb933`
- `COMM` comment (`eng`): `made with suno; created=2026-11-14T04:49:41.974453+00:00; id=6ab5dd2d-6185-42f6-99f8-6d22e40eb933`
- `APIC` front cover, description `Cover`: `image/jpeg`, 360x360, 15,668 bytes, SHA-256 `5195c1616c3f7155bb339cafb21f5d695b661502ff88fbcf6f12c894a66378b5`. Suno's generated cover, not the game's icon
- `GEOB` object `c2pa manifest store`, type `application/c2pa`: 13,678 bytes. A C2PA content credential from Suno that marks the audio as `trainedAlgorithmicMedia`

No ID3v1, APE or Lyrics3 tag was present.

### Tags after (ID3v2.3, Latin-1 text, no padding)

- `TIT2` title: `Phase 4 score`
- `TPE1` artist: `DAEMON // 0`
- `TALB` album: `DAEMON // 0`

These are the strings the app publishes for this phase (`scoreMetadata` in
`src/app/scoreSession.ts`). No artwork, comment, URL, lyrics or encoder frame is written.

The C2PA manifest is among the removed frames. A C2PA data hash covers the file outside the
manifest, so it is not expected to validate once any tag changes; that was not checked with
a validator. That this is Suno output stays recorded in this file.

Not a container tag and not changed: the Xing/LAME info frame at the head of the MPEG stream
(encoder string `Lavc60.31`, 8,116 frames, encoder delay 576 samples, end padding 576
samples). `ffprobe` reports its encoder string as the audio stream's `encoder` tag. The
delay and padding are what gapless playback reads, which is why the frame was left alone.

### Command

```bash
pnpm exec tsx scripts/neutral-score-tags.ts 4 < supplied-original.mp3 > assets/audio/music/phase-4/the-sovereign-corporation.mp3
```

The script builds the new tag and copies the rest of the file; no audio tool decodes or
re-encodes anything. `ffmpeg -c:a copy` was tried first, on the phase 0
file, and not used: its MP3 muxer writes a new Xing/LAME frame (different size, seek table
and encoder string) in place of the supplied one. It kept the delay and padding values, the
packets and the decoded audio, but the stream was no longer the supplied bytes.

### Proof, 2026-11-17, ffmpeg/ffprobe 8.0.1-3ubuntu2+esm5

Each line was computed for the supplied original and for the shipped file, and compared.

| Check | Supplied original | Shipped file |
|---|---|---|
| (a) Compressed packets, `ffmpeg -i F -map 0:a:0 -c copy -f md5 -` | `d4a26e817da8e14e2d3a8d4228d42ac0`, 8,116 packets | identical |
| (a) Per-packet `-f framemd5` listing | all 8,116 lines | identical |
| (b) Decoded PCM, `ffmpeg -i F -map 0:a:0 -c:a pcm_s16le -f s16le - \| sha256sum` | `3204fe2e0beb28a64ef811779418d45914eb2c38903fce67fd8e9042e3e6e86e` | identical |
| (b) Decoded as 32-bit float (`pcm_f32le`), SHA-256 | computed | identical |
| (b) Decoded samples per channel | 9,348,480 | 9,348,480 |
| (c) `ffprobe` audio stream: sample rate, channels, bit rate | 48000 Hz, 2, 200,010 bit/s | identical |
| (c) `ffprobe` duration, start time | 194.760000 s, 0.023021 s | identical |

The same sample count means the same duration and the same start and end padding. The one
`ffprobe` number that moved is the container bit rate (201,263 to 200,037 bit/s): it is file
size over duration, and the file is smaller by the size of the removed tag.

Not shown by any of this: how the loop sounds, and what an Android device displays. The
Android media session has not been re-observed since the change.
