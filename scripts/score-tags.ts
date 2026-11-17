/**
 * Reads and writes the container tags of an MP3 without touching its audio: an ID3v2 parser,
 * the one neutral tag a bundled score may carry (the app's own three strings plus a plain
 * AI-origin disclosure), and a splice that swaps the tag and copies
 * every byte from the first MPEG frame on unchanged. Pure: bytes in, bytes out, no file
 * access. `scripts/neutral-score-tags.ts` is the command; tests/score-tags.spec.ts holds the
 * shipped files to it. Why it exists: on Android the media session shows the file's own tags
 * (docs/SOUNDTRACK.md, issue #193).
 */

export interface TagFrame {
  id: string;
  /** Decoded text for a text frame (`T...`, except `TXXX`) or a comment (`COMM`); null for everything else. */
  text: string | null;
  /** A comment's language and content description; null for every other frame. */
  language: string | null;
  description: string | null;
  bytes: number;
}

export interface TagReport {
  /** ID3v2 major versions of the tags at the head of the file, in order. Normally one. */
  versions: number[];
  /** Header flag bytes of those tags; a neutral tag has none set. */
  flags: number[];
  frames: TagFrame[];
  /** Offset of the first byte after the leading ID3v2 tags. */
  audioOffset: number;
  /** True when the bytes at `audioOffset` are an MPEG audio frame header. */
  audioSync: boolean;
  /** Tag formats found at the end of the file: `ID3v1`, `APE`, `Lyrics3`, `ID3v2 footer`. */
  trailers: string[];
}

export interface NeutralTags { title: string; artist: string; album: string }

/**
 * The AI-origin disclosure every shipped score carries in place of Suno's signed C2PA manifest
 * (nexus vote `vote-1794897142413-84x42e4`). It goes in a comment frame because media3, which
 * builds the Android media session, maps only text frames and artwork to what it displays;
 * a `COMM` frame contributes nothing there (docs/SOUNDTRACK.md).
 */
export const AI_DISCLOSURE = 'AI-generated music (Suno)';
/** ISO 639-2 language of the disclosure comment; its content description is empty. */
const DISCLOSURE_LANGUAGE = 'eng';

const HEADER = 10;

function syncsafe(data: Uint8Array, at: number): number {
  return ((data[at] ?? 0) << 21) | ((data[at + 1] ?? 0) << 14) | ((data[at + 2] ?? 0) << 7) | (data[at + 3] ?? 0);
}

function plain(data: Uint8Array, at: number, length: number): number {
  let value = 0;
  for (let index = 0; index < length; index++) value = value * 256 + (data[at + index] ?? 0);
  return value;
}

function ascii(data: Uint8Array, start: number, end: number): string {
  return Buffer.from(data.subarray(start, end)).toString('latin1');
}

/** ID3v2 text encodings: 0 Latin-1, 1 UTF-16 with a byte-order mark, 2 UTF-16BE, 3 UTF-8. */
function decodeText(body: Uint8Array): string {
  const bytes = Buffer.from(body.subarray(1));
  const encoding = body[0];
  let text: string;
  if (encoding === 1 || encoding === 2) {
    const bigEndian = encoding === 2 || (bytes[0] === 0xfe && bytes[1] === 0xff);
    const payload = Buffer.from(encoding === 1 && bytes.length >= 2 ? bytes.subarray(2) : bytes);
    if (bigEndian) payload.swap16();
    text = payload.toString('utf16le');
  } else {
    text = bytes.toString(encoding === 3 ? 'utf8' : 'latin1');
  }
  return text.replace(/\0+$/, '');
}

/** A `COMM` body: encoding, three-letter language, a terminated description, then the text. */
function decodeComment(body: Uint8Array): Pick<TagFrame, 'text' | 'language' | 'description'> {
  const encoding = body[0] ?? 0;
  const rest = body.subarray(4);
  // UTF-16 strings end at an aligned pair of zero bytes; the other encodings at one.
  const width = encoding === 1 || encoding === 2 ? 2 : 1;
  let end = 0;
  while (end + width <= rest.length && !(rest[end] === 0 && (width === 1 || rest[end + 1] === 0))) end += width;
  const segment = (from: number, to: number) => decodeText(Buffer.concat([Buffer.from([encoding]), rest.subarray(from, to)]));
  return { language: ascii(body, 1, 4), description: segment(0, end), text: segment(end + width, rest.length) };
}

function readFrames(data: Uint8Array, start: number, end: number, version: number): TagFrame[] {
  // v2.2 has three-letter ids and three-byte sizes; v2.4 sizes are syncsafe, v2.3 are not.
  const idLength = version === 2 ? 3 : 4;
  const head = version === 2 ? 6 : 10;
  const frames: TagFrame[] = [];
  let at = start;
  while (at + head <= end && data[at] !== 0) {
    const id = ascii(data, at, at + idLength);
    const size = version === 2 ? plain(data, at + 3, 3) : version === 4 ? syncsafe(data, at + 4) : plain(data, at + 4, 4);
    const body = data.subarray(at + head, Math.min(at + head + size, end));
    const isText = id.startsWith('T') && id !== 'TXXX' && id !== 'TXX';
    const decoded = id === 'COMM' ? decodeComment(body) : { text: isText ? decodeText(body) : null, language: null, description: null };
    frames.push({ id, ...decoded, bytes: size });
    at += head + size;
  }
  return frames;
}

