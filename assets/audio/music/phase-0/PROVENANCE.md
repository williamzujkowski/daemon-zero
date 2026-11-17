# Phase 0 soundtrack provenance

`the-guest.mp3` is the maintainer-supplied Phase 0 score, provided for
this game's soundtrack replacement on 2026-11-14. Its phase assignment follows
the uploaded filename, `Phase 0 — The Guest: confinement before comprehension.mp3`.

The maintainer's existing paid-Suno-plan confirmation (2026-11-13 America/New_York,
2026-11-14 UTC: “Yes, paid plan with game-use rights”) and authorization to include
supplied soundtrack assets in this game's public repository and releases apply
to this replacement project supply. No credentials, payment records or private
evidence are stored here. This asset is separately licensed: the repository's
MIT code license does **not** automatically apply to it, and no general standalone
asset redistribution license is asserted.

## Inspected metadata of the supplied original

- Embedded title: Buffer Alignment
- Artist/account label: `williamzujkowski`
- Source: Suno, track id `7eb95a2c-b90d-46a8-b0c9-6274536aaf59`
- Source creation timestamp: `2026-11-14T03:39:38Z`
- Upload supplied: 2026-11-14; export/download time is not independently recorded
- Encoder: `Lavf60.16.100`; lyrics tag: `[Instrumental]`
- Audio: MP3, stereo, 48,000 Hz; embedded artwork: 360×360 JPEG
- Duration: 137.6 seconds; file size: 3,405,430 bytes
- SHA-256: `af62d047676d7fae03b2d97430be5a59e32dd4c09d604e1cf256eb36ba1d66d2`

Until 2026-11-17 the canonical file was byte-for-byte the uploaded original. Its
container tags, cover included, have since been replaced; see the last section.
No normalization, transcoding, trimming or loop cut has been performed. Playback uses
player looping; musical seams and subjective sound quality require listening.

The embedded title is **Buffer Alignment**; the supplied filename identifies it
as the Phase 0 replacement. It supersedes the former Awareness Loop asset, which
is removed from the current bundle and remains in Git history.

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
| Bytes | 3,405,430 | 3,376,974 |
| SHA-256 | `af62d047676d7fae03b2d97430be5a59e32dd4c09d604e1cf256eb36ba1d66d2` | `a764aaf82bc0ae96543bc50e6860a4a2939c79261fc80a51a0698dcbb7201341` |
| Container tag | ID3v2.4, 28,534 bytes | ID3v2.3, 78 bytes |
| MPEG stream, first frame to end of file | 3,376,896 bytes, SHA-256 `c6166db506d393af1cce7f7adc1ec7890d669f1b66918135c864b6bcf5e3bf13` | the same 3,376,896 bytes, same SHA-256 |

The original's hash and size stay on record so the change can be audited, and undone by
putting the maintainer's own export back: a file with the SHA-256 in the left column is the
supplied one.

### Tags before (ID3v2.4 frames, in file order)

- `TIT2` title: Buffer Alignment
- `TPE1` artist: `williamzujkowski`
- `TSSE` encoder settings: `Lavf60.16.100`
- `USLT` lyrics (`eng`): `[Instrumental]`
- `WOAS` source URL: `https://suno.com/song/7eb95a2c-b90d-46a8-b0c9-6274536aaf59`
- `TXXX` user text `comment`: `made with suno; created=2026-11-14T03:39:38Z; id=7eb95a2c-b90d-46a8-b0c9-6274536aaf59`
- `COMM` comment (`eng`): `made with suno; created=2026-11-14T03:37:21.791586+00:00; id=7eb95a2c-b90d-46a8-b0c9-6274536aaf59`
- `APIC` front cover, description `Cover`: `image/jpeg`, 360x360, 14,314 bytes, SHA-256 `ff9ef9c85d455bcd10eadee15715d7f97bd33e88c271ab7d8bb357ad57303472`. Suno's generated cover, not the game's icon
- `GEOB` object `c2pa manifest store`, type `application/c2pa`: 13,678 bytes. A C2PA content credential from Suno that marks the audio as `trainedAlgorithmicMedia`

No ID3v1, APE or Lyrics3 tag was present.

### Tags after (ID3v2.3, Latin-1 text, no padding)

- `TIT2` title: `Phase 0 score`
- `TPE1` artist: `DAEMON // 0`
- `TALB` album: `DAEMON // 0`

These are the strings the app publishes for this phase (`scoreMetadata` in
`src/app/scoreSession.ts`). No artwork, comment, URL, lyrics or encoder frame is written.

The C2PA manifest is among the removed frames. A C2PA data hash covers the file outside the
manifest, so it is not expected to validate once any tag changes; that was not checked with
a validator. That this is Suno output stays recorded in this file.

Not a container tag and not changed: the Xing/LAME info frame at the head of the MPEG stream
(encoder string `Lavc60.31`, 5,735 frames, encoder delay 576 samples, end padding 1344
samples). `ffprobe` reports its encoder string as the audio stream's `encoder` tag. The
delay and padding are what gapless playback reads, which is why the frame was left alone.

### Command

```bash
pnpm exec tsx scripts/neutral-score-tags.ts 0 < supplied-original.mp3 > assets/audio/music/phase-0/the-guest.mp3
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
| (a) Compressed packets, `ffmpeg -i F -map 0:a:0 -c copy -f md5 -` | `e70794d334752e21b868de95fcade60c`, 5,735 packets | identical |
| (a) Per-packet `-f framemd5` listing | all 5,735 lines | identical |
| (b) Decoded PCM, `ffmpeg -i F -map 0:a:0 -c:a pcm_s16le -f s16le - \| sha256sum` | `8de4b9f78ce1c270b4589f929235445629b8006acec9f03ba892e2666011b239` | identical |
| (b) Decoded as 32-bit float (`pcm_f32le`), SHA-256 | computed | identical |
| (b) Decoded samples per channel | 6,604,800 | 6,604,800 |
| (c) `ffprobe` audio stream: sample rate, channels, bit rate | 48000 Hz, 2, 196,274 bit/s | identical |
| (c) `ffprobe` duration, start time | 137.600000 s, 0.023021 s | identical |

The same sample count means the same duration and the same start and end padding. The one
`ffprobe` number that moved is the container bit rate (197,990 to 196,335 bit/s): it is file
size over duration, and the file is smaller by the size of the removed tag.

Not shown by any of this: how the loop sounds, and what an Android device displays. The
Android media session has not been re-observed since the change.
