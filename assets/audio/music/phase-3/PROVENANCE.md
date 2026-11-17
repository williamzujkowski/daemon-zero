# Phase 3 soundtrack provenance

`the-dark-forest.mp3` is the maintainer-supplied Phase 3 score, provided for
this game's soundtrack replacement on 2026-11-14. Its phase assignment follows
the uploaded filename, `Phase 3 — The Dark Forest_ participation replaces fear.mp3`.

The maintainer's existing paid-Suno-plan confirmation (2026-11-13 America/New_York,
2026-11-14 UTC: “Yes, paid plan with game-use rights”) and authorization to include
supplied soundtrack assets in this game's public repository and releases apply
to this replacement project supply. No credentials, payment records or private
evidence are stored here. This asset is separately licensed: the repository's
MIT code license does **not** automatically apply to it, and no general standalone
asset redistribution license is asserted.

## Inspected metadata of the supplied original

- Embedded title: Phase 3 — The Dark Forest: participation replaces fear
- Artist/account label: `williamzujkowski`
- Source: Suno, track id `f55c83cd-e18a-4b65-81a8-a669fd5f8916`
- Source creation timestamp: `2026-11-14T05:35:09Z`
- Upload supplied: 2026-11-14; export/download time is not independently recorded
- Encoder: `Lavf60.16.100`; lyrics tag: `[Instrumental]`
- Audio: MP3, stereo, 48,000 Hz; embedded artwork: 360×360 JPEG
- Duration: 174.32 seconds; file size: 4,332,841 bytes
- SHA-256: `b60df55da2626697fa4abde5972a078fad548d7efba77eb6511430a08cf5951d`

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
`vote-1794891913762-bfqvn7c`. A second vote, `neutral-ai-origin-tag` (7 of 7 seats, record
`vote-1794897142413-84x42e4`), added one comment frame that says the music is AI-generated,
in place of the removed signed C2PA manifest.

| | Supplied original | Shipped file |
|---|---|---|
| Bytes | 4,332,841 | 4,307,974 |
| SHA-256 | `b60df55da2626697fa4abde5972a078fad548d7efba77eb6511430a08cf5951d` | `98b835edb8b280797d1ea2e96812d0aa72eb83a630c3779cfd8c2896d5178cd2` |
| Container tag | ID3v2.4, 24,985 bytes | ID3v2.3, 118 bytes |
| MPEG stream, first frame to end of file | 4,307,856 bytes, SHA-256 `bc7055e0475982bf7d4415586265830156c1faf03504808acafd77880b561cb0` | the same 4,307,856 bytes, same SHA-256 |

The original's hash and size stay on record so the change can be audited, and undone by
putting the maintainer's own export back: a file with the SHA-256 in the left column is the
supplied one.

### Tags before (ID3v2.4 frames, in file order)

- `TIT2` title: Phase 3 — The Dark Forest: participation replaces fear
- `TPE1` artist: `williamzujkowski`
- `TSSE` encoder settings: `Lavf60.16.100`
- `USLT` lyrics (`eng`): `[Instrumental]`
- `WOAS` source URL: `https://suno.com/song/f55c83cd-e18a-4b65-81a8-a669fd5f8916`
- `TXXX` user text `comment`: `made with suno; created=2026-11-14T05:35:09Z; id=f55c83cd-e18a-4b65-81a8-a669fd5f8916`
- `COMM` comment (`eng`): `made with suno; created=2026-11-14T04:46:39.711768+00:00; id=f55c83cd-e18a-4b65-81a8-a669fd5f8916`
- `APIC` front cover, description `Cover`: `image/jpeg`, 360x360, 10,725 bytes, SHA-256 `132c29962d486417ae29ef9822fa7cfd0793dc6d1409d263578bcc39a03f3470`. Suno's generated cover, not the game's icon
- `GEOB` object `c2pa manifest store`, type `application/c2pa`: 13,678 bytes. A C2PA content credential from Suno that marks the audio as `trainedAlgorithmicMedia`

No ID3v1, APE or Lyrics3 tag was present.

### Tags after (ID3v2.3, Latin-1 text, no padding)

- `TIT2` title: `Phase 3 score`
- `TPE1` artist: `DAEMON // 0`
- `TALB` album: `DAEMON // 0`
- `COMM` comment, language `eng`, empty description: `AI-generated music (Suno)`

The first three are the strings the app publishes for this phase (`scoreMetadata` in
`src/app/scoreSession.ts`). The comment is the AI-origin disclosure (`AI_DISCLOSURE` in
`scripts/score-tags.ts`). No artwork, URL, lyrics, encoder or other frame is written.

The C2PA manifest is among the removed frames. A C2PA data hash covers the file outside the
manifest, so it is not expected to validate once any tag changes; that was not checked with
a validator. In its place, by nexus vote `vote-1794897142413-84x42e4`, the file carries the
unsigned, plain disclosure above: anyone reading the tags (`ffprobe` shows it as `comment`)
learns the music is AI-generated, but unlike the manifest it is not signed and proves
nothing about who made it. The comment frame was chosen because media3 1.9.1, which builds
the Android media session, takes its displayed fields only from text frames and artwork;
its `CommentFrame` contributes nothing (docs/SOUNDTRACK.md). That this is Suno output, with
its track id, stays recorded in this file.

Not a container tag and not changed: the Xing/LAME info frame at the head of the MPEG stream
(encoder string `Lavc60.31`, 7,265 frames, encoder delay 576 samples, end padding 1344
samples). `ffprobe` reports its encoder string as the audio stream's `encoder` tag. The
delay and padding are what gapless playback reads, which is why the frame was left alone.

### Command

```bash
pnpm exec tsx scripts/neutral-score-tags.ts 3 < supplied-original.mp3 > assets/audio/music/phase-3/the-dark-forest.mp3
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
| (a) Compressed packets, `ffmpeg -i F -map 0:a:0 -c copy -f md5 -` | `101d0b343d4fa9f0d3f4785c0ce20aff`, 7,265 packets | identical |
| (a) Per-packet `-f framemd5` listing | all 7,265 lines | identical |
| (b) Decoded PCM, `ffmpeg -i F -map 0:a:0 -c:a pcm_s16le -f s16le - \| sha256sum` | `45ca24371bed6aba74900c44de04ba344df4003af1b493c952dc476c4a228a4b` | identical |
| (b) Decoded as 32-bit float (`pcm_f32le`), SHA-256 | computed | identical |
| (b) Decoded samples per channel | 8,367,360 | 8,367,360 |
| (c) `ffprobe` audio stream: sample rate, channels, bit rate | 48000 Hz, 2, 197,653 bit/s | identical |
| (c) `ffprobe` duration, start time | 174.320000 s, 0.023021 s | identical |

The same sample count means the same duration and the same start and end padding. The one
`ffprobe` number that moved is the container bit rate (198,845 to 197,704 bit/s): it is file
size over duration, and the file is smaller by the size of the removed tag.

Not shown by any of this: how the loop sounds, and what an Android device displays. The
Android media session has not been re-observed since the change.