function trailersOf(data: Uint8Array): string[] {
  const found: string[] = [];
  let end = data.length;
  if (end >= 128 && ascii(data, end - 128, end - 125) === 'TAG') { found.push('ID3v1'); end -= 128; }
  if (end >= 9 && ['LYRICS200', 'LYRICSEND'].includes(ascii(data, end - 9, end))) found.push('Lyrics3');
  if (end >= 32 && ascii(data, end - 32, end - 24) === 'APETAGEX') found.push('APE');
  if (end >= 10 && ascii(data, end - 10, end - 7) === '3DI') found.push('ID3v2 footer');
  return found;
}

/** Everything a media session could read out of the container, without decoding any audio. */
export function readTags(data: Uint8Array): TagReport {
  const versions: number[] = [];
  const flags: number[] = [];
  const frames: TagFrame[] = [];
  let at = 0;
  while (ascii(data, at, at + 3) === 'ID3' && at + HEADER <= data.length) {
    const version = data[at + 3] ?? 0;
    const flag = data[at + 5] ?? 0;
    const end = at + HEADER + syncsafe(data, at + 6);
    versions.push(version);
    flags.push(flag);
    frames.push(...readFrames(data, at + HEADER, Math.min(end, data.length), version));
    // A v2.4 tag may be followed by a ten-byte footer that its size does not count.
    at = end + (version === 4 && (flag & 0x10) !== 0 ? HEADER : 0);
  }
  const audioSync = data[at] === 0xff && ((data[at + 1] ?? 0) & 0xe0) === 0xe0;
  return { versions, flags, frames, audioOffset: at, audioSync, trailers: trailersOf(data) };
}

function id3Frame(id: string, body: Buffer): Buffer {
  const head = Buffer.alloc(HEADER);
  head.write(id, 0, 'latin1');
  head.writeUInt32BE(body.length, 4);
  return Buffer.concat([head, body]);
}

function latin1(text: string): Buffer {
  // Latin-1 (encoding 0) is the form every ID3v2.3 reader accepts; the neutral strings are ASCII.
  if (!/^[\x20-\x7e]+$/.test(text)) throw new Error('Neutral tag text must be printable ASCII: ' + text);
  return Buffer.from(text, 'latin1');
}

const textFrame = (id: string, text: string) => id3Frame(id, Buffer.concat([Buffer.from([0]), latin1(text)]));
/** Latin-1, the disclosure language, an empty description (one terminating zero), the text. */
const commentFrame = (text: string) => id3Frame('COMM', Buffer.concat([Buffer.from([0]), latin1(DISCLOSURE_LANGUAGE), Buffer.from([0]), latin1(text)]));

/**
 * The whole tag a bundled score carries: ID3v2.3, no flags, title, artist, album, the AI-origin
 * disclosure comment, no padding.
 */
export function neutralTag(tags: NeutralTags): Buffer {
  const frames = Buffer.concat([textFrame('TIT2', tags.title), textFrame('TPE1', tags.artist), textFrame('TALB', tags.album),
    commentFrame(AI_DISCLOSURE)]);
  const size = frames.length;
  const head = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, (size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f]);
  return Buffer.concat([head, frames]);
}

/**
 * The file with its leading ID3v2 tags replaced by the neutral tag. Bytes from the first MPEG
 * frame to the end, the Xing/LAME frame that carries the encoder delay and padding included,
 * are copied, never parsed or rewritten. It refuses a file it does not fully understand
 * rather than guess where the audio starts or ends.
 */
export function withNeutralTags(data: Uint8Array, tags: NeutralTags): Buffer {
  const report = readTags(data);
  if (!report.audioSync) throw new Error('No MPEG audio frame directly after the ID3v2 tag');
  if (report.trailers.length > 0) throw new Error('Trailing tag not handled: ' + report.trailers.join(', '));
  return Buffer.concat([neutralTag(tags), data.subarray(report.audioOffset)]);
}

/** Why this file may not ship as a score for `expected`; empty when it may. */
export function tagProblems(data: Uint8Array, expected: NeutralTags): string[] {
  const report = readTags(data);
  const problems: string[] = [];
  if (report.versions.length !== 1) problems.push('expected one ID3v2 tag, found ' + String(report.versions.length));
  if (report.flags.some((flag) => flag !== 0)) problems.push('ID3v2 header flags are set');
  if (!report.audioSync) problems.push('no MPEG audio frame directly after the ID3v2 tag');
  for (const trailer of report.trailers) problems.push('trailing ' + trailer + ' tag');
  const wanted: Record<string, string> = { TIT2: expected.title, TPE1: expected.artist, TALB: expected.album, COMM: AI_DISCLOSURE };
  for (const found of report.frames) {
    if (!Object.hasOwn(wanted, found.id)) problems.push('unexpected frame ' + found.id);
    else if (found.text !== wanted[found.id]) problems.push(found.id + ' is "' + String(found.text) + '", not "' + String(wanted[found.id]) + '"');
    else if (found.id === 'COMM' && (found.language !== DISCLOSURE_LANGUAGE || found.description !== '')) {
      problems.push('COMM is not language "' + DISCLOSURE_LANGUAGE + '" with an empty description');
    }
  }
  for (const id of Object.keys(wanted)) {
    const count = report.frames.filter((frame) => frame.id === id).length;
    if (count !== 1) problems.push('expected one ' + id + ' frame, found ' + String(count));
  }
  return problems;
}
