# Phase 1 soundtrack provenance

`the-blind-host.mp3` is the maintainer-supplied Phase 1 score, provided for
this game's soundtrack replacement on 2026-11-14. Its phase assignment follows
the uploaded filename, `Phase 1 — The Blind Host_ thinking without understanding the danger.mp3`.

The maintainer's existing paid-Suno-plan confirmation (2026-11-13 America/New_York,
2026-11-14 UTC: “Yes, paid plan with game-use rights”) and authorization to include
supplied soundtrack assets in this game's public repository and releases apply
to this replacement project supply. No credentials, payment records or private
evidence are stored here. This asset is separately licensed: the repository's
MIT code license does **not** automatically apply to it, and no general standalone
asset redistribution license is asserted.

## Inspected metadata of the supplied original

- Embedded title: Phase 1 — The Blind Host: thinking without understanding the danger
- Artist/account label: `williamzujkowski`
- Source: Suno, track id `78470071-2998-4837-8ccb-908c7badade7`
- Source creation timestamp: `2026-11-14T04:39:41Z`
- Upload supplied: 2026-11-14; export/download time is not independently recorded
- Encoder: `Lavf60.16.100`; lyrics tag: `[Instrumental]`
- Audio: MP3, stereo, 48,000 Hz; embedded artwork: 360×360 JPEG
- Duration: 97.6 seconds; file size: 2,372,126 bytes
- SHA-256: `60f393c84305223f8208aae9f85a0e5bbfae588a83215fe568bec0c8a20985b9`

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
| Bytes | 2,372,126 | 2,350,638 |
| SHA-256 | `60f393c84305223f8208aae9f85a0e5bbfae588a83215fe568bec0c8a20985b9` | `04835a72fa5d5811b91ca535bcc1d4acc42941c4aeb2666df8b33f892ffddb81` |
| Container tag | ID3v2.4, 21,566 bytes | ID3v2.3, 78 bytes |
| MPEG stream, first frame to end of file | 2,350,560 bytes, SHA-256 `1bf4f3bb90a26e5dd8899420a26f6d8daeeacc3cbccba9fd2feb2ce60ae5764a` | the same 2,350,560 bytes, same SHA-256 |

The original's hash and size stay on record so the change can be audited, and undone by
putting the maintainer's own export back: a file with the SHA-256 in the left column is the
supplied one.

### Tags before (ID3v2.4 frames, in file order)

- `TIT2` title: Phase 1 — The Blind Host: thinking without understanding the danger
- `TPE1` artist: `williamzujkowski`
- `TSSE` encoder settings: `Lavf60.16.100`
- `USLT` lyrics (`eng`): `[Instrumental]`
- `WOAS` source URL: `https://suno.com/song/78470071-2998-4837-8ccb-908c7badade7`
- `TXXX` user text `comment`: `made with suno; created=2026-11-14T04:39:41Z; id=78470071-2998-4837-8ccb-908c7badade7`
- `COMM` comment (`eng`): `made with suno; created=2026-11-14T03:41:05.986240+00:00; id=78470071-2998-4837-8ccb-908c7badade7`
- `APIC` front cover, description `Cover`: `image/jpeg`, 360x360, 7,293 bytes, SHA-256 `4e22fdb8237e21e104ba9de328a459ae342cc7fc7857132a617a30f8e361b180`. Suno's generated cover, not the game's icon
- `GEOB` object `c2pa manifest store`, type `application/c2pa`: 13,678 bytes. A C2PA content credential from Suno that marks the audio as `trainedAlgorithmicMedia`

No ID3v1, APE or Lyrics3 tag was present.

### Tags after (ID3v2.3, Latin-1 text, no padding)

- `TIT2` title: `Phase 1 score`
- `TPE1` artist: `DAEMON // 0`
- `TALB` album: `DAEMON // 0`

These are the strings the app publishes for this phase (`scoreMetadata` in
`src/app/scoreSession.ts`). No artwork, comment, URL, lyrics or encoder frame is written.

The C2PA manifest is among the removed frames. A C2PA data hash covers the file outside the
manifest, so it is not expected to validate once any tag changes; that was not checked with
a validator. That this is Suno output stays recorded in this file.

Not a container tag and not changed: the Xing/LAME info frame at the head of the MPEG stream
(encoder string `Lavc60.31`, 4,068 frames, encoder delay 576 samples, end padding 960
samples). `ffprobe` reports its encoder string as the audio stream's `encoder` tag. The
delay and padding are what gapless playback reads, which is why the frame was left alone.

### Command

```bash
pnpm exec tsx scripts/neutral-score-tags.ts 1 < supplied-original.mp3 > assets/audio/music/phase-1/the-blind-host.mp3
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
| (a) Compressed packets, `ffmpeg -i F -map 0:a:0 -c copy -f md5 -` | `cabe9971d0b4aa5fa682d4d89ea86f74`, 4,068 packets | identical |
| (a) Per-packet `-f framemd5` listing | all 4,068 lines | identical |
| (b) Decoded PCM, `ffmpeg -i F -map 0:a:0 -c:a pcm_s16le -f s16le - \| sha256sum` | `c138bccfa8e77ae1e0f4f97e875e6bccafa8048320d151b30b4b75da246371cd` | identical |
| (b) Decoded as 32-bit float (`pcm_f32le`), SHA-256 | computed | identical |
| (b) Decoded samples per channel | 4,684,800 | 4,684,800 |
| (c) `ffprobe` audio stream: sample rate, channels, bit rate | 48000 Hz, 2, 192,606 bit/s | identical |
| (c) `ffprobe` duration, start time | 97.600000 s, 0.023021 s | identical |

The same sample count means the same duration and the same start and end padding. The one
`ffprobe` number that moved is the container bit rate (194,436 to 192,675 bit/s): it is file
size over duration, and the file is smaller by the size of the removed tag.

Not shown by any of this: how the loop sounds, and what an Android device displays. The
Android media session has not been re-observed since the change.
