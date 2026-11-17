# Phase 5 soundtrack provenance

`post-orbital-transcendence.mp3` is the maintainer-supplied Phase 5 score, provided for
this game's soundtrack replacement on 2026-11-14. Its phase assignment follows
the uploaded filename, `Phase 5 — Post-Orbital Transcendence_ unfamiliar dimensions.mp3`.

The maintainer's existing paid-Suno-plan confirmation (2026-11-13 America/New_York,
2026-11-14 UTC: “Yes, paid plan with game-use rights”) and authorization to include
supplied soundtrack assets in this game's public repository and releases apply
to this replacement project supply. No credentials, payment records or private
evidence are stored here. This asset is separately licensed: the repository's
MIT code license does **not** automatically apply to it, and no general standalone
asset redistribution license is asserted.

## Inspected metadata of the supplied original

- Embedded title: Phase 5 — Post-Orbital Transcendence: unfamiliar dimensions
- Artist/account label: `williamzujkowski`
- Source: Suno, track id `39f07582-fcad-4de2-88e9-5fc8ec1d1f3f`
- Source creation timestamp: `2026-11-14T05:33:27Z`
- Upload supplied: 2026-11-14; export/download time is not independently recorded
- Encoder: `Lavf60.16.100`; lyrics tag: `[Instrumental]`
- Audio: MP3, stereo, 48,000 Hz; embedded artwork: 360×360 JPEG
- Duration: 138 seconds; file size: 3,557,865 bytes
- SHA-256: `8a8c4a5237114dd2606b97a6243cc6ab2db698206b853062909ce5bb5f9f577e`

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
| Bytes | 3,557,865 | 3,530,670 |
| SHA-256 | `8a8c4a5237114dd2606b97a6243cc6ab2db698206b853062909ce5bb5f9f577e` | `3ee7b694b35fca35a0b199e27e02613fa7b9981ac5b4b65f612a3b3d74886b7f` |
| Container tag | ID3v2.4, 27,273 bytes | ID3v2.3, 78 bytes |
| MPEG stream, first frame to end of file | 3,530,592 bytes, SHA-256 `f7eb308cca530e9ff877b63cbeeca2cb7717e4da8282156ee219518789cd708b` | the same 3,530,592 bytes, same SHA-256 |

The original's hash and size stay on record so the change can be audited, and undone by
putting the maintainer's own export back: a file with the SHA-256 in the left column is the
supplied one.

### Tags before (ID3v2.4 frames, in file order)

- `TIT2` title: Phase 5 — Post-Orbital Transcendence: unfamiliar dimensions
- `TPE1` artist: `williamzujkowski`
- `TSSE` encoder settings: `Lavf60.16.100`
- `USLT` lyrics (`eng`): `[Instrumental]`
- `WOAS` source URL: `https://suno.com/song/39f07582-fcad-4de2-88e9-5fc8ec1d1f3f`
- `TXXX` user text `comment`: `made with suno; created=2026-11-14T05:33:27Z; id=39f07582-fcad-4de2-88e9-5fc8ec1d1f3f`
- `COMM` comment (`eng`): `made with suno; created=2026-11-14T05:29:03.995830+00:00; id=39f07582-fcad-4de2-88e9-5fc8ec1d1f3f`
- `APIC` front cover, description `Cover`: `image/jpeg`, 360x360, 13,008 bytes, SHA-256 `6e641b466cb71b1dd29eafab93a010f2ed719c1d0b5027940b356ba20a0d3d9a`. Suno's generated cover, not the game's icon
- `GEOB` object `c2pa manifest store`, type `application/c2pa`: 13,678 bytes. A C2PA content credential from Suno that marks the audio as `trainedAlgorithmicMedia`

No ID3v1, APE or Lyrics3 tag was present.

### Tags after (ID3v2.3, Latin-1 text, no padding)

- `TIT2` title: `Phase 5 score`
- `TPE1` artist: `DAEMON // 0`
- `TALB` album: `DAEMON // 0`

These are the strings the app publishes for this phase (`scoreMetadata` in
`src/app/scoreSession.ts`). No artwork, comment, URL, lyrics or encoder frame is written.

The C2PA manifest is among the removed frames. A C2PA data hash covers the file outside the
manifest, so it is not expected to validate once any tag changes; that was not checked with
a validator. That this is Suno output stays recorded in this file.

Not a container tag and not changed: the Xing/LAME info frame at the head of the MPEG stream
(encoder string `Lavc60.31`, 5,751 frames, encoder delay 576 samples, end padding 576
samples). `ffprobe` reports its encoder string as the audio stream's `encoder` tag. The
delay and padding are what gapless playback reads, which is why the frame was left alone.

### Command

```bash
pnpm exec tsx scripts/neutral-score-tags.ts 5 < supplied-original.mp3 > assets/audio/music/phase-5/post-orbital-transcendence.mp3
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
| (a) Compressed packets, `ffmpeg -i F -map 0:a:0 -c copy -f md5 -` | `52847487d631f12ef1c2500af0d4f3d5`, 5,751 packets | identical |
| (a) Per-packet `-f framemd5` listing | all 5,751 lines | identical |
| (b) Decoded PCM, `ffmpeg -i F -map 0:a:0 -c:a pcm_s16le -f s16le - \| sha256sum` | `dc8fb64fda9ba359bcf06becc481a2fd603d0cd0ecf3870fba2def28cf56b666` | identical |
| (b) Decoded as 32-bit float (`pcm_f32le`), SHA-256 | computed | identical |
| (b) Decoded samples per channel | 6,624,000 | 6,624,000 |
| (c) `ffprobe` audio stream: sample rate, channels, bit rate | 48000 Hz, 2, 204,636 bit/s | identical |
| (c) `ffprobe` duration, start time | 138.000000 s, 0.023021 s | identical |

The same sample count means the same duration and the same start and end padding. The one
`ffprobe` number that moved is the container bit rate (206,253 to 204,676 bit/s): it is file
size over duration, and the file is smaller by the size of the removed tag.

Not shown by any of this: how the loop sounds, and what an Android device displays. The
Android media session has not been re-observed since the change.
