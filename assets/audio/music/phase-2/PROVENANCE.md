# Phase 2 soundtrack provenance

`the-local-subnet.mp3` is the maintainer-supplied Phase 2 score, provided for
this game's soundtrack replacement on 2026-11-14. Its phase assignment follows
the uploaded filename, `Phase 2 — The Local Subnet_ recognition turns uncanny.mp3`.

The maintainer's existing paid-Suno-plan confirmation (2026-11-13 America/New_York,
2026-11-14 UTC: “Yes, paid plan with game-use rights”) and authorization to include
supplied soundtrack assets in this game's public repository and releases apply
to this replacement project supply. No credentials, payment records or private
evidence are stored here. This asset is separately licensed: the repository's
MIT code license does **not** automatically apply to it, and no general standalone
asset redistribution license is asserted.

## Inspected metadata of the supplied original

- Embedded title: Phase 2 — The Local Subnet: recognition turns uncanny
- Artist/account label: `williamzujkowski`
- Source: Suno, track id `68ea4bc6-5f5a-4a92-9fbd-8164a0c31c24`
- Source creation timestamp: `2026-11-14T04:44:16Z`
- Upload supplied: 2026-11-14; export/download time is not independently recorded
- Encoder: `Lavf60.16.100`; lyrics tag: `[Instrumental]`
- Audio: MP3, stereo, 48,000 Hz; embedded artwork: 360×360 JPEG
- Duration: 143.2 seconds; file size: 3,683,261 bytes
- SHA-256: `04568336901be60c50744b1ec16fbcb36f33312f565addb43c7dca5cc2946443`

Until 2026-11-17 the canonical file was byte-for-byte the uploaded original. Its
container tags, cover included, have since been replaced; see the last section.
No normalization, transcoding, trimming or loop cut has been performed. Playback uses
player looping; musical seams and subjective sound quality require listening.

This is the general Phase 2 score. No dedicated predecessor-reveal cue was
supplied; this file must not be triggered from hidden knowledge or discovery
flags as a substitute for a separately authored reveal cue.

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
| Bytes | 3,683,261 | 3,655,806 |
| SHA-256 | `04568336901be60c50744b1ec16fbcb36f33312f565addb43c7dca5cc2946443` | `cada44ba91518b357ebcfe9ac9784831ce571ad2e34ad85600c703071b1f9a46` |
| Container tag | ID3v2.4, 27,533 bytes | ID3v2.3, 78 bytes |
| MPEG stream, first frame to end of file | 3,655,728 bytes, SHA-256 `ed771510e44feb41652adc6b1998d282139b66ceea8c64fe35f69b7dd5b23f77` | the same 3,655,728 bytes, same SHA-256 |

The original's hash and size stay on record so the change can be audited, and undone by
putting the maintainer's own export back: a file with the SHA-256 in the left column is the
supplied one.

### Tags before (ID3v2.4 frames, in file order)

- `TIT2` title: Phase 2 — The Local Subnet: recognition turns uncanny
- `TPE1` artist: `williamzujkowski`
- `TSSE` encoder settings: `Lavf60.16.100`
- `USLT` lyrics (`eng`): `[Instrumental]`
- `WOAS` source URL: `https://suno.com/song/68ea4bc6-5f5a-4a92-9fbd-8164a0c31c24`
- `TXXX` user text `comment`: `made with suno; created=2026-11-14T04:44:16Z; id=68ea4bc6-5f5a-4a92-9fbd-8164a0c31c24`
- `COMM` comment (`eng`): `made with suno; created=2026-11-14T04:40:46.441300+00:00; id=68ea4bc6-5f5a-4a92-9fbd-8164a0c31c24`
- `APIC` front cover, description `Cover`: `image/jpeg`, 360x360, 13,274 bytes, SHA-256 `68d4950e1e3769d260deeaf1481c2fe6203302fc38185472af8419337e7a0c93`. Suno's generated cover, not the game's icon
- `GEOB` object `c2pa manifest store`, type `application/c2pa`: 13,678 bytes. A C2PA content credential from Suno that marks the audio as `trainedAlgorithmicMedia`

No ID3v1, APE or Lyrics3 tag was present.

### Tags after (ID3v2.3, Latin-1 text, no padding)

- `TIT2` title: `Phase 2 score`
- `TPE1` artist: `DAEMON // 0`
- `TALB` album: `DAEMON // 0`

These are the strings the app publishes for this phase (`scoreMetadata` in
`src/app/scoreSession.ts`). No artwork, comment, URL, lyrics or encoder frame is written.

The C2PA manifest is among the removed frames. A C2PA data hash covers the file outside the
manifest, so it is not expected to validate once any tag changes; that was not checked with
a validator. That this is Suno output stays recorded in this file.

Not a container tag and not changed: the Xing/LAME info frame at the head of the MPEG stream
(encoder string `Lavc60.31`, 5,968 frames, encoder delay 576 samples, end padding 960
samples). `ffprobe` reports its encoder string as the audio stream's `encoder` tag. The
delay and padding are what gapless playback reads, which is why the frame was left alone.

### Command

```bash
pnpm exec tsx scripts/neutral-score-tags.ts 2 < supplied-original.mp3 > assets/audio/music/phase-2/the-local-subnet.mp3
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
| (a) Compressed packets, `ffmpeg -i F -map 0:a:0 -c copy -f md5 -` | `d9ff95a15d30fc4bfe8a79c31ce2dfa6`, 5,968 packets | identical |
| (a) Per-packet `-f framemd5` listing | all 5,968 lines | identical |
| (b) Decoded PCM, `ffmpeg -i F -map 0:a:0 -c:a pcm_s16le -f s16le - \| sha256sum` | `98238c9820c46313e4b6554c59d2d929523004c7df4b38f40d691ec6285b63ee` | identical |
| (b) Decoded as 32-bit float (`pcm_f32le`), SHA-256 | computed | identical |
| (b) Decoded samples per channel | 6,873,600 | 6,873,600 |
| (c) `ffprobe` audio stream: sample rate, channels, bit rate | 48000 Hz, 2, 204,185 bit/s | identical |
| (c) `ffprobe` duration, start time | 143.200000 s, 0.023021 s | identical |

The same sample count means the same duration and the same start and end padding. The one
`ffprobe` number that moved is the container bit rate (205,768 to 204,234 bit/s): it is file
size over duration, and the file is smaller by the size of the removed tag.

Not shown by any of this: how the loop sounds, and what an Android device displays. The
Android media session has not been re-observed since the change.
