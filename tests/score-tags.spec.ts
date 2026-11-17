/**
 * What a bundled audio file may say about itself. On Android the media session shows a
 * file's own tags, not anything the app sets, so a score may carry exactly the three strings
 * the app publishes for its phase and a voice clip may carry no text at all (#193). The
 * parser is proved on made-up tags first, then the shipped files are held to it. No audio
 * tool is needed; where ffprobe is installed it is asked for a second opinion.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { neutralTag, readTags, tagProblems, withNeutralTags } from '../scripts/score-tags';
import { scoreTracks } from '../src/app/musicTracks';
import { GAME_TITLE, scoreMetadata } from '../src/app/scoreSession';
import { shipped } from './score-files';
import { voiceClipFiles } from './voice-files';

/** Four bytes that start like an MPEG-1 layer 3 frame, then a recognisable body. */
const AUDIO = Buffer.concat([Buffer.from([0xff, 0xfb, 0x54, 0x00]), Buffer.from('the audio, which nothing here may alter')]);
const NEUTRAL = { title: 'Phase 9 score', artist: 'A Game', album: 'A Game' };

function syncsafe(size: number): number[] {
  return [(size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f];
}
/** An ID3v2 tag as a foreign encoder would write it: any version, any frames. */
function tag(version: 2 | 3 | 4, frames: [id: string, body: Buffer][], options: { flags?: number; padding?: number } = {}): Buffer {
  const parts = frames.map(([id, body]) => {
    if (version === 2) return Buffer.concat([Buffer.from(id, 'latin1'), Buffer.from([body.length >> 16, (body.length >> 8) & 0xff, body.length & 0xff]), body]);
    const size = version === 4 ? syncsafe(body.length) : [0, 0, (body.length >> 8) & 0xff, body.length & 0xff];
    return Buffer.concat([Buffer.from(id, 'latin1'), Buffer.from([...size, 0, 0]), body]);
  });
  const content = Buffer.concat([...parts, Buffer.alloc(options.padding ?? 0)]);
  return Buffer.concat([Buffer.from([0x49, 0x44, 0x33, version, 0, options.flags ?? 0, ...syncsafe(content.length)]), content]);
}
const utf8 = (text: string) => Buffer.concat([Buffer.from([3]), Buffer.from(text, 'utf8'), Buffer.from([0])]);
const latin1 = (text: string) => Buffer.concat([Buffer.from([0]), Buffer.from(text, 'latin1')]);
const utf16 = (text: string) => Buffer.concat([Buffer.from([1, 0xff, 0xfe]), Buffer.from(text, 'utf16le'), Buffer.from([0, 0])]);
const utf16be = (text: string) => Buffer.concat([Buffer.from([2]), Buffer.from(text, 'utf16le').swap16()]);

/** The shape of a supplied score: a title that names the phase, an account label, a cover. */
const supplied = Buffer.concat([tag(4, [['TIT2', utf8('Phase 9 — The Hidden Name: a spoiler')], ['TPE1', utf8('an-account')],
  ['TSSE', utf8('Lavf60.16.100')], ['COMM', Buffer.from('\x03eng\0made with a tool\0', 'latin1')],
  ['APIC', Buffer.concat([Buffer.from('\x03image/jpeg\0\x03Cover\0', 'latin1'), Buffer.alloc(300, 0x7f)])]]), AUDIO]);

describe('reading ID3v2', () => {
  it('lists every frame of a v2.4 tag, decodes its text and finds where the audio starts', () => {
    const report = readTags(supplied);
    expect(report.versions).toEqual([4]);
    expect(report.frames.map((frame) => frame.id)).toEqual(['TIT2', 'TPE1', 'TSSE', 'COMM', 'APIC']);
    expect(report.frames[0]?.text).toBe('Phase 9 — The Hidden Name: a spoiler');
    expect(report.frames[1]?.text).toBe('an-account');
    expect(report.frames[3]?.text, 'not a text frame').toBeNull();
    expect(report.frames[4]?.bytes).toBe(319);
    expect(supplied.subarray(report.audioOffset).equals(AUDIO)).toBe(true);
    expect(report).toMatchObject({ audioSync: true, trailers: [] });
  });

  it('reads v2.3 and v2.2 sizes, every text encoding, and stops at padding', () => {
    const v3 = readTags(Buffer.concat([tag(3, [['TIT2', latin1('Caf\xe9')], ['TALB', utf16('Ålbum')], ['TPE1', utf16be('Bé')], ['TXXX', latin1('k\0v')]], { padding: 64 }), AUDIO]));
    expect(v3.frames.map((frame) => [frame.id, frame.text])).toEqual([['TIT2', 'Café'], ['TALB', 'Ålbum'], ['TPE1', 'Bé'], ['TXXX', null]]);
    expect(v3.audioSync).toBe(true);
    // A body longer than 127 bytes is where v2.3 (plain) and v2.4 (syncsafe) sizes part ways.
    const long = 'x'.repeat(300);
    for (const version of [3, 4] as const) {
      const report = readTags(Buffer.concat([tag(version, [['TIT2', latin1(long)], ['TPE1', latin1('after')]]), AUDIO]));
      expect(report.frames.map((frame) => frame.text), 'v2.' + String(version)).toEqual([long, 'after']);
    }
    const v2 = readTags(Buffer.concat([tag(2, [['TT2', latin1('Old')], ['PIC', Buffer.alloc(20, 1)]]), AUDIO]));
    expect(v2.frames.map((frame) => [frame.id, frame.text])).toEqual([['TT2', 'Old'], ['PIC', null]]);
    expect(v2.audioSync).toBe(true);
  });

  it('sees a second leading tag, a v2.4 footer, trailing tags and a file with no tag at all', () => {
    const twice = readTags(Buffer.concat([neutralTag(NEUTRAL), tag(4, [['TIT2', utf8('Hidden')]]), AUDIO]));
    expect(twice.versions).toEqual([3, 4]);
    expect(twice.frames.map((frame) => frame.text)).toEqual(['Phase 9 score', 'A Game', 'A Game', 'Hidden']);
    const footed = Buffer.concat([tag(4, [['TIT2', utf8('T')]], { flags: 0x10 }), Buffer.from('3DI\x04\0\x10\0\0\0\x0c', 'latin1'), AUDIO]);
    expect(readTags(footed)).toMatchObject({ flags: [0x10], audioSync: true });
    const id3v1 = Buffer.concat([Buffer.from('TAG'), Buffer.alloc(125, 0x20)]);
    expect(readTags(Buffer.concat([AUDIO, id3v1])).trailers).toEqual(['ID3v1']);
    const ape = Buffer.concat([Buffer.from('APETAGEX'), Buffer.alloc(24)]);
    expect(readTags(Buffer.concat([AUDIO, ape])).trailers).toEqual(['APE']);
    expect(readTags(Buffer.concat([AUDIO, ape, id3v1])).trailers).toEqual(['ID3v1', 'APE']);
    expect(readTags(Buffer.concat([AUDIO, Buffer.from('LYRICS200'), id3v1])).trailers).toEqual(['ID3v1', 'Lyrics3']);
    expect(readTags(Buffer.concat([AUDIO, Buffer.from('3DI\x04\0\0\0\0\0\0', 'latin1')])).trailers).toEqual(['ID3v2 footer']);
    expect(readTags(AUDIO)).toEqual({ versions: [], flags: [], frames: [], audioOffset: 0, audioSync: true, trailers: [] });
    expect(readTags(Buffer.from('not audio')).audioSync).toBe(false);
    expect(readTags(Buffer.alloc(0)).audioSync).toBe(false);
  });
});

describe('the neutral tag', () => {
  it('is ID3v2.3 with exactly title, artist and album, and reads back as written', () => {
    const report = readTags(Buffer.concat([neutralTag(NEUTRAL), AUDIO]));
    expect(report).toMatchObject({ versions: [3], flags: [0], audioOffset: neutralTag(NEUTRAL).length, audioSync: true });
    expect(report.frames.map((frame) => [frame.id, frame.text])).toEqual([['TIT2', 'Phase 9 score'], ['TPE1', 'A Game'], ['TALB', 'A Game']]);
    expect(() => neutralTag({ ...NEUTRAL, title: 'Phase 9 — score' }), 'Latin-1 only, so no reader can decode it differently').toThrow('printable ASCII');
  });

  it('replaces the supplied tags and leaves every audio byte where it was', () => {
    const tagged = withNeutralTags(supplied, NEUTRAL);
    expect(tagProblems(tagged, NEUTRAL)).toEqual([]);
    expect(tagged.subarray(readTags(tagged).audioOffset).equals(AUDIO)).toBe(true);
    expect(tagged.length).toBe(neutralTag(NEUTRAL).length + AUDIO.length);
    expect(tagged.includes('Hidden Name') || tagged.includes('an-account') || tagged.includes('Cover')).toBe(false);
    // Doing it again changes nothing, and a file with no tag gains one.
    expect(withNeutralTags(tagged, NEUTRAL).equals(tagged)).toBe(true);
    expect(withNeutralTags(AUDIO, NEUTRAL).equals(tagged)).toBe(true);
  });

  it('refuses a file whose audio it cannot locate exactly', () => {
    expect(() => withNeutralTags(Buffer.concat([neutralTag(NEUTRAL), Buffer.from('junk'), AUDIO]), NEUTRAL)).toThrow('No MPEG audio frame');
    expect(() => withNeutralTags(Buffer.concat([AUDIO, Buffer.from('TAG'), Buffer.alloc(125)]), NEUTRAL)).toThrow('Trailing tag not handled: ID3v1');
  });
});

describe('what may not ship', () => {
  const neutral = Buffer.concat([neutralTag(NEUTRAL), AUDIO]);
  const withFrames = (frames: [string, Buffer][]) => Buffer.concat([tag(3, frames), AUDIO]);
  const three: [string, Buffer][] = [['TIT2', latin1(NEUTRAL.title)], ['TPE1', latin1(NEUTRAL.artist)], ['TALB', latin1(NEUTRAL.album)]];

  it('names each way a file can say more, or other, than the app does', () => {
    expect(tagProblems(neutral, NEUTRAL)).toEqual([]);
    expect(tagProblems(supplied, NEUTRAL)).toEqual(['TIT2 is "Phase 9 — The Hidden Name: a spoiler", not "Phase 9 score"', 'TPE1 is "an-account", not "A Game"',
      'unexpected frame TSSE', 'unexpected frame COMM', 'unexpected frame APIC', 'expected one TALB frame, found 0']);
    expect(tagProblems(neutral, { ...NEUTRAL, title: 'Phase 8 score' })).toEqual(['TIT2 is "Phase 9 score", not "Phase 8 score"']);
    expect(tagProblems(withFrames([...three, ['APIC', Buffer.alloc(40, 1)]]), NEUTRAL)).toEqual(['unexpected frame APIC']);
    expect(tagProblems(withFrames([...three, ['TIT2', latin1(NEUTRAL.title)]]), NEUTRAL)).toEqual(['expected one TIT2 frame, found 2']);
    expect(tagProblems(AUDIO, NEUTRAL)).toEqual(['expected one ID3v2 tag, found 0', 'expected one TIT2 frame, found 0',
      'expected one TPE1 frame, found 0', 'expected one TALB frame, found 0']);
  });

  it('is not fooled by a tag placed after, around or behind the neutral one', () => {
    expect(tagProblems(Buffer.concat([neutral, Buffer.from('TAG'), Buffer.alloc(125)]), NEUTRAL)).toEqual(['trailing ID3v1 tag']);
    expect(tagProblems(Buffer.concat([neutral, Buffer.from('APETAGEX'), Buffer.alloc(24)]), NEUTRAL)).toEqual(['trailing APE tag']);
    expect(tagProblems(Buffer.concat([neutralTag(NEUTRAL), tag(4, [['TPE2', utf8('an-account')]]), AUDIO]), NEUTRAL))
      .toEqual(['expected one ID3v2 tag, found 2', 'unexpected frame TPE2']);
    expect(tagProblems(Buffer.concat([neutralTag(NEUTRAL), Buffer.from('APETAGEX'), Buffer.alloc(24), AUDIO]), NEUTRAL))
      .toEqual(['no MPEG audio frame directly after the ID3v2 tag']);
    // Flags mean an extended header, unsynchronisation or a footer: content this reader would not see.
    expect(tagProblems(Buffer.concat([tag(3, three, { flags: 0x40 }), AUDIO]), NEUTRAL)).toEqual(['ID3v2 header flags are set']);
  });
});

describe('the bundled scores', () => {
  it('carry exactly the title, artist and album the app publishes for their phase, and nothing else', () => {
    expect(scoreTracks).toHaveLength(6);
    for (const track of scoreTracks) {
      const data = shipped.get(track.path);
      if (!data) throw new Error('not among the shipped files: ' + track.path);
      expect(tagProblems(data, scoreMetadata(track.phase)), track.path).toEqual([]);
      expect(readTags(data).frames.map((frame) => [frame.id, frame.text]), track.path)
        .toEqual([['TIT2', 'Phase ' + String(track.phase) + ' score'], ['TPE1', GAME_TITLE], ['TALB', GAME_TITLE]]);
      // The track's own name is recorded in the manifest and must not be readable from the file.
      expect(data.includes(track.title), track.title).toBe(false);
    }
  });

  it.skipIf(spawnSync('ffprobe', ['-version']).status !== 0)('read the same way through ffprobe: three tags, one audio stream, no picture', () => {
    for (const track of scoreTracks) {
      const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format_tags:stream=codec_type', '-of', 'json', track.path], { encoding: 'utf8' });
      expect(probe.status, probe.stderr).toBe(0);
      const report = JSON.parse(probe.stdout) as { format: { tags?: Record<string, string> }; streams: { codec_type: string }[] };
      expect(report.format.tags, track.path).toEqual(scoreMetadata(track.phase));
      expect(report.streams.map((stream) => stream.codec_type), track.path).toEqual(['audio']);
    }
  });
});

describe('the voice clips', () => {
  it('carry an encoder frame and no text that could name a speaker or quote a transmission', () => {
    const folders = [...readdirSync('assets/audio/voice/clean').map((name) => 'assets/audio/voice/clean/' + name),
      ...readdirSync('assets/audio/voice/vibration').map((name) => 'assets/audio/voice/vibration/' + name)];
    expect([...voiceClipFiles.keys()].sort(), 'tests/voice-files.ts lists every committed clip').toEqual(folders.sort());
    for (const [path, data] of voiceClipFiles) {
      const report = readTags(data);
      expect(report, path).toMatchObject({ versions: [4], flags: [0], audioSync: true, trailers: [] });
      // TSSE is the muxer's own name and version: nothing about the line, the voice or the game.
      expect(report.frames.map((frame) => frame.id), path).toEqual(['TSSE']);
      expect(report.frames[0]?.text, path).toMatch(/^Lavf[0-9.]+$/);
    }
  });
});
